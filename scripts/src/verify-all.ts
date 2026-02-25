import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import { EncryptedObject } from '@mysten/seal';
import {
  createSuiClient, createSealClient, uploadToWalrus, downloadFromWalrus,
  loadKeypair, loadDeployedConfig, explorerLink, createSessionKey
} from './config.js';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId, treasuryId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           SealForge Verify-All Sanity Check             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Address:', address);
  console.log('Package:', packageId);
  console.log('Marketplace:', marketplaceId);
  if (treasuryId) console.log('Treasury:', treasuryId);
  console.log('');

  // === CHECK 1: Marketplace exists on-chain ===
  console.log('━━━ Check 1: Marketplace Object ━━━');
  try {
    const mktObj = await suiClient.getObject({
      id: marketplaceId,
      options: { showContent: true, showType: true },
    });
    check('Marketplace exists', !!mktObj.data);
    check('Marketplace type', (mktObj.data?.type || '').includes('Marketplace'));
    const fields = (mktObj.data?.content as any)?.fields;
    if (fields) {
      console.log(`    Total listings: ${fields.total_listings}`);
      console.log(`    Total sales: ${fields.total_sales}`);
    }
  } catch (err: any) {
    check('Marketplace exists', false, err.message);
  }
  console.log('');

  // === CHECK 2: AgentTreasury (if deployed) ===
  console.log('━━━ Check 2: Agent Treasury ━━━');
  if (treasuryId) {
    try {
      const tObj = await suiClient.getObject({
        id: treasuryId,
        options: { showContent: true },
      });
      check('Treasury exists', !!tObj.data);
      const fields = (tObj.data?.content as any)?.fields;
      if (fields) {
        console.log(`    Total earned: ${fields.total_earned}`);
        console.log(`    Total spent: ${fields.total_spent}`);
        console.log(`    Content created: ${fields.total_content_created}`);
        console.log(`    Total sales: ${fields.total_sales}`);
      }
    } catch (err: any) {
      check('Treasury exists', false, err.message);
    }
  } else {
    console.log('  [SKIP] No treasury ID in deployed.json');
  }
  console.log('');

  // === CHECK 3: Wallet balance ===
  console.log('━━━ Check 3: Wallet Balance ━━━');
  try {
    const balance = await suiClient.getBalance({ owner: address });
    const balanceSUI = Number(balance.totalBalance) / 1_000_000_000;
    check('Has SUI balance', balanceSUI > 0, `${balanceSUI.toFixed(4)} SUI`);
    if (balanceSUI < 0.2) {
      console.log('  [WARN] Low balance — may not be enough for full pipeline test');
    }
  } catch (err: any) {
    check('Has SUI balance', false, err.message);
  }
  console.log('');

  // === CHECK 4: End-to-end pipeline (create → encrypt → upload → purchase → decrypt) ===
  console.log('━━━ Check 4: Full Pipeline Test ━━━');
  let pipelineListingId = '';
  let pipelineCapId = '';
  let pipelineBlobId = '';

  try {
    // Create listing
    console.log('  Creating test listing...');
    const createTx = new Transaction();
    const testTitle = 'Verify-All Sanity Check';
    const testDesc = 'Automated pre-demo verification';

    createTx.moveCall({
      target: `${packageId}::content_marketplace::create_listing`,
      arguments: [
        createTx.object(marketplaceId),
        createTx.pure.vector('u8', Array.from(new TextEncoder().encode(testTitle))),
        createTx.pure.vector('u8', Array.from(new TextEncoder().encode(testDesc))),
        createTx.pure.vector('u8', Array.from(new TextEncoder().encode('blue-data'))),
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
    const capChange = createResult.objectChanges?.find(
      (c) => c.type === 'created' && (c as any).objectType?.includes('ListingCap')
    );
    pipelineListingId = (listingChange as any)?.objectId as string;
    pipelineCapId = (capChange as any)?.objectId as string;

    check('Create listing', !!pipelineListingId, pipelineListingId);

    // Encrypt
    console.log('  Encrypting content with SEAL...');
    const originalContent = `Sanity check content — ${new Date().toISOString()}`;
    const contentBytes = new TextEncoder().encode(originalContent);
    const nonce = crypto.getRandomValues(new Uint8Array(5));
    const listingIdBytes = fromHex(pipelineListingId.replace('0x', ''));
    const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
    const encryptionId = toHex(idBytes);

    const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
      threshold: 2,
      packageId,
      id: encryptionId,
      data: contentBytes,
    });
    check('SEAL encrypt', encryptedBytes.length > 0, `${encryptedBytes.length} bytes`);

    // Upload to Walrus
    console.log('  Uploading to Walrus...');
    pipelineBlobId = await uploadToWalrus(encryptedBytes);
    check('Walrus upload', !!pipelineBlobId, pipelineBlobId);

    // Update listing
    console.log('  Updating listing with blob ID...');
    const updateTx = new Transaction();
    updateTx.moveCall({
      target: `${packageId}::content_marketplace::update_blob_id`,
      arguments: [
        updateTx.object(pipelineCapId),
        updateTx.object(pipelineListingId),
        updateTx.pure.vector('u8', Array.from(new TextEncoder().encode(pipelineBlobId))),
      ],
    });
    const updateResult = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: updateTx,
      options: { showEffects: true },
    });
    await suiClient.waitForTransaction({ digest: updateResult.digest });
    check('Update blob ID', true);

    // Purchase
    console.log('  Purchasing listing...');
    const purchaseTx = new Transaction();
    const [coin] = purchaseTx.splitCoins(purchaseTx.gas, [purchaseTx.pure.u64(100_000_000n)]);
    purchaseTx.moveCall({
      target: `${packageId}::content_marketplace::purchase`,
      arguments: [
        purchaseTx.object(marketplaceId),
        purchaseTx.object(pipelineListingId),
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
    check('Purchase listing', true);

    // Download + Decrypt
    console.log('  Downloading from Walrus...');
    const downloadedEncrypted = await downloadFromWalrus(pipelineBlobId);
    check('Walrus download', downloadedEncrypted.length > 0, `${downloadedEncrypted.length} bytes`);

    const parsed = EncryptedObject.parse(downloadedEncrypted);
    const idRawBytes = fromHex(parsed.id);

    console.log('  Creating session key...');
    const sessionKey = await createSessionKey({
      address,
      packageId,
      ttlMin: 10,
      signer: keypair,
      suiClient,
    });

    const approveTx = new Transaction();
    approveTx.moveCall({
      target: `${packageId}::content_marketplace::seal_approve`,
      arguments: [
        approveTx.pure.vector('u8', Array.from(idRawBytes)),
        approveTx.object(pipelineListingId),
      ],
    });
    const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

    console.log('  Decrypting with SEAL...');
    const decryptedData = await sealClient.decrypt({
      data: downloadedEncrypted,
      sessionKey,
      txBytes,
    });

    const decryptedText = new TextDecoder().decode(decryptedData);
    const contentMatch = decryptedText === originalContent;
    check('SEAL decrypt + verify', contentMatch, contentMatch ? 'content matches' : 'MISMATCH');

  } catch (err: any) {
    check('Pipeline step', false, err.message);
  }
  console.log('');

  // === CHECK 5: Query on-chain events ===
  console.log('━━━ Check 5: On-Chain Events ━━━');
  try {
    const events = await suiClient.queryEvents({
      query: { MoveModule: { package: packageId, module: 'content_marketplace' } },
      limit: 5,
      order: 'descending',
    });
    check('Events queryable', events.data.length > 0, `${events.data.length} recent events`);
    for (const ev of events.data.slice(0, 3)) {
      const evType = ev.type.split('::').pop();
      console.log(`    ${evType} — tx: ${ev.id.txDigest.slice(0, 12)}...`);
    }
  } catch (err: any) {
    check('Events queryable', false, err.message);
  }
  console.log('');

  // === SUMMARY ===
  console.log('╔══════════════════════════════════════════════════════════╗');
  if (failed === 0) {
    console.log('║          ALL CHECKS PASSED                              ║');
  } else {
    console.log(`║          ${failed} CHECK(S) FAILED                              ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('');
  if (pipelineListingId) {
    console.log('Test Objects:');
    console.log('  Listing:', explorerLink('object', pipelineListingId));
    if (pipelineBlobId) console.log('  Walrus Blob:', pipelineBlobId);
  }
  console.log('');
  console.log('Package:', explorerLink('object', packageId));
  console.log('Marketplace:', explorerLink('object', marketplaceId));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verify-all failed:', err);
  process.exit(1);
});
