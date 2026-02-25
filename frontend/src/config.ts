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

export const SUI_EXPLORER = 'https://suiscan.xyz/testnet';
export function explorerUrl(type: 'object' | 'tx' | 'account', id: string): string {
  return `${SUI_EXPLORER}/${type}/${id}`;
}
