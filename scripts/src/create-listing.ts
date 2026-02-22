import { Transaction } from '@mysten/sui/transactions';
import { createSuiClient, loadKeypair, loadDeployedConfig, explorerLink } from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();

  const title = process.argv[2] || 'Premium AI Research Report';
  const description = process.argv[3] || 'In-depth analysis created by SealForge AI agent';
  const priceInSui = parseFloat(process.argv[4] || '0.1');
  const priceInMist = BigInt(Math.floor(priceInSui * 1_000_000_000));

  console.log(`Creating listing: "${title}" at ${priceInSui} SUI`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      tx.object(marketplaceId),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(title))),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(description))),
      tx.pure.u64(priceInMist),
      tx.object('0x6'), // Clock
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });

  console.log('Transaction digest:', result.digest);
  console.log('Explorer:', explorerLink('tx', result.digest));

  // Extract created object IDs
  const listingCreated = result.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ContentListing')
  );
  const capCreated = result.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ListingCap')
  );

  if (listingCreated && 'objectId' in listingCreated) {
    console.log('Listing ID:', listingCreated.objectId);
    console.log('Listing Explorer:', explorerLink('object', listingCreated.objectId));
  }
  if (capCreated && 'objectId' in capCreated) {
    console.log('ListingCap ID:', (capCreated as any).objectId);
  }

  if (result.events) {
    for (const event of result.events) {
      console.log('Event:', event.type, JSON.stringify(event.parsedJson));
    }
  }
}

main().catch(console.error);
