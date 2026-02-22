import { useSuiClientQuery } from '@mysten/dapp-kit';
import { MARKETPLACE_ID, PACKAGE_ID, explorerUrl } from '../config';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#111827] rounded-xl p-5 border border-gray-800">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: marketplaceObj, isLoading } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const totalListings = fields?.total_listings ?? '—';
  const totalSales = fields?.total_sales ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Agent Dashboard</h2>
        <p className="text-gray-400 mt-1">SealForge autonomous content marketplace on Sui testnet</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Listings" value={isLoading ? '...' : totalListings} sub="Content pieces created" />
        <StatCard label="Total Sales" value={isLoading ? '...' : totalSales} sub="Purchases completed" />
        <StatCard label="Encryption" value="Seal TSS" sub="2-of-2 threshold" />
        <StatCard label="Storage" value="Walrus" sub="Decentralized blobs" />
      </div>

      {/* Architecture Overview */}
      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">How SealForge Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
          {[
            { step: '1', title: 'Create', desc: 'Agent creates content listing on Sui' },
            { step: '2', title: 'Encrypt', desc: 'Content encrypted with Seal threshold encryption' },
            { step: '3', title: 'Store', desc: 'Encrypted blob uploaded to Walrus' },
            { step: '4', title: 'Purchase', desc: 'Buyer pays SUI, recorded on-chain' },
            { step: '5', title: 'Decrypt', desc: 'Seal verifies access, content decrypted' },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-2">
                {item.step}
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
          <div className="flex justify-between">
            <span className="text-gray-400">Package ID</span>
            <a href={explorerUrl('object', PACKAGE_ID)} target="_blank" rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-xs">
              {PACKAGE_ID.slice(0, 10)}...{PACKAGE_ID.slice(-8)}
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Marketplace</span>
            <a href={explorerUrl('object', MARKETPLACE_ID)} target="_blank" rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-xs">
              {MARKETPLACE_ID.slice(0, 10)}...{MARKETPLACE_ID.slice(-8)}
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Network</span>
            <span className="text-gray-300">Sui Testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
