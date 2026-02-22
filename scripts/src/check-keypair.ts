import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { readFileSync } from 'fs';
import { join } from 'path';

const home = process.env.USERPROFILE || process.env.HOME || '';
const keystorePath = join(home, '.sui', 'sui_config', 'sui.keystore');

const keystore: string[] = JSON.parse(readFileSync(keystorePath, 'utf-8'));

console.log(`Found ${keystore.length} keys in keystore`);
console.log('Target address: 0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c');
console.log('');

for (let i = 0; i < keystore.length; i++) {
  try {
    // Sui keystore keys are base64-encoded with a scheme flag byte prefix
    const raw = Buffer.from(keystore[i], 'base64');
    const flag = raw[0]; // 0 = ed25519, 1 = secp256k1, 2 = secp256r1
    const secret = raw.slice(1);

    let addr = '';
    if (flag === 0) {
      const kp = Ed25519Keypair.fromSecretKey(secret);
      addr = kp.getPublicKey().toSuiAddress();
    } else if (flag === 1) {
      const kp = Secp256k1Keypair.fromSecretKey(secret);
      addr = kp.getPublicKey().toSuiAddress();
    } else {
      addr = `Unknown scheme: ${flag}`;
    }
    console.log(`Key ${i} (scheme=${flag}): ${addr}`);
  } catch (e: any) {
    console.log(`Key ${i}: Error - ${e.message}`);
  }
}
