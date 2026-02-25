import { useState, useEffect, useRef } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { MARKETPLACE_ID, TREASURY_ID, AGENT_ADDRESS, PACKAGE_ID, explorerUrl } from '../config';

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
};

const PHASE_ICONS: Record<string, string> = {
  SCAN: '\u{1F50D}',
  IDENTIFY: '\u{1F9E0}',
  HUNT: '\u{1F50E}',
  REASON: '\u{1F4AD}',
  PACKAGE: '\u{1F4E6}',
  PUBLISH: '\u{1F3EA}',
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
  return (Number(mist) / 1_000_000_000).toFixed(4);
}

export default function Dashboard() {
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: marketplaceObj, isLoading } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const { data: treasuryObj, isLoading: treasuryLoading } = useSuiClientQuery('getObject', {
    id: TREASURY_ID,
    options: { showContent: true },
  });

  const { data: balanceData, isLoading: balanceLoading } = useSuiClientQuery('getBalance', {
    owner: AGENT_ADDRESS,
  });

  // Load activity log
  useEffect(() => {
    fetch('/agent-activity.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => setActivityLog(Array.isArray(data) ? data : []))
      .catch(() => setActivityLog([]));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog]);

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const totalListings = fields?.total_listings ?? '—';
  const totalSales = fields?.total_sales ?? '—';

  const tFields = (treasuryObj?.data?.content as any)?.fields;
  const totalEarned = tFields?.total_earned ?? '0';
  const totalSpent = tFields?.total_spent ?? '0';
  const contentCreated = tFields?.total_content_created ?? '0';
  const treasurySales = tFields?.total_sales ?? '0';
  const agentBalance = balanceData?.totalBalance ?? '0';

  const netProfit = Number(totalEarned) - Number(totalSpent);
  const isProfitable = netProfit > 0;

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

      {/* Agent Brain — Activity Log */}
      {activityLog.length > 0 && (
        <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="text-lg">{'\u{1F9E0}'}</span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agent Brain — Recent Activity</h3>
            <span className="text-xs text-gray-500 ml-auto">{activityLog.length} events</span>
          </div>
          <div className="max-h-72 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
            {activityLog.slice(-30).map((entry, i) => {
              const time = new Date(entry.timestamp);
              const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
              const phaseColor = PHASE_COLORS[entry.phase] || 'bg-gray-500';
              const phaseIcon = PHASE_ICONS[entry.phase] || '\u{2022}';
              return (
                <div key={i} className="flex items-start gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="text-gray-600 flex-shrink-0">{timeStr}</span>
                  <span className={`${phaseColor} text-white text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0`}>
                    {entry.phase}
                  </span>
                  <span className="text-gray-300">{phaseIcon} {entry.message}</span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Treasury P&L */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          {'\u{1F4B0}'} Treasury P&L
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Net P&L"
            value={treasuryLoading ? '...' : `${netProfit > 0 ? '+' : ''}${formatSUI(netProfit)} SUI`}
            sub={isProfitable ? 'PROFITABLE' : 'Building...'}
            accent={isProfitable ? 'text-green-400' : 'text-yellow-400'}
          />
          <StatCard
            label="Total Earned"
            value={treasuryLoading ? '...' : `${formatSUI(totalEarned)} SUI`}
            sub={`${treasurySales} sales`}
          />
          <StatCard
            label="Total Spent"
            value={treasuryLoading ? '...' : `${formatSUI(totalSpent)} SUI`}
            sub="Gas + storage"
          />
          <StatCard
            label="Content Created"
            value={treasuryLoading ? '...' : contentCreated}
            sub="Intel packages"
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
        <StatCard label="Total Listings" value={isLoading ? '...' : totalListings} sub="Active on marketplace" />
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
