/**
 * Backfill AgentTreasury with content creation records and earnings.
 * Run once to populate the Dashboard P&L from on-chain data.
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadDeployedConfig, createSuiClient, loadKeypair } from './config.js';

const config = loadDeployedConfig();
const { packageId, marketplaceId, treasuryId } = config;
if (!treasuryId) throw new Error('No treasuryId in deployed.json');

const suiClient = createSuiClient();
const keypair = loadKeypair();
const address = keypair.getPublicKey().toSuiAddress();

console.log('═══ SealForge Treasury Backfill ═══');
console.log(`Address: ${address}`);
console.log(`Package: ${packageId}`);
console.log(`Treasury: ${treasuryId}`);
console.log(`Marketplace: ${marketplaceId}\n`);

// 1. Get all listing IDs from marketplace
const marketplaceObj = await suiClient.getObject({
  id: marketplaceId,
  options: { showContent: true },
});

const fields = (marketplaceObj.data?.content as any)?.fields;
const listingIds: string[] = fields?.listings ?? [];
console.log(`Found ${listingIds.length} listings\n`);

// 2. Record content_created for each listing
console.log('--- Recording content created ---');
for (const lid of listingIds) {
  const obj = await suiClient.getObject({ id: lid, options: { showContent: true } });
  const lf = (obj.data?.content as any)?.fields;
  if (!lf) continue;

  const title = Buffer.from(lf.title).toString('utf-8');
  console.log(`  Recording: "${title}"`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::agent_treasury::record_content_created`,
    arguments: [
      tx.object(treasuryId),
      tx.pure.vector('u8', Array.from(Buffer.from(title, 'utf-8'))),
      tx.object('0x6'),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  const ok = result.effects?.status?.status === 'success';
  console.log(`    ${ok ? 'OK' : 'FAIL'} (${result.digest})`);

  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 500));
}

// 3. Query purchase events to record earnings
console.log('\n--- Recording earnings from purchases ---');
const events = await suiClient.queryEvents({
  query: {
    MoveEventType: `${packageId}::content_marketplace::ContentPurchased`,
  },
  limit: 50,
});

console.log(`Found ${events.data.length} purchase events`);

for (const evt of events.data) {
  const parsed = evt.parsedJson as any;
  const amount = parsed?.amount ?? parsed?.price ?? '0';
  const listingId = parsed?.listing_id ?? 'unknown';
  console.log(`  Sale: listing ${listingId?.slice(0, 16)}... amount ${Number(amount) / 1e9} SUI`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::agent_treasury::record_earning`,
    arguments: [
      tx.object(treasuryId),
      tx.pure.vector('u8', Array.from(Buffer.from(`Sale: ${listingId}`, 'utf-8'))),
      tx.pure.u64(amount),
      tx.object('0x6'),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  const ok = result.effects?.status?.status === 'success';
  console.log(`    ${ok ? 'OK' : 'FAIL'} (${result.digest})`);

  await new Promise(r => setTimeout(r, 500));
}

// 4. Record some gas spending (approximate)
console.log('\n--- Recording estimated gas spending ---');
const gasPerListing = 10_000_000; // ~0.01 SUI per listing (create + update blob)
const totalGas = listingIds.length * gasPerListing;

const gasTx = new Transaction();
gasTx.moveCall({
  target: `${packageId}::agent_treasury::record_spending`,
  arguments: [
    gasTx.object(treasuryId),
    gasTx.pure.vector('u8', Array.from(Buffer.from(`Gas: ${listingIds.length} listings + Walrus uploads`, 'utf-8'))),
    gasTx.pure.u64(totalGas),
    gasTx.object('0x6'),
  ],
});

const gasResult = await suiClient.signAndExecuteTransaction({
  signer: keypair,
  transaction: gasTx,
  options: { showEffects: true },
});
console.log(`  Recorded ${totalGas / 1e9} SUI gas spending: ${gasResult.effects?.status?.status}`);

// 5. Verify final state
console.log('\n--- Treasury Final State ---');
const treasuryObj = await suiClient.getObject({
  id: treasuryId,
  options: { showContent: true },
});
const tf = (treasuryObj.data?.content as any)?.fields;
if (tf) {
  const earned = Number(tf.total_earned) / 1e9;
  const spent = Number(tf.total_spent) / 1e9;
  console.log(`  Content Created: ${tf.total_content_created}`);
  console.log(`  Total Sales: ${tf.total_sales}`);
  console.log(`  Total Earned: ${earned.toFixed(4)} SUI`);
  console.log(`  Total Spent: ${spent.toFixed(4)} SUI`);
  console.log(`  Net P&L: ${(earned - spent).toFixed(4)} SUI`);
}

console.log('\n═══ Backfill Complete ═══');
