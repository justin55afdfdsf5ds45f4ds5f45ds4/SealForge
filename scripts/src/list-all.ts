import { createSuiClient, loadDeployedConfig } from './config.js';

async function main() {
  const client = createSuiClient();
  const { marketplaceId } = loadDeployedConfig();

  const marketplace = await client.getObject({ id: marketplaceId, options: { showContent: true } });
  const listings: string[] = (marketplace.data?.content as any)?.fields?.listings ?? [];

  console.log(`Total listings: ${listings.length}\n`);
  console.log('ID                | Price    | Blob    | Title');
  console.log('------------------|----------|---------|------');

  for (const id of listings) {
    const obj = await client.getObject({ id, options: { showContent: true } });
    const f = (obj.data?.content as any)?.fields;
    if (!f) { console.log(`${id.slice(0,16)}... | ERROR`); continue; }
    const title = new TextDecoder().decode(new Uint8Array(f.title));
    const hasBlob = f.walrus_blob_id?.length > 0;
    const price = (Number(f.price) / 1e9).toFixed(3);
    console.log(`${id.slice(0,16)}... | ${price.padStart(8)} | ${hasBlob ? 'YES    ' : 'EMPTY  '} | ${title}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
