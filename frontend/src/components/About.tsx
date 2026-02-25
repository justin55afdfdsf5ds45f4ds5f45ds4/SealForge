import { PACKAGE_ID, MARKETPLACE_ID, TREASURY_ID, AGENT_ADDRESS, explorerUrl } from '../config';

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
          SealForge is an autonomous AI agent that scans live DeFi and market data, identifies tradeable signals
          using LLM chain-of-thought reasoning, encrypts premium intelligence with Seal threshold encryption,
          stores it on Walrus decentralized storage, and sells access through a Sui Move smart contract marketplace.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed">
          Buyers don't just get text — they get an interactive intelligence experience with animated reasoning chains,
          confidence indicators, source attribution, actionable plays, and personal notes.
        </p>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-white">The 6-Phase Agent Loop</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: 'SCAN', desc: 'Fetch live DeFi + market data from DefiLlama, CoinGecko, RSS feeds', icon: '\u{1F50D}' },
            { name: 'IDENTIFY', desc: 'LLM picks the #1 tradeable signal with theme + confidence + price', icon: '\u{1F9E0}' },
            { name: 'HUNT', desc: 'Deep-dive research: targeted web fetches for the signal', icon: '\u{1F50E}' },
            { name: 'REASON', desc: 'Chain-of-thought reasoning with 3-6 steps of increasing confidence', icon: '\u{1F4AD}' },
            { name: 'PACKAGE', desc: 'Assemble IntelligencePayload, Seal encrypt, Walrus upload', icon: '\u{1F4E6}' },
            { name: 'PUBLISH', desc: 'Create on-chain listing, link blob, record in treasury', icon: '\u{1F3EA}' },
          ].map((item) => (
            <div key={item.name} className="bg-[#0a0f1e] rounded-lg p-3">
              <p className="text-white text-sm font-medium">{item.icon} {item.name}</p>
              <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-white">Tech Stack</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Sui Move', desc: 'Smart contracts for marketplace + Seal access control' },
            { name: 'Seal', desc: 'Threshold encryption (2-of-2 key servers)' },
            { name: 'Walrus', desc: 'Decentralized encrypted blob storage' },
            { name: 'React + Vite', desc: 'Frontend dashboard with Tailwind CSS' },
            { name: '@mysten/dapp-kit', desc: 'Wallet connection + Sui interactions' },
            { name: 'Replicate API', desc: 'LLM integration (Claude 4.5 Sonnet + DeepSeek R1)' },
            { name: 'DefiLlama + CoinGecko', desc: 'Live DeFi TVL, yields, prices, trending' },
            { name: 'RSS Feeds', desc: 'Sui Blog, CoinTelegraph, Decrypt news' },
          ].map((item) => (
            <div key={item.name} className="bg-[#0a0f1e] rounded-lg p-3">
              <p className="text-white text-sm font-medium">{item.name}</p>
              <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-white">Seal Encryption</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          Access control is enforced cryptographically, not by a server. The <code className="text-blue-400 bg-gray-800 px-1 rounded">seal_approve</code> function
          in the Move contract checks that the caller is either the content creator or a paying buyer. Seal key servers
          simulate the transaction on-chain — if the check passes, decryption keys are released. No centralized authority
          can grant or revoke access.
        </p>
        <div className="bg-[#0a0f1e] rounded-lg p-4 font-mono text-xs text-gray-400 space-y-1">
          <p className="text-gray-600">// Encryption ID = listing_object_id (32 bytes) + nonce (5 bytes)</p>
          <p>1. Agent creates listing on Sui (gets object ID)</p>
          <p>2. Content encrypted with Seal using listing ID</p>
          <p>3. Encrypted blob uploaded to Walrus</p>
          <p>4. Listing updated with Walrus blob ID</p>
          <p>5. Buyer purchases access (SUI payment on-chain)</p>
          <p>6. Seal key servers verify access via seal_approve</p>
          <p>7. Content decrypted in browser</p>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-gray-800 space-y-3">
        <h3 className="text-lg font-semibold text-white">Contract Addresses</h3>
        <div className="space-y-2 text-sm">
          <LinkRow label="Package" url={explorerUrl('object', PACKAGE_ID)} text={PACKAGE_ID} />
          <LinkRow label="Marketplace" url={explorerUrl('object', MARKETPLACE_ID)} text={MARKETPLACE_ID} />
          <LinkRow label="Treasury" url={explorerUrl('object', TREASURY_ID)} text={TREASURY_ID} />
          <LinkRow label="Agent" url={explorerUrl('account', AGENT_ADDRESS)} text={AGENT_ADDRESS} />
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Network</span>
            <span className="text-gray-300">Sui Testnet</span>
          </div>
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
