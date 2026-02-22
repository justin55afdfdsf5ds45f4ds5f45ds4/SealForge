import { useSuiClientQuery } from '@mysten/dapp-kit';
import { MARKETPLACE_ID, explorerUrl } from '../config';

interface ListingFields {
  creator: string;
  title: number[];
  description: number[];
  price: string;
  walrus_blob_id: number[];
  buyers: string[];
  total_revenue: string;
  is_active: boolean;
}

function decodeBytes(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function formatSUI(mist: string): string {
  return (Number(mist) / 1_000_000_000).toFixed(2);
}

export default function ContentLibrary() {
  const { data: marketplaceObj } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const listingIds: string[] = fields?.listings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Content Library</h2>
        <p className="text-gray-400 mt-1">{listingIds.length} listings on the marketplace</p>
      </div>

      {listingIds.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500">No listings yet. The agent will create content soon.</p>
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
      <div className="bg-[#111827] rounded-xl p-5 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  const fields = (data?.data?.content as any)?.fields as ListingFields | undefined;
  if (!fields) return null;

  const title = decodeBytes(fields.title);
  const description = decodeBytes(fields.description);
  const blobId = fields.walrus_blob_id.length > 0 ? decodeBytes(fields.walrus_blob_id) : null;
  const buyerCount = fields.buyers.length;
  const revenue = formatSUI(fields.total_revenue);

  return (
    <div className="bg-[#111827] rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white font-semibold text-sm leading-tight">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${fields.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
          {fields.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p className="text-gray-500 text-xs mb-4 line-clamp-2">{description}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-blue-400 font-medium">{formatSUI(fields.price)} SUI</span>
        <span className="text-gray-500">{buyerCount} buyer{buyerCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <span className="text-gray-500">Revenue: {revenue} SUI</span>
        {blobId && (
          <span className="text-gray-600 font-mono text-[10px]" title={blobId}>
            blob:{blobId.slice(0, 8)}...
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <a href={explorerUrl('object', listingId)} target="_blank" rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 text-xs">
          View on SuiScan
        </a>
      </div>
    </div>
  );
}
