export const NETWORK = 'testnet' as const;
export const SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';

export const PACKAGE_ID = '0x69ba4d42032299994c9c97a927773f23b36ba4f908a50d8b4be7b440ad9dfbcf';
export const MARKETPLACE_ID = '0xcb6adca892ca552d5efb5652fddc1adcd44e1b9bdc51db89a45968d42e6ff59d';
export const TREASURY_ID = '0x62337a9c38d31aa62552158865b90beafd739c7ff171e0d83bae05d2d24c510a';
export const AGENT_ADDRESS = '0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c';

export const SEAL_KEY_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

// Listings to hide from marketplace (duplicates + test reports)
export const HIDDEN_LISTING_IDS: string[] = [
  '0x40f00773a16034029c08391f37eff3b58ead96fe4b6553d89e85c58a5daef645', // Pipeline Test #1
  '0xdcfb0cd27c1776ac2ccd90135072de05c324cd4754787a27b7736391d7382e4a', // Pipeline Test #2
  '0x4969218e3d459a272e4b6907c366777f0686ff166bac13a58c59753820114e72', // Duplicate: Sui DeFi Capital Rotation
  '0x30c8d19cfc64495c39e27c8b897a72da1ed93e637dac61a6ebfb2fdd1e71f402', // Duplicate: Trending Crypto Momentum
];

// Title patterns to hide (case-insensitive) — catches future test listings automatically
export const HIDDEN_TITLE_PATTERNS: string[] = [
  'pipeline test',
  'test report',
];

export const SUI_EXPLORER = 'https://suiscan.xyz/testnet';
export function explorerUrl(type: 'object' | 'tx' | 'account', id: string): string {
  return `${SUI_EXPLORER}/${type}/${id}`;
}
