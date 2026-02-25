/**
 * Checklist Step 1: Verify all contracts exist on-chain
 */
import { createSuiClient, loadDeployedConfig, explorerLink } from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const config = loadDeployedConfig();
  let pass = 0;
  let fail = 0;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         Step 1: Contracts On-Chain Check                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Check 1: Package has 2 modules
  console.log('\n--- Check 1: Package Modules ---');
  try {
    const modules = await suiClient.getNormalizedMoveModulesByPackage({ package: config.packageId });
    const moduleNames = Object.keys(modules);
    console.log(`  Modules: ${moduleNames.join(', ')}`);
    if (moduleNames.includes('content_marketplace') && moduleNames.includes('agent_treasury')) {
      console.log('  [PASS] Both modules found');
      pass++;
    } else {
      console.log('  [FAIL] Missing modules');
      fail++;
    }
  } catch (e: any) {
    console.log(`  [FAIL] ${e.message}`);
    fail++;
  }

  // Check 2: Marketplace shared object
  console.log('\n--- Check 2: Marketplace Object ---');
  try {
    const obj = await suiClient.getObject({ id: config.marketplaceId, options: { showContent: true, showType: true } });
    const type = obj.data?.type ?? '';
    const fields = (obj.data?.content as any)?.fields;
    console.log(`  Type: ${type}`);
    console.log(`  total_listings: ${fields?.total_listings}`);
    console.log(`  total_sales: ${fields?.total_sales}`);
    console.log(`  listings count: ${fields?.listings?.length ?? 0}`);
    if (type.includes('Marketplace')) {
      console.log('  [PASS] Marketplace exists');
      pass++;
    } else {
      console.log('  [FAIL] Wrong type');
      fail++;
    }
  } catch (e: any) {
    console.log(`  [FAIL] ${e.message}`);
    fail++;
  }

  // Check 3: AgentTreasury object
  console.log('\n--- Check 3: AgentTreasury Object ---');
  if (!config.treasuryId) {
    console.log('  [FAIL] No treasuryId in deployed.json');
    fail++;
  } else {
    try {
      const obj = await suiClient.getObject({ id: config.treasuryId, options: { showContent: true, showType: true } });
      const type = obj.data?.type ?? '';
      const fields = (obj.data?.content as any)?.fields;
      const agentName = fields?.agent_name ? new TextDecoder().decode(new Uint8Array(fields.agent_name)) : 'unknown';
      console.log(`  Type: ${type}`);
      console.log(`  agent_name: ${agentName}`);
      console.log(`  total_earned: ${fields?.total_earned}`);
      console.log(`  total_spent: ${fields?.total_spent}`);
      console.log(`  total_content_created: ${fields?.total_content_created}`);
      console.log(`  total_sales: ${fields?.total_sales}`);
      if (type.includes('AgentTreasury')) {
        console.log('  [PASS] AgentTreasury exists');
        pass++;
      } else {
        console.log('  [FAIL] Wrong type');
        fail++;
      }
    } catch (e: any) {
      console.log(`  [FAIL] ${e.message}`);
      fail++;
    }
  }

  // Check 4: Agent wallet balance
  console.log('\n--- Check 4: Agent Wallet Balance ---');
  try {
    const balance = await suiClient.getBalance({ owner: '0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c' });
    const sui = Number(balance.totalBalance) / 1_000_000_000;
    console.log(`  Balance: ${sui.toFixed(4)} SUI`);
    if (sui > 0) {
      console.log('  [PASS] Has SUI balance');
      pass++;
    } else {
      console.log('  [FAIL] Zero balance');
      fail++;
    }
  } catch (e: any) {
    console.log(`  [FAIL] ${e.message}`);
    fail++;
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Step 1 Result: ${pass} passed, ${fail} failed${' '.repeat(28 - String(pass).length - String(fail).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log(`\nSuiScan Links:`);
  console.log(`  Package:    ${explorerLink('object', config.packageId)}`);
  console.log(`  Marketplace: ${explorerLink('object', config.marketplaceId)}`);
  if (config.treasuryId) console.log(`  Treasury:   ${explorerLink('object', config.treasuryId)}`);

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
