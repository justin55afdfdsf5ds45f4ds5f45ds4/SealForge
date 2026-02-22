import { Transaction } from '@mysten/sui/transactions';
import { createSuiClient, loadKeypair, loadDeployedConfig, explorerLink } from './config.js';

async function main() {
  const listingObjectId = process.argv[2];
  const capObjectId = process.argv[3];
  const blobId = process.argv[4];

  if (!listingObjectId || !capObjectId || !blobId) {
    console.error('Usage: tsx update-listing.ts <listing-id> <cap-id> <blob-id>');
    process.exit(1);
  }

  const suiClient = createSuiClient();
  const keypair = loadKeypair();
  const { packageId } = loadDeployedConfig();

  console.log(`Updating listing ${listingObjectId} with blob ID: ${blobId}`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::content_marketplace::update_blob_id`,
    arguments: [
      tx.object(capObjectId),
      tx.object(listingObjectId),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });

  console.log('Updated listing. Digest:', result.digest);
  console.log('Explorer:', explorerLink('tx', result.digest));
}

main().catch(console.error);
