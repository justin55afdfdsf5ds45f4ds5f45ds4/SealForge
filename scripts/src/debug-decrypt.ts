import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import { SessionKey, EncryptedObject, SealClient } from '@mysten/seal';
import {
  createSuiClient, createSealClient, uploadToWalrus, downloadFromWalrus,
  loadKeypair, loadDeployedConfig, SEAL_KEY_SERVERS
} from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  // Use the listing from the last pipeline run
  // Let's create a simple test: encrypt and immediately decrypt without Walrus
  console.log('=== Debug Decrypt ===');
  console.log('Address:', address);

  // Step 1: Create a test listing
  console.log('\n1. Creating listing...');
  const createTx = new Transaction();
  createTx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      createTx.object(marketplaceId),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('Debug Test'))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('Debug'))),
      createTx.pure.u64(100_000_000n),
      createTx.object('0x6'),
    ],
  });
  const createResult = await suiClient.signAndExecuteTransaction({
    signer: keypair, transaction: createTx,
    options: { showObjectChanges: true },
  });
  const listingId = (createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ContentListing')
  ) as any)?.objectId;
  console.log('Listing ID:', listingId);

  // Wait for tx to be indexed
  console.log('Waiting for transaction to be indexed...');
  await suiClient.waitForTransaction({ digest: createResult.digest });

  // Step 2: Purchase (so we're a buyer)
  console.log('\n2. Purchasing...');
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
  await suiClient.signAndExecuteTransaction({
    signer: keypair, transaction: purchaseTx,
    options: { showEffects: true },
  });
  console.log('Purchased');

  // Step 3: Encrypt
  console.log('\n3. Encrypting...');
  const content = new TextEncoder().encode('Hello SealForge!');
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);

  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: content,
  });
  console.log('Encrypted:', encryptedBytes.length, 'bytes');

  // Step 4: Parse encrypted object
  const parsed = EncryptedObject.parse(encryptedBytes);
  console.log('Parsed ID:', Buffer.from(parsed.id).toString('hex'));
  console.log('Parsed threshold:', parsed.threshold);
  console.log('Parsed services:', parsed.services.map((s: any) => s[0]));

  // Step 5: Create session key
  console.log('\n4. Creating session key...');
  const sessionKey = await SessionKey.create({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient: suiClient as any,
  });
  console.log('Session key created, expired?', sessionKey.isExpired());

  // Step 6: Build tx - try with onlyTransactionKind first
  console.log('\n5. Building seal_approve tx...');

  // For seal_approve, we pass the listing as the second arg.
  // The caller must be the buyer/creator - but Seal key servers
  // don't execute the tx on-chain, they simulate it.
  // The `ctx` is automatically provided.
  const approveTx = new Transaction();
  approveTx.moveCall({
    target: `${packageId}::content_marketplace::seal_approve`,
    arguments: [
      approveTx.pure.vector('u8', Array.from(parsed.id)),
      approveTx.object(listingId),
    ],
  });

  // Try both formats
  console.log('\n  Trying onlyTransactionKind: true...');
  try {
    const txBytes1 = await approveTx.build({ client: suiClient, onlyTransactionKind: true });
    console.log('  TX bytes (kind only):', txBytes1.length, 'bytes, first byte:', txBytes1[0]);

    const decrypted1 = await sealClient.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes: txBytes1,
    });
    console.log('  SUCCESS with onlyTransactionKind: true');
    console.log('  Decrypted:', new TextDecoder().decode(decrypted1));
    return;
  } catch (e: any) {
    console.log('  FAILED:', e.constructor.name, e.message);
  }

  // Create a new session key since the old one might be "used"
  console.log('\n  Creating new session key for second attempt...');
  const sessionKey2 = await SessionKey.create({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient: suiClient as any,
  });

  console.log('\n  Trying onlyTransactionKind: false...');
  try {
    // Need to set sender for full build
    const approveTx2 = new Transaction();
    approveTx2.setSender(address);
    approveTx2.moveCall({
      target: `${packageId}::content_marketplace::seal_approve`,
      arguments: [
        approveTx2.pure.vector('u8', Array.from(parsed.id)),
        approveTx2.object(listingId),
      ],
    });
    const txBytes2 = await approveTx2.build({ client: suiClient });
    console.log('  TX bytes (full):', txBytes2.length, 'bytes, first byte:', txBytes2[0]);

    const decrypted2 = await sealClient.decrypt({
      data: encryptedBytes,
      sessionKey: sessionKey2,
      txBytes: txBytes2,
    });
    console.log('  SUCCESS with full transaction');
    console.log('  Decrypted:', new TextDecoder().decode(decrypted2));
  } catch (e: any) {
    console.log('  FAILED:', e.constructor.name, e.message);
  }
}

main().catch(console.error);
