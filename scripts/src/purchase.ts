import { Transaction } from '@mysten/sui/transactions';
import { createSuiClient, loadKeypair, loadDeployedConfig, explorerLink } from './config.js';

async function main() {
  const listingObjectId = process.argv[2];

  if (!listingObjectId) {
    console.error('Usage: tsx purchase.ts <listing-object-id>');
    process.exit(1);
  }

  const suiClient = createSuiClient();
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();

  // Get the listing to find the price
  const listingObj = await suiClient.getObject({
    id: listingObjectId,
    options: { showContent: true },
  });

  const fields = (listingObj.data?.content as any)?.fields;
  const price = BigInt(fields?.price || '0');
  console.log(`Listing price: ${price} MIST (${Number(price) / 1_000_000_000} SUI)`);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(price)]);

  tx.moveCall({
    target: `${packageId}::content_marketplace::purchase`,
    arguments: [
      tx.object(marketplaceId),
      tx.object(listingObjectId),
      coin,
      tx.object('0x6'), // Clock
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });

  console.log('Purchase transaction digest:', result.digest);
  console.log('Explorer:', explorerLink('tx', result.digest));

  if (result.events) {
    for (const event of result.events) {
      console.log('Event:', event.type, JSON.stringify(event.parsedJson));
    }
  }
}

main().catch(console.error);
