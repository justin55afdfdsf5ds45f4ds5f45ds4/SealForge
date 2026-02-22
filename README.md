# SealForge

Autonomous AI agent that creates premium content, encrypts it with **Seal** threshold encryption, stores it on **Walrus** decentralized storage, and sells access through a **Sui Move** smart contract marketplace.

Built for the **Sui x OpenClaw Agent Hackathon (DeepSurge)**.

**Live Dashboard:** https://frontend-zeta-one-75.vercel.app

---

## How It Works

```
1. Agent creates a ContentListing on Sui (title, description, price)
2. Agent generates premium content (research reports, analysis)
3. Content encrypted with Seal using listing ID as encryption key
4. Encrypted blob uploaded to Walrus (epochs=10 for persistence)
5. Listing updated with Walrus blob ID on-chain
6. Buyer purchases access by paying SUI to the listing
7. Buyer downloads encrypted blob from Walrus
8. Seal key servers verify on-chain access via seal_approve
9. Content decrypted and displayed to the buyer
```

The key innovation: **access control is enforced cryptographically by Seal**, not by a server. The `seal_approve` function in the Move contract checks that the caller is either the content creator or a paying buyer. Seal key servers will only release decryption keys if the on-chain proof passes.

---

## On-Chain Contracts (Sui Testnet)

| Contract | Address |
|----------|---------|
| **Package** | [`0xa93aea637e2ef5fd86734a95e257f1400fd82573ea5072845d6e760e0feeee29`](https://suiscan.xyz/testnet/object/0xa93aea637e2ef5fd86734a95e257f1400fd82573ea5072845d6e760e0feeee29) |
| **Marketplace** | [`0x55efd4d95744fe6155f0cf8b3b6cbffcca842144d33a607196334dfb73dc2cae`](https://suiscan.xyz/testnet/object/0x55efd4d95744fe6155f0cf8b3b6cbffcca842144d33a607196334dfb73dc2cae) |
| **Agent Address** | [`0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c`](https://suiscan.xyz/testnet/account/0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c) |

### Published Content Listings

| Title | Listing ID | Walrus Blob ID |
|-------|-----------|----------------|
| Top 5 DeFi Protocols on Sui Network — 2026 Analysis | [`0x320eb9...`](https://suiscan.xyz/testnet/object/0x320eb9) | View on Walrus |
| Sui vs Solana: Technical Architecture Comparison | [`0x304aa6...`](https://suiscan.xyz/testnet/object/0x304aa6) | View on Walrus |
| The State of AI Agents in Web3 — Q1 2026 | [`0x7f479e...`](https://suiscan.xyz/testnet/object/0x7f479eac78f70ad4421904ba5483c1848d92a33c6a60d4da54989de2ad6d87f6) | `eLw22B6Ix4k8m8ujR77A3foBQ1rHFhnwHTTDCKSGOkw` |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  Dashboard │ Content │ Marketplace │ Activity     │
│              @mysten/dapp-kit wallet connect      │
└──────────────┬────────────────────┬──────────────┘
               │                    │
        Read listings          Purchase + Decrypt
               │                    │
┌──────────────▼────────────────────▼──────────────┐
│                Sui Testnet                        │
│  ┌──────────────────────────────────────────┐    │
│  │  sealforge::content_marketplace          │    │
│  │  - create_listing()   → ContentListing   │    │
│  │  - purchase()         → buyer gets access │    │
│  │  - seal_approve()     → Seal access proof │    │
│  │  - update_blob_id()   → link to Walrus   │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  sealforge::agent_treasury               │    │
│  │  - record_earning()   → track revenue    │    │
│  │  - record_spending()  → track costs      │    │
│  └──────────────────────────────────────────┘    │
└──────────────┬────────────────────┬──────────────┘
               │                    │
       ┌───────▼───────┐   ┌───────▼────────┐
       │  Seal Network  │   │  Walrus Network │
       │  Key Servers   │   │  Blob Storage   │
       │  (threshold    │   │  (encrypted     │
       │   decryption)  │   │   content)      │
       └───────────────┘   └────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contracts | Sui Move 2024 edition |
| Encryption | Seal threshold encryption (2-of-2 key servers) |
| Storage | Walrus decentralized blob storage (testnet) |
| Frontend | React 19 + Vite + Tailwind CSS |
| Wallet | @mysten/dapp-kit |
| Agent | TypeScript + @mysten/sui + @mysten/seal + @mysten/walrus |
| Deployment | Vercel |

---

## Project Structure

```
SealForge/
├── move/                          # Sui Move smart contracts
│   ├── sources/
│   │   ├── content_marketplace.move  # Main marketplace + Seal integration
│   │   └── agent_treasury.move       # Agent P&L tracking
│   └── Move.toml
├── scripts/                       # TypeScript backend scripts
│   └── src/
│       ├── config.ts                 # SDK clients, keypair, Walrus helpers
│       ├── create-listing.ts         # Create on-chain listing
│       ├── encrypt-and-upload.ts     # Seal encrypt + Walrus upload
│       ├── update-listing.ts         # Set blob ID on listing
│       ├── purchase.ts               # Purchase listing access
│       ├── decrypt-and-download.ts   # Download + Seal decrypt
│       ├── full-pipeline.ts          # End-to-end test
│       ├── verify-all.ts             # Pre-demo sanity check
│       └── sealforge-agent.ts        # Autonomous content agent
├── frontend/                      # React dashboard
│   └── src/
│       ├── App.tsx                   # Tab layout
│       ├── config.ts                 # Frontend contract config
│       └── components/
│           ├── Dashboard.tsx         # Agent stats + architecture
│           ├── ContentLibrary.tsx    # Content listing grid
│           ├── Marketplace.tsx       # Buy + decrypt interface
│           ├── ActivityFeed.tsx      # Live on-chain events
│           └── About.tsx             # Project description
├── skill/
│   └── SKILL.md                   # OpenClaw skill definition
└── README.md
```

---

## Running Locally

### Prerequisites
- Node.js v22+
- Sui CLI (`choco install sui` on Windows)
- Sui testnet wallet with SUI balance

### Backend Scripts

```bash
cd scripts
npm install

# Run full pipeline test (create → encrypt → upload → purchase → decrypt)
npm run full-pipeline

# Run agent to create and publish content
npm run agent

# Run sanity check
npm run verify-all
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — connect a Sui wallet (e.g., Sui Wallet browser extension) to purchase and decrypt content.

---

## Smart Contract Design

### Seal Integration

The `seal_approve` function is the access control gate:

```move
entry fun seal_approve(id: vector<u8>, listing: &ContentListing, ctx: &TxContext) {
    // Verify encryption ID has this listing's object ID as prefix
    let listing_id_bytes = object::id_bytes(listing);
    assert!(is_prefix(&listing_id_bytes, &id), EInvalidPrefix);

    // Check access: must be creator or buyer
    assert!(
        listing.creator == sender || listing.buyers.contains(&sender),
        ENoAccess,
    );
}
```

When encrypting content, the encryption ID is `[listing_object_id_bytes][5-byte-nonce]`. Seal key servers build a transaction calling `seal_approve` and simulate it. If it aborts, decryption is denied. If it passes, decryption keys are released.

### Purchase Flow

1. Buyer calls `purchase()` with a `Coin<SUI>` payment
2. Contract validates payment >= listing price
3. Payment transferred to content creator
4. Buyer address added to `listing.buyers` vector
5. Buyer can now call `seal_approve` successfully via Seal

---

## Key Technical Decisions

1. **Chicken-and-egg solved**: Listings start with empty `walrus_blob_id`. Create listing first to get object ID → use ID for encryption → upload to Walrus → update listing with blob ID.

2. **Clock-skew handling**: Seal key servers have zero tolerance for forward clock skew. `SessionKey` creation time is backdated by 5 seconds to handle minor clock differences.

3. **EncryptedObject ID encoding**: `EncryptedObject.parse()` returns `id` as a hex string (BCS transform). Must use `fromHex(parsed.id)` to get raw bytes for `seal_approve`, not `Array.from(parsed.id)` which creates ASCII char codes.

---

## License

MIT
