/**
 * SealForge Agent — Autonomous content creation and marketplace orchestrator.
 *
 * This agent:
 * 1. Generates premium content on trending crypto/DeFi topics
 * 2. Encrypts it with Seal threshold encryption
 * 3. Uploads to Walrus decentralized storage
 * 4. Lists it for sale on the Sui Move marketplace
 *
 * Run: npx tsx agent/sealforge-agent.ts [topic]
 */
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import {
  createSuiClient, createSealClient, uploadToWalrus,
  loadKeypair, loadDeployedConfig, explorerLink
} from '../scripts/src/config.js';

const TOPICS = [
  'Top 5 DeFi Protocols on Sui Network — 2026 Analysis',
  'Sui vs Solana: Technical Architecture Comparison',
  'The State of AI Agents in Web3 — Q1 2026',
  'Seal Threshold Encryption: How It Works and Why It Matters',
  'Walrus Decentralized Storage: Architecture Deep Dive',
];

function generateContent(topic: string): string {
  const now = new Date().toISOString();
  return `# ${topic}

## Executive Summary
This premium research report provides in-depth analysis of ${topic.toLowerCase()}.
Generated autonomously by the SealForge AI agent on ${now}.

## Key Findings

### 1. Market Overview
The landscape around ${topic.toLowerCase()} has evolved significantly in early 2026.
Key developments include increased adoption of on-chain encryption for content monetization,
the maturation of decentralized storage solutions like Walrus, and the growing ecosystem
of AI agents operating autonomously on blockchain networks.

### 2. Technical Analysis
From a technical perspective, the Sui blockchain provides unique advantages for this use case:
- **Move Language**: Type-safe smart contracts with strong ownership semantics
- **Object-Centric Model**: Each content listing is a shared object with on-chain access control
- **Parallel Execution**: High throughput for marketplace operations
- **Seal Integration**: Native threshold encryption tied to on-chain access policies

### 3. Competitive Landscape
Compared to traditional content platforms:
- Content creators retain full ownership of their work
- Access control is cryptographically enforced, not policy-based
- Storage is decentralized and censorship-resistant
- Payment is instant and permissionless via SUI tokens

### 4. Future Outlook
The convergence of AI agents, threshold encryption, and decentralized storage
creates new possibilities for autonomous content economies. SealForge demonstrates
this by operating without human intervention — from research to monetization.

## Methodology
This report was generated using publicly available data and analysis frameworks.
The SealForge agent researches topics, structures findings, and publishes results
as encrypted content on the Sui marketplace.

## Disclaimer
This is AI-generated research for demonstration purposes.
Part of the SealForge project for the Sui x OpenClaw Agent Hackathon (DeepSurge).

---
Generated: ${now}
Agent: SealForge v1.0
Network: Sui Testnet
`;
}

async function createAndListContent(topic: string, priceInSUI: number = 0.1) {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log(`\n--- SealForge Agent: Creating content ---`);
  console.log(`Topic: ${topic}`);
  console.log(`Price: ${priceInSUI} SUI`);
  console.log(`Address: ${address}`);

  // Step 1: Create listing
  console.log('\n[1/5] Creating marketplace listing...');
  const priceMist = BigInt(Math.round(priceInSUI * 1_000_000_000));
  const createTx = new Transaction();
  createTx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      createTx.object(marketplaceId),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(topic))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(`Premium AI-generated research report on: ${topic}`))),
      createTx.pure.u64(priceMist),
      createTx.object('0x6'),
    ],
  });

  const createResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: createTx,
    options: { showObjectChanges: true },
  });
  await suiClient.waitForTransaction({ digest: createResult.digest });

  const listingChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ContentListing')
  );
  const capChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ListingCap')
  );
  const listingId = (listingChange as any)?.objectId as string;
  const capId = (capChange as any)?.objectId as string;

  if (!listingId || !capId) throw new Error('Failed to create listing');
  console.log(`  Listing: ${listingId}`);

  // Step 2: Generate content
  console.log('[2/5] Generating premium content...');
  const content = generateContent(topic);
  const contentBytes = new TextEncoder().encode(content);
  console.log(`  Content size: ${contentBytes.length} bytes`);

  // Step 3: Encrypt with Seal
  console.log('[3/5] Encrypting with Seal...');
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);

  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: contentBytes,
  });
  console.log(`  Encrypted size: ${encryptedBytes.length} bytes`);

  // Step 4: Upload to Walrus
  console.log('[4/5] Uploading to Walrus...');
  const blobId = await uploadToWalrus(encryptedBytes);
  console.log(`  Blob ID: ${blobId}`);

  // Step 5: Update listing with blob ID
  console.log('[5/5] Updating listing with blob ID...');
  const updateTx = new Transaction();
  updateTx.moveCall({
    target: `${packageId}::content_marketplace::update_blob_id`,
    arguments: [
      updateTx.object(capId),
      updateTx.object(listingId),
      updateTx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
    ],
  });
  await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: updateTx,
    options: { showEffects: true },
  });

  console.log('\n--- Content Published Successfully ---');
  console.log(`Listing: ${explorerLink('object', listingId)}`);
  console.log(`Walrus Blob: ${blobId}`);
  console.log(`Create Tx: ${explorerLink('tx', createResult.digest)}`);

  return { listingId, capId, blobId, topic };
}

async function main() {
  const topic = process.argv[2] || TOPICS[Math.floor(Math.random() * TOPICS.length)];

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           SealForge Agent — Content Creator             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const result = await createAndListContent(topic);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              CONTENT PUBLISHED                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Agent failed:', err);
  process.exit(1);
});
