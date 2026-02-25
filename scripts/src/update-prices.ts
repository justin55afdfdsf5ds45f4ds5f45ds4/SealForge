/**
 * Update all visible listing prices to 0.0001 SUI (100000 MIST).
 * Requires the upgraded package with update_price function.
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadDeployedConfig, createSuiClient, loadKeypair } from './config.js';

const config = loadDeployedConfig();
const suiClient = createSuiClient();
const keypair = loadKeypair();
const address = keypair.getPublicKey().toSuiAddress();

// The upgraded package ID (from sui client upgrade output)
const UPGRADED_PACKAGE_ID = '0x40958d064d81d42379f11d0d5d9e81f96efe698f63f801b28038d2185409e4e2';

// New price: 0.0001 SUI = 100,000 MIST
const NEW_PRICE = 100_000;

// Hidden listing IDs (skip these)
const HIDDEN = new Set([
  '0x40f00773a16034029c08391f37eff3b58ead96fe4b6553d89e85c58a5daef645',
  '0xdcfb0cd27c1776ac2ccd90135072de05c324cd4754787a27b7736391d7382e4a',
  '0x4969218e3d459a272e4b6907c366777f0686ff166bac13a58c59753820114e72',
  '0x30c8d19cfc64495c39e27c8b897a72da1ed93e637dac61a6ebfb2fdd1e71f402',
]);

console.log('═══ Update Listing Prices ═══');
console.log(`Address: ${address}`);
console.log(`New price: ${NEW_PRICE / 1e9} SUI (${NEW_PRICE} MIST)\n`);

// 1. Get marketplace listings
const mpObj = await suiClient.getObject({
  id: config.marketplaceId,
  options: { showContent: true },
});
const mpFields = (mpObj.data?.content as any)?.fields;
const allListingIds: string[] = mpFields?.listings ?? [];
const visibleListings = allListingIds.filter(id => !HIDDEN.has(id));

console.log(`Found ${visibleListings.length} visible listings\n`);

// 2. Find all ListingCaps owned by this address (from current package)
const ownedObjects = await suiClient.getOwnedObjects({
  owner: address,
  filter: {
    StructType: `${config.packageId}::content_marketplace::ListingCap`,
  },
  options: { showContent: true },
  limit: 50,
});

// Build a map: listing_id -> cap_id
const capMap = new Map<string, string>();
for (const obj of ownedObjects.data) {
  const capFields = (obj.data?.content as any)?.fields;
  if (capFields?.listing_id) {
    capMap.set(capFields.listing_id, obj.data!.objectId);
  }
}

console.log(`Found ${capMap.size} ListingCaps\n`);

// 3. Update price for each visible listing
for (const listingId of visibleListings) {
  const capId = capMap.get(listingId);
  if (!capId) {
    console.log(`  SKIP: No cap found for ${listingId.slice(0, 16)}...`);
    continue;
  }

  // Get current title for display
  const listingObj = await suiClient.getObject({ id: listingId, options: { showContent: true } });
  const lf = (listingObj.data?.content as any)?.fields;
  const title = lf ? Buffer.from(lf.title).toString('utf-8') : 'Unknown';
  const oldPrice = lf ? Number(lf.price) / 1e9 : 0;

  console.log(`  Updating: "${title}"`);
  console.log(`    ${oldPrice} SUI → ${NEW_PRICE / 1e9} SUI`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${UPGRADED_PACKAGE_ID}::content_marketplace::update_price`,
    arguments: [
      tx.object(capId),
      tx.object(listingId),
      tx.pure.u64(NEW_PRICE),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  const ok = result.effects?.status?.status === 'success';
  console.log(`    ${ok ? 'OK' : 'FAIL'} (${result.digest})\n`);

  await new Promise(r => setTimeout(r, 300));
}

console.log('═══ Done ═══');
