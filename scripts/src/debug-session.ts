import { SessionKey } from '@mysten/seal';
import { createSuiClient, createSealClient, loadKeypair, loadDeployedConfig } from './config.js';

async function main() {
  const suiClient = createSuiClient();
  const keypair = loadKeypair();
  const { packageId } = loadDeployedConfig();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log('Address:', address);
  console.log('Package:', packageId);
  console.log('Has signPersonalMessage:', typeof keypair.signPersonalMessage);

  try {
    console.log('\nCreating session key...');
    const sessionKey = await SessionKey.create({
      address,
      packageId,
      ttlMin: 10,
      signer: keypair,
      suiClient: suiClient as any,
    });
    console.log('Session key created');
    console.log('Expired?', sessionKey.isExpired());

    // Test signing a personal message
    const testMsg = new TextEncoder().encode('test message');
    const { signature } = await keypair.signPersonalMessage(testMsg);
    console.log('Personal message signature works:', !!signature);

    // Get certificate
    const cert = await sessionKey.getCertificate();
    console.log('Certificate:', JSON.stringify(cert, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

main().catch(console.error);
