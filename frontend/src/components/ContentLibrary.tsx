import { useSuiClientQuery } from '@mysten/dapp-kit';
import { MARKETPLACE_ID, HIDDEN_LISTING_IDS, HIDDEN_TITLE_PATTERNS, explorerUrl } from '../config';
import { getTheme } from '../themes';

interface ListingFields {
  creator: string;
  title: number[];
  description: number[];
  thumbnail_url: number[];
  price: string;
  walrus_blob_id: number[];
  buyers: string[];
  total_revenue: string;
  is_active: boolean;
  created_at: string;
}

function decodeBytes(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function formatSUI(mist: string): string {
  const sui = Number(mist) / 1_000_000_000;
  if (sui === 0) return '0';
  if (sui >= 0.01) return sui.toFixed(2);
  return sui.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

export default function ContentLibrary() {
  const { data: marketplaceObj } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const allListingIds: string[] = fields?.listings ?? [];

  // Filter hidden listings, reverse so premium appear first
  const listingIds = allListingIds
    .filter(id => !HIDDEN_LISTING_IDS.includes(id))
    .reverse();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Content Library</h2>
        <p className="text-gray-400 mt-1">{listingIds.length} intelligence packages on the marketplace</p>
      </div>

      {listingIds.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 border border-gray-800 text-center">
          <div className="text-4xl mb-3">{'\u{1F4DA}'}</div>
          <p className="text-gray-400">No listings yet. The agent will create content soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listingIds.map((id) => (
            <ListingCard key={id} listingId={id} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({ listingId }: { listingId: string }) {
  const { data, isLoading } = useSuiClientQuery('getObject', {
    id: listingId,
    options: { showContent: true },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#111827]">
        <div className="h-14 animate-shimmer" />
        <div className="p-5 space-y-3">
          <div className="h-4 bg-gray-800 rounded animate-shimmer w-3/4" />
          <div className="h-3 bg-gray-800 rounded animate-shimmer w-full" />
        </div>
      </div>
    );
  }

  const fields = (data?.data?.content as any)?.fields as ListingFields | undefined;
  if (!fields) return null;

  const title = decodeBytes(fields.title);

  // Hide listings matching title patterns
  const titleLower = title.toLowerCase();
  if (HIDDEN_TITLE_PATTERNS.some(p => titleLower.includes(p))) return null;

  const description = decodeBytes(fields.description);
  const themeName = fields.thumbnail_url?.length > 0 ? decodeBytes(fields.thumbnail_url) : 'blue-data';
  const theme = getTheme(themeName);
  const buyerCount = fields.buyers.length;

  return (
    <div className={`rounded-xl overflow-hidden border ${theme.border} bg-[#111827] hover:scale-[1.02] transition-all duration-200`}>
      {/* Gradient Banner */}
      <div className={`bg-gradient-to-r ${theme.gradient} p-3 flex items-center justify-between`}>
        <span className="text-xl">{theme.icon}</span>
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{theme.label}</span>
      </div>

      <div className="p-5">
        <h3 className="text-white font-semibold text-sm leading-tight mb-2 line-clamp-2">{title}</h3>
        <p className="text-gray-500 text-xs mb-4 line-clamp-2">{description}</p>

        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${theme.accent}`}>{formatSUI(fields.price)} SUI</span>
          <span className="text-gray-500">{'\u{1F465}'} {buyerCount} unlocked</span>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            Revenue: {formatSUI(fields.total_revenue)} SUI
          </span>
          <a href={explorerUrl('object', listingId)} target="_blank" rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs">
            SuiScan {'\u{2192}'}
          </a>
        </div>
      </div>
    </div>
  );
}
