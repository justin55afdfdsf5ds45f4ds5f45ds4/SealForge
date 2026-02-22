import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import { SessionKey, EncryptedObject } from '@mysten/seal';
import {
  createSuiClient, createSealClient, loadKeypair, loadDeployedConfig, SEAL_KEY_SERVERS
} from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log('Address:', address);
  console.log('Package:', packageId);

  // Step 1: Create a listing
  console.log('\n--- Creating listing ---');
  const createTx = new Transaction();
  createTx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      createTx.object(marketplaceId),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('Debug Test'))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('Debug description'))),
      createTx.pure.u64(100_000_000n),
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
  const listingId = (listingChange as any)?.objectId as string;
  console.log('Listing ID:', listingId);

  // Step 2: Encrypt
  console.log('\n--- Encrypting ---');
  const content = new TextEncoder().encode('Hello World debug test');
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);
  console.log('Encryption ID:', encryptionId);

  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: content,
  });
  console.log('Encrypted size:', encryptedBytes.length);

  // Step 3: Purchase (self-buy)
  console.log('\n--- Purchasing ---');
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
    options: { showEffects: true },
  });
  await suiClient.waitForTransaction({ digest: purchaseResult.digest });
  console.log('Purchase status:', (purchaseResult as any).effects?.status?.status);

  // Step 4: Parse encrypted object and build seal_approve tx
  console.log('\n--- Preparing decrypt ---');
  const parsed = EncryptedObject.parse(encryptedBytes);
  console.log('Parsed ID (hex string):', parsed.id);
  console.log('Parsed ID type:', typeof parsed.id);

  const idRawBytes = fromHex(parsed.id);
  console.log('ID raw bytes length:', idRawBytes.length);
  console.log('ID raw bytes (first 32):', toHex(idRawBytes.slice(0, 32)));
  console.log('Listing ID bytes:', listingId.replace('0x', ''));
  console.log('ID starts with listing?', toHex(idRawBytes.slice(0, 32)) === listingId.replace('0x', '').toLowerCase());

  // Step 5: Create session key
  console.log('\n--- Creating session key ---');
  const sessionKey = await SessionKey.create({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });
  console.log('Session key created, expired?', sessionKey.isExpired());

  // Get certificate to inspect
  const cert = await sessionKey.getCertificate();
  console.log('Certificate user:', cert.user);
  console.log('Certificate creation_time:', cert.creation_time);
  console.log('Certificate ttl_min:', cert.ttl_min);
  console.log('Certificate has signature:', !!cert.signature);
  console.log('Current time:', Date.now());
  console.log('Time diff (ms):', Date.now() - cert.creation_time);

  // Step 6: Build tx bytes
  const approveTx = new Transaction();
  approveTx.moveCall({
    target: `${packageId}::content_marketplace::seal_approve`,
    arguments: [
      approveTx.pure.vector('u8', Array.from(idRawBytes)),
      approveTx.object(listingId),
    ],
  });

  // Try building with onlyTransactionKind: true
  const txBytesKind = await approveTx.build({ client: suiClient, onlyTransactionKind: true });
  console.log('\ntxBytes (onlyTransactionKind=true) length:', txBytesKind.length);
  console.log('txBytes first 4 bytes:', Array.from(txBytesKind.slice(0, 4)));

  // Step 7: Manually call key server to see full error
  console.log('\n--- Manually calling key server ---');
  const keyServers = await sealClient.getKeyServers();
  console.log('Key servers:', [...keyServers.keys()]);

  for (const [objectId, server] of keyServers) {
    console.log(`\nCalling server ${(server as any).name || objectId}:`);
    console.log('  URL:', (server as any).url);

    const requestParams = await sessionKey.createRequestParams(txBytesKind);

    const body = {
      ptb: Buffer.from(txBytesKind.slice(1)).toString('base64'),
      enc_key: Buffer.from(requestParams.encKeyPk).toString('base64'),
      enc_verification_key: Buffer.from(requestParams.encVerificationKey).toString('base64'),
      request_signature: requestParams.requestSignature,
      certificate: cert,
    };

    try {
      const requestId = crypto.randomUUID();
      const response = await fetch((server as any).url + '/v1/fetch_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Request-Id': requestId,
          'Client-Sdk-Type': 'typescript',
          'Client-Sdk-Version': '0.6.0',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      console.log('  Status:', response.status);
      const text = await response.text();
      console.log('  Response:', text.substring(0, 500));
    } catch (err: any) {
      console.log('  Error:', err.message);
    }
  }

  // Also try with full tx build (not just kind)
  console.log('\n--- Also trying with full tx build ---');
  const approveTx2 = new Transaction();
  approveTx2.moveCall({
    target: `${packageId}::content_marketplace::seal_approve`,
    arguments: [
      approveTx2.pure.vector('u8', Array.from(idRawBytes)),
      approveTx2.object(listingId),
    ],
  });
  const txBytesFull = await approveTx2.build({ client: suiClient });
  console.log('txBytes (full) length:', txBytesFull.length);
  console.log('txBytes first 4 bytes:', Array.from(txBytesFull.slice(0, 4)));

  // Try with full tx bytes
  for (const [objectId, server] of keyServers) {
    console.log(`\nCalling server ${(server as any).name || objectId} with full tx:`);
    const requestParams2 = await sessionKey.createRequestParams(txBytesFull);

    const body2 = {
      ptb: Buffer.from(txBytesFull.slice(1)).toString('base64'),
      enc_key: Buffer.from(requestParams2.encKeyPk).toString('base64'),
      enc_verification_key: Buffer.from(requestParams2.encVerificationKey).toString('base64'),
      request_signature: requestParams2.requestSignature,
      certificate: cert,
    };

    try {
      const requestId = crypto.randomUUID();
      const response = await fetch((server as any).url + '/v1/fetch_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Request-Id': requestId,
          'Client-Sdk-Type': 'typescript',
          'Client-Sdk-Version': '0.6.0',
        },
        body: JSON.stringify(body2),
        signal: AbortSignal.timeout(15000),
      });

      console.log('  Status:', response.status);
      const text = await response.text();
      console.log('  Response:', text.substring(0, 500));
    } catch (err: any) {
      console.log('  Error:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
