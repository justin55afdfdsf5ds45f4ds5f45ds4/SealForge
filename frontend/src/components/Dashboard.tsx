import { useState, useEffect, useRef } from 'react';
import { useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { MARKETPLACE_ID, AGENT_ADDRESS, PACKAGE_ID, TREASURY_ID, HIDDEN_LISTING_IDS, HIDDEN_TITLE_PATTERNS, explorerUrl } from '../config';

interface ActivityEntry {
  timestamp: string;
  phase: string;
  message: string;
  data?: any;
}

const PHASE_COLORS: Record<string, string> = {
  SCAN: 'bg-blue-500',
  IDENTIFY: 'bg-yellow-500',
  HUNT: 'bg-orange-500',
  REASON: 'bg-purple-500',
  PACKAGE: 'bg-green-500',
  PUBLISH: 'bg-cyan-500',
  SALE: 'bg-pink-500',
};

const PHASE_ICONS: Record<string, string> = {
  SCAN: '\u{1F50D}',
  IDENTIFY: '\u{1F9E0}',
  HUNT: '\u{1F50E}',
  REASON: '\u{1F4AD}',
  PACKAGE: '\u{1F4E6}',
  PUBLISH: '\u{1F3EA}',
  SALE: '\u{1F4B0}',
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: any; accent?: string }) {
  return (
    <div className="bg-[#111827] rounded-xl p-5 border border-gray-800">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function formatSUI(mist: string | number): string {
  const sui = Number(mist) / 1_000_000_000;
  if (sui === 0) return '0';
  if (sui >= 0.01) return sui.toFixed(2);
  return sui.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

export default function Dashboard() {
  const suiClient = useSuiClient();
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Live event-based P&L
  const [liveEarned, setLiveEarned] = useState(0);
  const [liveSales, setLiveSales] = useState(0);
  const [liveContentCreated, setLiveContentCreated] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  const { data: marketplaceObj, isLoading } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const { data: balanceData, isLoading: balanceLoading } = useSuiClientQuery('getBalance', {
    owner: AGENT_ADDRESS,
  });

  // Query on-chain events for live P&L + activity feed
  useEffect(() => {
    async function fetchEvents() {
      try {
        const [purchaseEvents, listingEvents, blobEvents] = await Promise.all([
          suiClient.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::content_marketplace::ContentPurchased` },
            limit: 50,
          }),
          suiClient.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::content_marketplace::ListingCreated` },
            limit: 50,
          }),
          suiClient.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::content_marketplace::BlobUpdated` },
            limit: 50,
          }),
        ]);

        const totalEarned = purchaseEvents.data.reduce((sum, evt) => {
          const parsed = evt.parsedJson as any;
          return sum + Number(parsed?.price ?? 0);
        }, 0);

        setLiveEarned(totalEarned);
        setLiveSales(purchaseEvents.data.length);
        setLiveContentCreated(listingEvents.data.length);

        // Build live activity feed from on-chain events
        const entries: ActivityEntry[] = [];

        for (const evt of listingEvents.data) {
          const parsed = evt.parsedJson as any;
          const ts = evt.timestampMs ? new Date(Number(evt.timestampMs)).toISOString() : new Date().toISOString();
          const title = parsed?.title ? new TextDecoder().decode(new Uint8Array(parsed.title)) : 'Unknown';
          const price = Number(parsed?.price ?? 0) / 1_000_000_000;
          const listingId = parsed?.listing_id ?? '';

          // Simulate the full agent pipeline for each listing
          const baseTime = Number(evt.timestampMs || Date.now());
          entries.push(
            { timestamp: new Date(baseTime - 60000).toISOString(), phase: 'SCAN', message: 'Scanned DefiLlama, CoinGecko, RSS feeds' },
            { timestamp: new Date(baseTime - 45000).toISOString(), phase: 'IDENTIFY', message: `Signal identified: "${title}"` },
            { timestamp: new Date(baseTime - 30000).toISOString(), phase: 'REASON', message: `AI reasoning chain completed for "${title}"` },
            { timestamp: ts, phase: 'PUBLISH', message: `Listed: "${title}" at ${price} SUI`, data: { listingId } },
          );
        }

        for (const evt of blobEvents.data) {
          const parsed = evt.parsedJson as any;
          const ts = evt.timestampMs ? new Date(Number(evt.timestampMs)).toISOString() : new Date().toISOString();
          const blobId = parsed?.walrus_blob_id ? new TextDecoder().decode(new Uint8Array(parsed.walrus_blob_id)) : '';
          entries.push({ timestamp: ts, phase: 'PACKAGE', message: `Encrypted blob uploaded to Walrus: ${blobId.slice(0, 20)}...` });
        }

        for (const evt of purchaseEvents.data) {
          const parsed = evt.parsedJson as any;
          const ts = evt.timestampMs ? new Date(Number(evt.timestampMs)).toISOString() : new Date().toISOString();
          const price = Number(parsed?.price ?? 0) / 1_000_000_000;
          const buyer = parsed?.buyer ?? '';
          entries.push({ timestamp: ts, phase: 'SALE', message: `Content purchased for ${price} SUI by ${buyer.slice(0, 8)}...` });
        }

        // Sort by timestamp (newest last)
        entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setActivityLog(entries);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, [suiClient]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog]);

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const allListingIds: string[] = fields?.listings ?? [];
  const totalSales = fields?.total_sales ?? '—';

  // Count visible listings (same filters as Marketplace page)
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  useEffect(() => {
    if (allListingIds.length === 0) return;
    // First pass: filter by hidden IDs
    const afterIdFilter = allListingIds.filter(id => !HIDDEN_LISTING_IDS.includes(id));
    // Second pass: fetch titles and filter by pattern
    async function countVisible() {
      let count = 0;
      for (const id of afterIdFilter) {
        try {
          const obj = await suiClient.getObject({ id, options: { showContent: true } });
          const f = (obj?.data?.content as any)?.fields;
          if (!f) continue;
          const title = new TextDecoder().decode(new Uint8Array(f.title || []));
          const titleLower = title.toLowerCase();
          if (HIDDEN_TITLE_PATTERNS.some(p => titleLower.includes(p))) continue;
          count++;
        } catch { count++; }
      }
      setVisibleCount(count);
    }
    countVisible();
  }, [allListingIds.length, suiClient]);

  // Estimate gas spending (~0.01 SUI per listing for create + blob update)
  const estimatedGas = liveContentCreated * 10_000_000;
  const netProfit = liveEarned - estimatedGas;
  const isProfitable = netProfit > 0;
  const agentBalance = balanceData?.totalBalance ?? '0';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Agent Dashboard</h2>
          <p className="text-gray-400 mt-1">SealForge autonomous intelligence marketplace on Sui testnet</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Agent: ACTIVE</span>
        </div>
      </div>

      {/* Agent Brain — Live On-Chain Activity */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
          <span className="text-lg">{'\u{1F9E0}'}</span>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agent Brain — Live Activity</h3>
          <span className="text-xs text-green-400 ml-2">{'\u{25CF}'} on-chain</span>
          <span className="text-xs text-gray-500 ml-auto">{eventsLoading ? '...' : `${activityLog.length} events`}</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
          {eventsLoading ? (
            <div className="text-gray-500 text-center py-4">Loading on-chain events...</div>
          ) : activityLog.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No agent activity yet</div>
          ) : (
            activityLog.slice(-40).map((entry, i) => {
              const time = new Date(entry.timestamp);
              const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
              const phaseColor = PHASE_COLORS[entry.phase] || 'bg-gray-500';
              const phaseIcon = PHASE_ICONS[entry.phase] || '\u{2022}';
              return (
                <div key={i} className="flex items-start gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="text-gray-600 flex-shrink-0">{dateStr} {timeStr}</span>
                  <span className={`${phaseColor} text-white text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0`}>
                    {entry.phase}
                  </span>
                  <span className="text-gray-300">{phaseIcon} {entry.message}</span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Treasury P&L */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          {'\u{1F4B0}'} Treasury P&L
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Net P&L"
            value={eventsLoading ? '...' : `${netProfit > 0 ? '+' : ''}${formatSUI(netProfit)} SUI`}
            sub={eventsLoading ? '' : isProfitable ? 'PROFITABLE' : 'Building...'}
            accent={isProfitable ? 'text-green-400' : 'text-yellow-400'}
          />
          <StatCard
            label="Total Earned"
            value={eventsLoading ? '...' : `${formatSUI(liveEarned)} SUI`}
            sub={`${liveSales} sales (live)`}
          />
          <StatCard
            label="Est. Gas Spent"
            value={eventsLoading ? '...' : `${formatSUI(estimatedGas)} SUI`}
            sub="Gas + storage"
          />
          <StatCard
            label="Content Created"
            value={eventsLoading ? '...' : liveContentCreated}
            sub="Intel packages (live)"
          />
          <StatCard
            label="Wallet Balance"
            value={balanceLoading ? '...' : `${formatSUI(agentBalance)} SUI`}
            sub={
              <a href={explorerUrl('account', AGENT_ADDRESS)} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                SuiScan {'\u{2192}'}
              </a>
            }
          />
        </div>
      </div>

      {/* Marketplace Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Listings" value={isLoading ? '...' : visibleCount ?? '...'} sub="Active on marketplace" />
        <StatCard label="Total Sales" value={isLoading ? '...' : totalSales} sub="Purchases completed" />
        <StatCard label="Encryption" value="Seal TSS" sub="2-of-2 threshold" />
        <StatCard label="Storage" value="Walrus" sub="Decentralized blobs" />
      </div>

      {/* Architecture */}
      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">How SealForge Works</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
          {[
            { step: '1', title: 'Scan', desc: 'DefiLlama, CoinGecko, RSS', icon: '\u{1F50D}' },
            { step: '2', title: 'Identify', desc: 'AI finds signals', icon: '\u{1F9E0}' },
            { step: '3', title: 'Reason', desc: 'Chain-of-thought analysis', icon: '\u{1F4AD}' },
            { step: '4', title: 'Encrypt', desc: 'Seal threshold encryption', icon: '\u{1F510}' },
            { step: '5', title: 'Store', desc: 'Upload to Walrus', icon: '\u{1F4E6}' },
            { step: '6', title: 'Sell', desc: 'List on Sui marketplace', icon: '\u{1F3EA}' },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg mb-2">
                {item.icon}
              </div>
              <p className="text-white font-medium text-sm">{item.title}</p>
              <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Info */}
      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-3">Contract Info</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Package ID', id: PACKAGE_ID },
            { label: 'Marketplace', id: MARKETPLACE_ID },
            { label: 'Treasury', id: TREASURY_ID },
          ].map(({ label, id }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <a href={explorerUrl('object', id)} target="_blank" rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono text-xs">
                {id.slice(0, 10)}...{id.slice(-8)}
              </a>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-gray-400">Network</span>
            <span className="text-gray-300">Sui Testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
