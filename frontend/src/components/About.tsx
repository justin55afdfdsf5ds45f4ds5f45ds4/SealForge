import { PACKAGE_ID, MARKETPLACE_ID, explorerUrl } from '../config';

export default function About() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-white">About SealForge</h2>
        <p className="text-gray-400 mt-1">Built for the Sui x OpenClaw Agent Hackathon (DeepSurge)</p>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-white">What is SealForge?</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          SealForge is an autonomous AI agent that creates premium content, encrypts it using
          Seal threshold encryption, stores it on Walrus decentralized storage, and sells access
          through a Sui Move smart contract marketplace. Buyers pay SUI to purchase access, and
          only authorized users can decrypt the content through Seal's on-chain access control.
        </p>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-white">Tech Stack</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Sui Move', desc: 'Smart contracts for marketplace logic' },
            { name: 'Seal', desc: 'Threshold encryption for content access control' },
            { name: 'Walrus', desc: 'Decentralized storage for encrypted blobs' },
            { name: 'React + Vite', desc: 'Frontend dashboard with Tailwind CSS' },
            { name: '@mysten/dapp-kit', desc: 'Wallet connection and Sui interactions' },
            { name: 'OpenClaw', desc: 'AI agent orchestration framework' },
          ].map((item) => (
            <div key={item.name} className="bg-[#0a0f1e] rounded-lg p-3">
              <p className="text-white text-sm font-medium">{item.name}</p>
              <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-3">
        <h3 className="text-lg font-semibold text-white">Links</h3>
        <div className="space-y-2 text-sm">
          <LinkRow label="Package" url={explorerUrl('object', PACKAGE_ID)} text={PACKAGE_ID} />
          <LinkRow label="Marketplace" url={explorerUrl('object', MARKETPLACE_ID)} text={MARKETPLACE_ID} />
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-3">Pipeline Flow</h3>
        <div className="text-gray-400 text-sm font-mono space-y-1">
          <p>1. Agent creates ContentListing on Sui (title, description, price)</p>
          <p>2. Agent generates premium content (research reports, analysis)</p>
          <p>3. Content encrypted with Seal using listing ID as encryption key</p>
          <p>4. Encrypted blob uploaded to Walrus (epochs=10 for persistence)</p>
          <p>5. Listing updated with Walrus blob ID on-chain</p>
          <p>6. Buyer purchases access by paying SUI to the listing</p>
          <p>7. Buyer downloads encrypted blob from Walrus</p>
          <p>8. Seal key servers verify on-chain access via seal_approve</p>
          <p>9. Content decrypted and displayed to the buyer</p>
        </div>
      </div>
    </div>
  );
}

function LinkRow({ label, url, text }: { label: string; url: string; text: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <a href={url} target="_blank" rel="noreferrer"
        className="text-blue-400 hover:text-blue-300 font-mono text-xs">
        {text.slice(0, 14)}...{text.slice(-8)}
      </a>
    </div>
  );
}
