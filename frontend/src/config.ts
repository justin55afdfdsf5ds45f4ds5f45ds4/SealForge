export const NETWORK = 'testnet' as const;
export const SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';

export const PACKAGE_ID = '0xa93aea637e2ef5fd86734a95e257f1400fd82573ea5072845d6e760e0feeee29';
export const MARKETPLACE_ID = '0x55efd4d95744fe6155f0cf8b3b6cbffcca842144d33a607196334dfb73dc2cae';
export const TREASURY_ID = '0xf05a579f97f27b2a99e16bdb7acc6cd3af1a9bca00b89abae6fb9b6ef42046df';
export const AGENT_ADDRESS = '0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c';

export const SEAL_KEY_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export const SUI_EXPLORER = 'https://suiscan.xyz/testnet';
export function explorerUrl(type: 'object' | 'tx' | 'account', id: string): string {
  return `${SUI_EXPLORER}/${type}/${id}`;
}
