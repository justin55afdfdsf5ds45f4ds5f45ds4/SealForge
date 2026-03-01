import { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient, SessionKey } from '@mysten/seal';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// NETWORK CONFIG
// ============================================================
export const NETWORK = 'testnet' as const;
export const SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';

// ============================================================
// PATHS
// ============================================================
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, '..', 'deployed.json');

// ============================================================
// DEPLOYED CONFIG
// ============================================================
export interface DeployedConfig {
  packageId: string;
  marketplaceId: string;
  treasuryId?: string;
}

export function loadDeployedConfig(): DeployedConfig {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(`No deployed.json found at ${CONFIG_FILE}. Deploy contracts first.`);
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

export function saveDeployedConfig(config: DeployedConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`Saved deployed config to ${CONFIG_FILE}`);
}

// ============================================================
// CLIENTS
// ============================================================
export function createSuiClient(): SuiClient {
  return new SuiClient({ url: SUI_RPC_URL });
}

// Verified Seal key servers for testnet (from https://seal-docs.wal.app/Pricing)
// Using Mysten Labs servers + community servers for 2-of-N threshold
export const SEAL_KEY_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', // mysten-testnet-1
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', // mysten-testnet-2
];

export function createSealClient(suiClient: SuiClient): SealClient {
  return new SealClient({
    suiClient: suiClient as any,
    serverConfigs: SEAL_KEY_SERVERS.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });
}

// ============================================================
// WALRUS CONFIG
// ============================================================
export const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_EPOCHS = 10; // Must survive through judging (March 3+)

export async function uploadToWalrus(data: Uint8Array): Promise<string> {
  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/blobs?epochs=${WALRUS_EPOCHS}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as any;
  const blobId = result.newlyCreated?.blobObject?.blobId
    || result.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error(`Walrus upload returned unexpected response: ${JSON.stringify(result)}`);
  }

  return blobId;
}

export async function downloadFromWalrus(blobId: string): Promise<Uint8Array> {
  const response = await fetch(
    `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`,
    { signal: AbortSignal.timeout(30000) }
  );

  if (!response.ok) {
    throw new Error(`Walrus download failed: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

// ============================================================
// KEYPAIR
// ============================================================
export function loadKeypair(): Ed25519Keypair {
  // Option 1: From environment variable (base64 encoded secret key)
  const envKey = process.env.SUI_PRIVATE_KEY;
  if (envKey) {
    const raw = Buffer.from(envKey, 'base64');
    return Ed25519Keypair.fromSecretKey(raw);
  }

  // Option 2: From Sui CLI keystore (keys are base64-encoded with flag byte prefix)
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const keystorePath = join(home, '.sui', 'sui_config', 'sui.keystore');
  if (existsSync(keystorePath)) {
    const keystore: string[] = JSON.parse(readFileSync(keystorePath, 'utf-8'));
    if (keystore.length > 0) {
      // Use the last key (most recently created) — decode base64, strip flag byte
      const key = keystore[keystore.length - 1];
      const raw = Buffer.from(key, 'base64');
      const secretKey = raw.slice(1); // Remove scheme flag byte (0=ed25519)
      return Ed25519Keypair.fromSecretKey(secretKey);
    }
  }

  throw new Error(
    'No keypair found. Set SUI_PRIVATE_KEY env var or have a Sui CLI keystore.'
  );
}

// ============================================================
// SESSION KEY (clock-skew safe)
// ============================================================
// The Seal key server has zero tolerance for forward clock skew.
// If our Date.now() is even 1ms ahead of the server's clock,
// the certificate is rejected. We backdate by 5 seconds to be safe.
const CLOCK_SKEW_BUFFER_MS = 5000;

export async function createSessionKey(opts: {
  address: string;
  packageId: string;
  ttlMin: number;
  signer: Ed25519Keypair;
  suiClient: SuiClient;
}): Promise<SessionKey> {
  const sessionKey = await SessionKey.create({
    address: opts.address,
    packageId: opts.packageId,
    ttlMin: opts.ttlMin,
    signer: opts.signer,
    suiClient: opts.suiClient,
  });

  // Export, backdate creation time, re-import
  const exported = sessionKey.export();
  exported.creationTimeMs = exported.creationTimeMs - CLOCK_SKEW_BUFFER_MS;
  return SessionKey.import(exported, opts.suiClient, opts.signer);
}

// ============================================================
// HELPERS
// ============================================================
export const SUI_EXPLORER = 'https://suiscan.xyz/testnet';

export function explorerLink(type: 'object' | 'tx' | 'account', id: string): string {
  return `${SUI_EXPLORER}/${type}/${id}`;
}
