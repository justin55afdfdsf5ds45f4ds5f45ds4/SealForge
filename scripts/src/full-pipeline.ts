import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import { EncryptedObject } from '@mysten/seal';
import {
  createSuiClient, createSealClient, uploadToWalrus, downloadFromWalrus,
  loadKeypair, loadDeployedConfig, explorerLink, createSessionKey
} from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        SealForge Full Pipeline Test                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Address:', address);
  console.log('Package:', packageId);
  console.log('Marketplace:', marketplaceId);
  console.log('');

  // === STEP 1: Create Listing ===
  console.log('━━━ Step 1: Create Listing ━━━');
  const createTx = new Transaction();
  const testTitle = 'SealForge Pipeline Test Report';
  const testDesc = 'Automated pipeline verification content';

  createTx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      createTx.object(marketplaceId),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(testTitle))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(testDesc))),
      createTx.pure.u64(100_000_000n), // 0.1 SUI
      createTx.object('0x6'),
    ],
  });

  const createResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: createTx,
    options: { showObjectChanges: true, showEvents: true },
  });

  const listingChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ContentListing')
  );
  const capChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ListingCap')
  );
  const listingId = (listingChange as any)?.objectId as string;
  const capId = (capChange as any)?.objectId as string;

  if (!listingId || !capId) {
    throw new Error('Failed to create listing. Object changes: ' + JSON.stringify(createResult.objectChanges));
  }

  console.log('  Listing ID:', listingId);
  console.log('  Cap ID:', capId);
  console.log('  Tx:', explorerLink('tx', createResult.digest));
  console.log('');

  // === STEP 2: Encrypt content ===
  console.log('━━━ Step 2: Encrypt Content with SEAL ━━━');
  const originalContent = `# ${testTitle}

## Executive Summary
This is a test content piece created by the SealForge full pipeline.
It verifies that the entire create → encrypt → store → purchase → decrypt flow works end-to-end on Sui testnet.

## Key Findings
1. Seal threshold encryption works with Sui Move smart contracts
2. Walrus decentralized storage reliably stores and retrieves encrypted blobs
3. The purchase → decrypt access control flow is verified on-chain

## Conclusion
SealForge pipeline is fully operational.

Generated at: ${new Date().toISOString()}
`;

  const contentBytes = new TextEncoder().encode(originalContent);
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);

  console.log('  Content size:', contentBytes.length, 'bytes');
  console.log('  Encryption ID:', encryptionId);

  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: contentBytes,
  });
  console.log('  Encrypted size:', encryptedBytes.length, 'bytes');
  console.log('');

  // === STEP 3: Upload to Walrus ===
  console.log('━━━ Step 3: Upload to Walrus ━━━');
  const blobId = await uploadToWalrus(encryptedBytes);
  console.log('  Blob ID:', blobId);
  console.log('');

  // Wait for listing to be indexed
  await suiClient.waitForTransaction({ digest: createResult.digest });

  // === STEP 4: Update listing with blob ID ===
  console.log('━━━ Step 4: Update Listing with Blob ID ━━━');
  const updateTx = new Transaction();
  updateTx.moveCall({
    target: `${packageId}::content_marketplace::update_blob_id`,
    arguments: [
      updateTx.object(capId),
      updateTx.object(listingId),
      updateTx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
    ],
  });

  const updateResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: updateTx,
    options: { showEffects: true },
  });
  console.log('  Updated. Tx:', explorerLink('tx', updateResult.digest));
  console.log('');

  // Wait for update to be indexed
  await suiClient.waitForTransaction({ digest: updateResult.digest });

  // === STEP 5: Purchase (self-purchase for testing) ===
  console.log('━━━ Step 5: Purchase Listing ━━━');
  const purchaseTx = new Transaction();
  const [coin] = purchaseTx.splitCoins(purchaseTx.gas, [purchaseTx.pure.u64(100_000_000n)]);
  purchaseTx.moveCall({
    target: `${packageId}::content_marketplace::purchase`,
    arguments: [
      purchaseTx.object(marketplaceId),
      purchaseTx.object(listingId),
      coin,
      purchaseTx.object('0x6'),
    ],
  });

  const purchaseResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: purchaseTx,
    options: { showObjectChanges: true, showEvents: true },
  });
  console.log('  Purchased. Tx:', explorerLink('tx', purchaseResult.digest));
  console.log('');

  // Wait for purchase to be indexed
  await suiClient.waitForTransaction({ digest: purchaseResult.digest });

  // === STEP 6: Download and decrypt ===
  console.log('━━━ Step 6: Download from Walrus & Decrypt with SEAL ━━━');

  // Download
  const downloadedEncrypted = await downloadFromWalrus(blobId);
  console.log('  Downloaded:', downloadedEncrypted.length, 'bytes');

  // Parse the encrypted object to get the id
  const parsed = EncryptedObject.parse(downloadedEncrypted);

  // Create session key (backdated to handle clock skew with key servers)
  console.log('  Creating session key...');
  const sessionKey = await createSessionKey({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  // Build seal_approve tx for key server validation
  // parsed.id is a hex string (from BCS transform), must convert to raw bytes
  const idRawBytes = fromHex(parsed.id);
  const approveTx = new Transaction();
  approveTx.moveCall({
    target: `${packageId}::content_marketplace::seal_approve`,
    arguments: [
      approveTx.pure.vector('u8', Array.from(idRawBytes)),
      approveTx.object(listingId),
    ],
  });
  const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

  // Decrypt
  console.log('  Decrypting...');
  const decryptedData = await sealClient.decrypt({
    data: downloadedEncrypted,
    sessionKey,
    txBytes,
  });

  const decryptedText = new TextDecoder().decode(decryptedData);
  console.log('');

  // === STEP 7: Verify ===
  console.log('━━━ Step 7: Verify ━━━');
  const originalText = new TextDecoder().decode(contentBytes);
  const match = decryptedText === originalText;

  console.log('  Original length:', originalText.length);
  console.log('  Decrypted length:', decryptedText.length);
  console.log('  Content match:', match ? 'YES ✓' : 'NO ✗');
  console.log('');

  if (!match) {
    console.error('PIPELINE FAILED: Decrypted content does not match original!');
    process.exit(1);
  }

  // === Summary ===
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                  PIPELINE PASSED                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Listing ID:', listingId);
  console.log('Cap ID:', capId);
  console.log('Walrus Blob ID:', blobId);
  console.log('');
  console.log('SuiScan Links:');
  console.log('  Listing:', explorerLink('object', listingId));
  console.log('  Marketplace:', explorerLink('object', marketplaceId));
  console.log('  Create Tx:', explorerLink('tx', createResult.digest));
  console.log('  Purchase Tx:', explorerLink('tx', purchaseResult.digest));
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
