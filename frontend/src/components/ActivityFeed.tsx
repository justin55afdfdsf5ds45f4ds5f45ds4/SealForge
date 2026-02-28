import { useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { PACKAGE_ID, explorerUrl } from '../config';
import type { SuiEvent } from '@mysten/sui/jsonRpc';

function formatSUI(mist: string | number): string {
  const sui = Number(mist) / 1_000_000_000;
  if (sui === 0) return '0';
  if (sui >= 0.01) return sui.toFixed(2);
  return sui.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

export default function ActivityFeed() {
  const suiClient = useSuiClient();
  const [events, setEvents] = useState<SuiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchEvents() {
    try {
      const result = await suiClient.queryEvents({
        query: { MoveModule: { package: PACKAGE_ID, module: 'content_marketplace' } },
        limit: 20,
        order: 'descending',
      });
      setEvents(result.data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  function getEventInfo(event: SuiEvent) {
    const typeName = event.type.split('::').pop() || 'Unknown';
    const parsed = event.parsedJson as any;

    switch (typeName) {
      case 'ListingCreated':
        return {
          icon: '+',
          color: 'text-blue-400 bg-blue-400/10',
          title: 'Listing Created',
          detail: parsed?.title
            ? new TextDecoder().decode(new Uint8Array(parsed.title))
            : `Listing ${parsed?.listing_id?.slice(0, 10)}...`,
        };
      case 'ContentPurchased':
        return {
          icon: '$',
          color: 'text-green-400 bg-green-400/10',
          title: 'Content Purchased',
          detail: `${formatSUI(parsed?.price || 0)} SUI`,
        };
      case 'BlobUpdated':
        return {
          icon: '#',
          color: 'text-purple-400 bg-purple-400/10',
          title: 'Blob Updated',
          detail: `Listing ${parsed?.listing_id?.slice(0, 10)}...`,
        };
      default:
        return {
          icon: '?',
          color: 'text-gray-400 bg-gray-400/10',
          title: typeName,
          detail: JSON.stringify(parsed).slice(0, 50),
        };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Feed</h2>
          <p className="text-gray-400 mt-1">Live on-chain events from the marketplace</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchEvents(); }}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 px-4 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111827] rounded-xl p-4 border border-gray-800 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500">No events yet. Activity will appear here as the agent operates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, i) => {
            const info = getEventInfo(event);
            const time = event.timestampMs
              ? new Date(Number(event.timestampMs)).toLocaleString()
              : 'Unknown time';

            return (
              <div key={`${event.id.txDigest}-${i}`}
                className="bg-[#111827] rounded-xl p-4 border border-gray-800 flex items-center gap-4 hover:border-gray-700 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${info.color}`}>
                  {info.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{info.title}</p>
                  <p className="text-gray-500 text-xs truncate">{info.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-gray-500 text-xs">{time}</p>
                  <a href={explorerUrl('tx', event.id.txDigest)} target="_blank" rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs">
                    {event.id.txDigest.slice(0, 8)}...
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
