import { requestSuiFromFaucetV0, getFaucetHost } from '@mysten/sui/faucet';

async function main() {
  const address = '0x8cc27917d372d8366e2430c6208bbc37527bc7cb1c29d04f0ab9272bef3908cb';

  console.log('Requesting SUI from faucet for:', address);
  console.log('Faucet host:', getFaucetHost('testnet'));

  try {
    const result = await requestSuiFromFaucetV0({
      host: getFaucetHost('testnet'),
      recipient: address,
    });
    console.log('Faucet response:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Faucet error:', err.message);

    // Try alternate approach
    console.log('\nTrying alternate faucet URL...');
    try {
      const resp = await fetch('https://faucet.testnet.sui.io/v2/gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FixedAmountRequest: { recipient: address } }),
      });
      const text = await resp.text();
      console.log('V2 response:', text);
    } catch (err2: any) {
      console.error('V2 error:', err2.message);
    }
  }
}

main().catch(console.error);
