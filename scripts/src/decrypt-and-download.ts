import { writeFileSync } from 'fs';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { EncryptedObject } from '@mysten/seal';
import {
  createSuiClient, createSealClient, downloadFromWalrus,
  loadKeypair, loadDeployedConfig, createSessionKey
} from './config.js';

async function main() {
  const listingObjectId = process.argv[2];
  const outputPath = process.argv[3] || 'decrypted-output.txt';

  if (!listingObjectId) {
    console.error('Usage: tsx decrypt-and-download.ts <listing-id> [output-path]');
    process.exit(1);
  }

  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  // 1. Get the listing to find the blob ID
  const listingObj = await suiClient.getObject({
    id: listingObjectId,
    options: { showContent: true },
  });
  const fields = (listingObj.data?.content as any)?.fields;
  const blobIdBytes: number[] = fields?.walrus_blob_id;
  const blobId = new TextDecoder().decode(new Uint8Array(blobIdBytes));
  console.log('Walrus Blob ID:', blobId);

  // 2. Download encrypted data from Walrus
  console.log('Downloading from Walrus...');
  const encryptedData = await downloadFromWalrus(blobId);
  console.log(`Downloaded ${encryptedData.length} encrypted bytes`);

  // 3. Create a session key for SEAL decryption (backdated for clock skew safety)
  console.log('Creating SEAL session key...');
  const sessionKey = await createSessionKey({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  // 4. Parse encrypted object to extract the id
  const parsed = EncryptedObject.parse(encryptedData);
  // parsed.id is a hex string (from BCS transform), convert to raw bytes
  const idRawBytes = fromHex(parsed.id);
  console.log('Encrypted object ID:', parsed.id);

  // 5. Build the seal_approve transaction for key server validation
  // seal_approve checks listing.buyers or creator via ctx.sender()
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::content_marketplace::seal_approve`,
    arguments: [
      tx.pure.vector('u8', Array.from(idRawBytes)),
      tx.object(listingObjectId),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  // 7. Decrypt
  console.log('Decrypting...');
  const decryptedData = await sealClient.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });

  const decryptedText = new TextDecoder().decode(decryptedData);
  console.log('Decrypted content:', decryptedText.substring(0, 200) + (decryptedText.length > 200 ? '...' : ''));

  // 8. Save to file
  writeFileSync(outputPath, decryptedData);
  console.log(`Full decrypted content saved to: ${outputPath}`);
}

main().catch(console.error);
