/**
 * Create the AgentTreasury object on-chain (call once after deploy).
 */
import { Transaction } from '@mysten/sui/transactions';
import { createSuiClient, loadKeypair, loadDeployedConfig, saveDeployedConfig, explorerLink } from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const keypair = loadKeypair();
  const config = loadDeployedConfig();
  const { packageId } = config;

  if (config.treasuryId) {
    console.log(`Treasury already exists: ${explorerLink('object', config.treasuryId)}`);
    return;
  }

  console.log('Creating AgentTreasury...');
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::agent_treasury::create_treasury`,
    arguments: [
      tx.pure.vector('u8', Array.from(new TextEncoder().encode('SealForge Agent v1.0'))),
      tx.object('0x6'), // Clock
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showObjectChanges: true },
  });
  await suiClient.waitForTransaction({ digest: result.digest });

  const treasuryChange = result.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('AgentTreasury')
  );
  const treasuryId = (treasuryChange as any)?.objectId as string;

  if (!treasuryId) {
    console.error('Object changes:', JSON.stringify(result.objectChanges, null, 2));
    throw new Error('Failed to find AgentTreasury in object changes');
  }

  config.treasuryId = treasuryId;
  saveDeployedConfig(config);

  console.log(`AgentTreasury created: ${explorerLink('object', treasuryId)}`);
  console.log(`Tx: ${explorerLink('tx', result.digest)}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
