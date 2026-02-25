import { useState, useEffect } from 'react';
import { useSuiClientQuery, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { PACKAGE_ID, MARKETPLACE_ID, SEAL_KEY_SERVERS, WALRUS_AGGREGATOR, HIDDEN_LISTING_IDS } from '../config';
import { getTheme } from '../themes';
import IntelViewer from './IntelViewer';
import type { WalletAccount } from '@mysten/wallet-standard';

interface ListingFields {
  creator: string;
  title: number[];
  description: number[];
  thumbnail_url: number[];
  price: string;
  walrus_blob_id: number[];
  buyers: string[];
  total_revenue: string;
  is_active: boolean;
  created_at: string;
}

function decodeBytes(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function formatSUI(mist: string): string {
  return (Number(mist) / 1_000_000_000).toFixed(2);
}

function getTimeAgo(ms: string): string {
  const diff = Date.now() - Number(ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type ModalPhase = 'downloading' | 'signing' | 'decrypting' | 'revealing' | 'done';

interface ModalState {
  listingId: string;
  title: string;
  themeName: string;
  phase: ModalPhase;
  content: string;
  error: string;
}

export default function Marketplace({ account }: { account: WalletAccount | null }) {
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [modal, setModal] = useState<ModalState | null>(null);

  const { data: marketplaceObj } = useSuiClientQuery('getObject', {
    id: MARKETPLACE_ID,
    options: { showContent: true },
  });

  const fields = (marketplaceObj?.data?.content as any)?.fields;
  const allListingIds: string[] = fields?.listings ?? [];

  // Filter hidden listings, reverse so premium (created later) appear first
  const listingIds = allListingIds
    .filter(id => !HIDDEN_LISTING_IDS.includes(id))
    .reverse();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  function closeModal() {
    setModal(null);
  }

  async function handleDecrypt(listingId: string, blobId: string, title: string, themeName: string) {
    if (!account) return;

    setModal({ listingId, title, themeName, phase: 'downloading', content: '', error: '' });

    try {
      const resp = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const encryptedData = new Uint8Array(await resp.arrayBuffer());

      const parsed = EncryptedObject.parse(encryptedData);
      const idRawBytes = fromHex(parsed.id);

      setModal(m => m ? { ...m, phase: 'signing' } : m);
      const sessionKey = await SessionKey.create({
        address: account.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: suiClient as any,
      });

      const personalMessage = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage({ message: personalMessage });
      await sessionKey.setPersonalMessageSignature(signature);

      const sealClient = new SealClient({
        suiClient: suiClient as any,
        serverConfigs: SEAL_KEY_SERVERS.map((id) => ({ objectId: id, weight: 1 })),
        verifyKeyServers: false,
      });

      setModal(m => m ? { ...m, phase: 'decrypting' } : m);
      const approveTx = new Transaction();
      approveTx.moveCall({
        target: `${PACKAGE_ID}::content_marketplace::seal_approve`,
        arguments: [
          approveTx.pure.vector('u8', Array.from(idRawBytes)),
          approveTx.object(listingId),
        ],
      });
      const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

      const decrypted = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes,
      });

      const content = new TextDecoder().decode(decrypted);

      // Reveal animation
      setModal(m => m ? { ...m, phase: 'revealing' } : m);
      await new Promise(r => setTimeout(r, 1500));

      setModal(m => m ? { ...m, phase: 'done', content } : m);
    } catch (err: any) {
      setModal(m => m ? { ...m, error: err.message } : m);
      // Show error briefly then close
      setTimeout(() => setModal(null), 3000);
    }
  }

  const modalTheme = modal ? getTheme(modal.themeName) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            {'\u{1F510}'} SealForge Intelligence Marketplace
          </h2>
          <p className="text-gray-400 mt-1">
            Autonomous AI-curated intel. Seal-encrypted. Pay to unlock.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Agent: ACTIVE</span>
        </div>
      </div>

      {!account && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm">
          Connect your Sui wallet to purchase content and decrypt it.
        </div>
      )}

      {listingIds.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 border border-gray-800 text-center">
          <div className="text-4xl mb-3">{'\u{1F916}'}</div>
          <p className="text-gray-400 font-medium">Agent is scanning for signals...</p>
          <p className="text-gray-600 text-sm mt-1">New intelligence packages will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listingIds.map((id) => (
            <MarketplaceCard
              key={id}
              listingId={id}
              account={account}
              onDecrypt={handleDecrypt}
            />
          ))}
        </div>
      )}

      {/* ══════════ FULL-SCREEN MODAL ══════════ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={modal.phase === 'done' ? closeModal : undefined}
          />

          {/* Error state */}
          {modal.error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <span className="text-4xl">{'\u{274C}'}</span>
                </div>
                <p className="text-red-400 text-lg font-medium">Decrypt Failed</p>
                <p className="text-gray-500 text-sm mt-2 max-w-md">{modal.error}</p>
              </div>
            </div>
          )}

          {/* Downloading / Signing / Decrypting animation */}
          {!modal.error && (modal.phase === 'downloading' || modal.phase === 'signing' || modal.phase === 'decrypting') && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
                  <div
                    className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                    style={{ borderColor: `${modalTheme?.gradientFrom || '#3b82f6'} transparent transparent transparent` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl">{'\u{1F510}'}</span>
                  </div>
                </div>
                <p className="text-gray-300 text-lg font-medium">
                  {modal.phase === 'downloading' && 'Downloading from Walrus...'}
                  {modal.phase === 'signing' && 'Sign in your wallet...'}
                  {modal.phase === 'decrypting' && 'Seal decrypting...'}
                </p>
                <p className="text-gray-600 text-sm mt-2">Verifying on-chain access</p>
              </div>
            </div>
          )}

          {/* Reveal animation */}
          {!modal.error && modal.phase === 'revealing' && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div
                  className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center animate-pulse-glow"
                  style={{
                    backgroundColor: `${modalTheme?.gradientFrom || '#22c55e'}30`,
                    boxShadow: `0 0 80px ${modalTheme?.gradientFrom || '#22c55e'}40`,
                  }}
                >
                  <span className="text-4xl">{'\u{1F513}'}</span>
                </div>
                <p className="text-white text-xl font-bold">Intelligence Unlocked</p>
                <p className="text-gray-500 text-sm mt-2">{modalTheme?.icon} {modalTheme?.label}</p>
              </div>
            </div>
          )}

          {/* IntelViewer content */}
          {!modal.error && modal.phase === 'done' && modal.content && (
            <div className="relative z-10 flex flex-col h-full animate-fade-in-up">
              {/* Sticky header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-gray-900/95 border-b border-gray-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{modalTheme?.icon}</span>
                  <h2 className="text-white font-bold text-lg truncate">{modal.title}</h2>
                </div>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-xl flex-shrink-0 ml-4"
                >
                  {'\u{2715}'}
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-8">
                  <IntelViewer content={modal.content} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════ MARKETPLACE CARD ══════════

interface CardProps {
  listingId: string;
  account: WalletAccount | null;
  onDecrypt: (listingId: string, blobId: string, title: string, themeName: string) => void;
}

function MarketplaceCard({ listingId, account, onDecrypt }: CardProps) {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<string>('');
  const [purchasing, setPurchasing] = useState(false);

  const { data, refetch } = useSuiClientQuery('getObject', {
    id: listingId,
    options: { showContent: true },
  });

  const fields = (data?.data?.content as any)?.fields as ListingFields | undefined;
  if (!fields) {
    return (
      <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#111827]">
        <div className="h-16 animate-shimmer" />
        <div className="p-5 space-y-3">
          <div className="h-5 bg-gray-800 rounded animate-shimmer w-3/4" />
          <div className="h-4 bg-gray-800 rounded animate-shimmer w-full" />
          <div className="h-8 bg-gray-800 rounded animate-shimmer w-1/2" />
        </div>
      </div>
    );
  }

  const title = decodeBytes(fields.title);
  const description = decodeBytes(fields.description);
  const themeName = fields.thumbnail_url?.length > 0 ? decodeBytes(fields.thumbnail_url) : 'blue-data';
  const theme = getTheme(themeName);
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
            setStatus('Purchase confirmed!');
            await suiClient.waitForTransaction({ digest: result.digest });
            setStatus('');
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

  return (
    <div className={`rounded-xl overflow-hidden border ${theme.border} bg-[#111827] hover:scale-[1.02] hover:shadow-lg ${theme.glow} transition-all duration-200 group`}>
      {/* Gradient Banner */}
      <div className={`bg-gradient-to-r ${theme.gradient} p-4 flex items-center justify-between`}>
        <span className="text-2xl">{theme.icon}</span>
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{theme.label}</span>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-white font-semibold text-sm leading-tight mb-2 line-clamp-2">{title}</h3>
        <p className="text-gray-500 text-xs mb-4 line-clamp-2">{description}</p>

        {/* Meta badges */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          <span>{'\u{1F465}'} {fields.buyers.length} unlocked</span>
          {fields.created_at && <span>{'\u{23F1}'} {getTimeAgo(fields.created_at)}</span>}
        </div>

        {/* Price + Action */}
        <div className="flex items-center gap-2">
          <div className="bg-gray-800 rounded-lg px-3 py-1.5 text-white font-semibold text-sm">
            {formatSUI(fields.price)} SUI
          </div>

          {!hasAccess && account && (
            <button
              onClick={handlePurchase}
              disabled={purchasing || !fields.is_active}
              className={`flex-1 bg-gradient-to-r ${theme.gradient} hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5`}
            >
              {purchasing ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <>{'\u{1F510}'} Unlock Intelligence</>
              )}
            </button>
          )}

          {hasAccess && blobId && (
            <button
              onClick={() => onDecrypt(listingId, blobId, title, themeName)}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              {'\u{1F513}'} Decrypt & Read
            </button>
          )}
        </div>

        {/* Status */}
        {status && (
          <p className={`text-xs mt-3 ${status.includes('failed') || status.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
