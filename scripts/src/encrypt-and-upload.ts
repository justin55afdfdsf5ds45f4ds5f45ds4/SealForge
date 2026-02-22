import { readFileSync } from 'fs';
import { fromHex, toHex } from '@mysten/sui/utils';
import {
  createSuiClient, createSealClient, uploadToWalrus,
  loadKeypair, loadDeployedConfig, explorerLink
} from './config.js';

async function main() {
  const contentOrFile = process.argv[2];
  const listingObjectId = process.argv[3];

  if (!contentOrFile || !listingObjectId) {
    console.error('Usage: tsx encrypt-and-upload.ts <content-or-file-path> <listing-object-id>');
    process.exit(1);
  }

  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const { packageId } = loadDeployedConfig();

  // Determine if input is a file path or raw content
  let contentBytes: Uint8Array;
  try {
    contentBytes = new Uint8Array(readFileSync(contentOrFile));
    console.log(`Read file: ${contentOrFile} (${contentBytes.length} bytes)`);
  } catch {
    contentBytes = new TextEncoder().encode(contentOrFile);
    console.log(`Using raw content (${contentBytes.length} bytes)`);
  }

  // Construct encryption ID: [listing_object_id_bytes][5-byte-nonce]
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingObjectId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);

  console.log('Encryption ID:', encryptionId);
  console.log('Package ID:', packageId);

  // Encrypt with SEAL
  console.log('Encrypting with SEAL...');
  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: contentBytes,
  });

  console.log(`Encrypted: ${encryptedBytes.length} bytes`);

  // Upload to Walrus
  console.log('Uploading to Walrus...');
  const blobId = await uploadToWalrus(encryptedBytes);

  console.log('Walrus Blob ID:', blobId);
  console.log('');
  console.log('Next step: update the listing with this blob ID:');
  console.log(`  npm run update-listing -- <listing-id> <cap-id> ${blobId}`);
}

main().catch(console.error);
