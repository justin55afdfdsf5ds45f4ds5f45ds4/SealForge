import { useState } from 'react';
import { useSuiClientQuery, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { PACKAGE_ID, MARKETPLACE_ID, SEAL_KEY_SERVERS, WALRUS_AGGREGATOR, explorerUrl } from '../config';
import type { WalletAccount } from '@mysten/wallet-standard';

interface ListingFields {
  creator: string;
  title: number[];
  description: number[];
  price: string;
  walrus_blob_id: number[];
  buyers: string[];
  is_active: boolean;
}

function decodeBytes(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function formatSUI(mist: string): string {
  return (Number(mist) / 1_000_000_000).toFixed(2);
}

export default function Marketplace({ account }: { account: WalletAccount | null }) {
  const { data: marketplaceObj } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const listingIds: string[] = fields?.listings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Marketplace</h2>
        <p className="text-gray-400 mt-1">
          {account
            ? `Connected: ${account.address.slice(0, 8)}...${account.address.slice(-6)}`
            : 'Connect wallet to purchase and decrypt content'}
        </p>
      </div>

      {!account && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm">
          Connect your Sui wallet to purchase content and decrypt it.
        </div>
      )}

      {listingIds.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500">No listings available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listingIds.map((id) => (
            <MarketplaceCard key={id} listingId={id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceCard({ listingId, account }: { listingId: string; account: WalletAccount | null }) {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [status, setStatus] = useState<string>('');
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [purchasing, setPurchasing] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const { data, refetch } = useSuiClientQuery('getObject', {
    id: listingId,
    options: { showContent: true },
  });

  const fields = (data?.data?.content as any)?.fields as ListingFields | undefined;
  if (!fields) return null;

  const title = decodeBytes(fields.title);
  const description = decodeBytes(fields.description);
  const blobId = fields.walrus_blob_id.length > 0 ? decodeBytes(fields.walrus_blob_id) : null;
  const hasPurchased = account ? fields.buyers.includes(account.address) : false;
  const isCreator = account?.address === fields.creator;
  const hasAccess = hasPurchased || isCreator;

  async function handlePurchase() {
    if (!account) return;
    setPurchasing(true);
    setStatus('Creating purchase transaction...');
    try {
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(fields!.price)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::content_marketplace::purchase`,
        arguments: [
          tx.object(MARKETPLACE_ID),
          tx.object(listingId),
          coin,
          tx.object('0x6'),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            setStatus('Purchase confirmed! Waiting for indexing...');
            await suiClient.waitForTransaction({ digest: result.digest });
            setStatus('Purchase complete!');
            refetch();
            setPurchasing(false);
          },
          onError: (err) => {
            setStatus(`Purchase failed: ${err.message}`);
            setPurchasing(false);
          },
        },
      );
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      setPurchasing(false);
    }
  }

  async function handleDecrypt() {
    if (!account || !blobId) return;
    setDecrypting(true);
    setStatus('Downloading from Walrus...');
    try {
      // Download encrypted blob
      const resp = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const encryptedData = new Uint8Array(await resp.arrayBuffer());

      // Parse encrypted object
      const parsed = EncryptedObject.parse(encryptedData);
      const idRawBytes = fromHex(parsed.id);

      // Create session key without signer (browser wallet flow)
      setStatus('Creating session key...');
      const sessionKey = await SessionKey.create({
        address: account.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: suiClient as any,
      });

      // Sign the personal message with the wallet
      setStatus('Please sign the session key message in your wallet...');
      const personalMessage = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage({ message: personalMessage });
      await sessionKey.setPersonalMessageSignature(signature);

      // Create Seal client
      const sealClient = new SealClient({
        suiClient: suiClient as any,
        serverConfigs: SEAL_KEY_SERVERS.map((id) => ({ objectId: id, weight: 1 })),
        verifyKeyServers: false,
      });

      // Build seal_approve transaction
      setStatus('Building access proof...');
      const approveTx = new Transaction();
      approveTx.moveCall({
        target: `${PACKAGE_ID}::content_marketplace::seal_approve`,
        arguments: [
          approveTx.pure.vector('u8', Array.from(idRawBytes)),
          approveTx.object(listingId),
        ],
      });
      const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

      // Decrypt
      setStatus('Decrypting with Seal key servers...');
      const decrypted = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes,
      });

      setDecryptedContent(new TextDecoder().decode(decrypted));
      setStatus('Decrypted successfully!');
    } catch (err: any) {
      setStatus(`Decrypt failed: ${err.message}`);
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <div className="bg-[#111827] rounded-xl p-5 border border-gray-800">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-white font-semibold">{title}</h3>
        <span className="text-blue-400 font-medium text-sm">{formatSUI(fields.price)} SUI</span>
      </div>
      <p className="text-gray-500 text-sm mb-4">{description}</p>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <span>{fields.buyers.length} buyer{fields.buyers.length !== 1 ? 's' : ''}</span>
        {hasAccess && <span className="text-green-400">You have access</span>}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!hasAccess && account && (
          <button
            onClick={handlePurchase}
            disabled={purchasing || !fields.is_active}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {purchasing ? 'Processing...' : `Buy Access (${formatSUI(fields.price)} SUI)`}
          </button>
        )}
        {hasAccess && blobId && (
          <button
            onClick={handleDecrypt}
            disabled={decrypting}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {decrypting ? 'Decrypting...' : 'Decrypt & Read'}
          </button>
        )}
        <a href={explorerUrl('object', listingId)} target="_blank" rel="noreferrer"
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 px-3 rounded-lg transition-colors">
          View
        </a>
      </div>

      {/* Status */}
      {status && (
        <p className={`text-xs mt-3 ${status.includes('failed') || status.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
          {status}
        </p>
      )}

      {/* Decrypted Content */}
      {decryptedContent && (
        <div className="mt-4 bg-[#0a0f1e] rounded-lg p-4 border border-gray-700">
          <h4 className="text-green-400 text-xs font-medium mb-2">Decrypted Content:</h4>
          <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {decryptedContent}
          </pre>
        </div>
      )}
    </div>
  );
}
