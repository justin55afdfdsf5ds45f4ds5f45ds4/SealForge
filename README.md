# SealForge

**Autonomous AI intelligence marketplace on Sui** — an agent that scans DeFi data, reasons through signals with LLM chain-of-thought, encrypts premium intelligence with Seal, stores on Walrus, and sells access via Move smart contracts.

Built for the **Sui x OpenClaw Agent Hackathon (DeepSurge)**.

**Live Dashboard:** https://frontend-zeta-one-75.vercel.app

---

## What Makes SealForge Different

Most "AI agent" projects generate template text and wrap it in a UI. SealForge is different:

1. **Real data, real reasoning** — The agent fetches live data from DefiLlama, CoinGecko, and RSS feeds, then uses LLM chain-of-thought reasoning (Claude 4.5 Sonnet via Replicate) to identify actionable signals
2. **Cryptographic access control** — Content is encrypted with Seal threshold encryption. No server can grant access — only the Move contract's `seal_approve` function determines who can decrypt
3. **Interactive intelligence experience** — Buyers don't see raw text. They get an animated IntelViewer with reasoning chains, confidence indicators, source attribution, action buttons, and personal notes
4. **Fully autonomous** — The agent runs a 6-phase loop (Scan → Identify → Hunt → Reason → Package → Publish) without human intervention

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│   Autonomous Agent (TypeScript)                                 │
│                                                                 │
│   SCAN ──► IDENTIFY ──► HUNT ──► REASON ──► PACKAGE ──► PUBLISH │
│   DefiLlama   Claude 4.5    Web      LLM CoT    Seal       Sui  │
│   CoinGecko   Sonnet via    Search   Reasoning   Encrypt   Move  │
│   RSS Feeds   Replicate     Sources  + Verdict   + Walrus  List  │
└───────────────────────┬─────────────────────┬───────────────────┘
                        │                     │
        ┌───────────────▼──────┐   ┌──────────▼───────────┐
        │    Sui Testnet       │   │    Frontend (React)   │
        │                      │   │                       │
        │  content_marketplace │   │  Dashboard            │
        │  - create_listing    │   │  - Agent Brain log    │
        │  - purchase          │   │  - Treasury P&L       │
        │  - seal_approve      │   │                       │
        │                      │   │  Marketplace          │
        │  agent_treasury      │   │  - Themed cards       │
        │  - track P&L         │   │  - Purchase + decrypt │
        │                      │   │  - IntelViewer        │
        └──────┬───────┬───────┘   └───────────────────────┘
               │       │
       ┌───────▼──┐ ┌──▼──────────┐
       │   Seal   │ │   Walrus    │
       │  2-of-2  │ │  Blob Store │
       │  TSS     │ │  (testnet)  │
       └──────────┘ └─────────────┘
```

---

## The 6-Phase Agent Loop

| Phase | What Happens | Data Sources |
|-------|-------------|--------------|
| **SCAN** | Fetch live DeFi + market data | DefiLlama TVL/yields, CoinGecko prices/trending, RSS feeds |
| **IDENTIFY** | LLM picks the #1 tradeable signal | Claude 4.5 Sonnet analyzes raw data, assigns theme + confidence + price |
| **HUNT** | Deep-dive research on the signal | Targeted web fetches, protocol-specific data |
| **REASON** | Chain-of-thought reasoning (3-6 steps) | LLM builds reasoning chain with increasing confidence per step |
| **PACKAGE** | Assemble + encrypt intelligence | Build IntelligencePayload JSON → Seal encrypt → Walrus upload |
| **PUBLISH** | List on-chain for sale | Move `create_listing` → update blob ID → record in treasury |

---

## On-Chain Contracts (Sui Testnet)

| Contract | Address |
|----------|---------|
| **Package** | [`0x69ba4d42...ad9dfbcf`](https://suiscan.xyz/testnet/object/0x69ba4d42032299994c9c97a927773f23b36ba4f908a50d8b4be7b440ad9dfbcf) |
| **Marketplace** | [`0xcb6adca8...e6ff59d`](https://suiscan.xyz/testnet/object/0xcb6adca892ca552d5efb5652fddc1adcd44e1b9bdc51db89a45968d42e6ff59d) |
| **Treasury** | [`0x62337a9c...d24c510a`](https://suiscan.xyz/testnet/object/0x62337a9c38d31aa62552158865b90beafd739c7ff171e0d83bae05d2d24c510a) |
| **Agent Address** | [`0xe8c76a2e...d9fba3c`](https://suiscan.xyz/testnet/account/0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c) |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contracts | Sui Move 2024 edition |
| Encryption | Seal threshold encryption (2-of-2 key servers) |
| Storage | Walrus decentralized blob storage (testnet) |
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 |
| Wallet | @mysten/dapp-kit |
| Agent Runtime | TypeScript + @mysten/sui + @mysten/seal |
| LLM (Primary) | Claude 4.5 Sonnet via Replicate API |
| LLM (Fallback) | DeepSeek R1 via Replicate API |
| Data Sources | DefiLlama, CoinGecko, RSS (Sui Blog, CoinTelegraph, Decrypt) |
| Deployment | Vercel |

---

## Project Structure

```
SealForge/
├── move/                              # Sui Move smart contracts
│   └── sources/
│       ├── content_marketplace.move     # Marketplace + Seal access control
│       └── agent_treasury.move          # Agent P&L tracking
├── scripts/                           # Agent backend
│   └── src/
│       ├── sealforge-agent.ts           # Autonomous 6-phase agent
│       ├── llm.ts                       # Replicate API (Claude + DeepSeek)
│       ├── data-sources.ts              # DefiLlama, CoinGecko, RSS fetchers
│       ├── activity-log.ts              # Agent activity logger
│       ├── types.ts                     # IntelligencePayload schema
│       ├── config.ts                    # SDK clients + Walrus helpers
│       ├── full-pipeline.ts             # End-to-end pipeline test
│       └── verify-all.ts               # Pre-demo sanity check
├── frontend/                          # React dashboard
│   └── src/
│       ├── App.tsx                      # Tab layout + agent status
│       ├── config.ts                    # Contract addresses
│       ├── themes.ts                    # 5 visual themes
│       ├── types/intelligence.ts        # IntelligencePayload type
│       └── components/
│           ├── Dashboard.tsx            # Agent brain log + treasury P&L
│           ├── Marketplace.tsx          # Themed cards + purchase + decrypt
│           ├── IntelViewer.tsx          # Rich interactive decrypted view
│           ├── ContentLibrary.tsx       # Agent's content inventory
│           ├── ActivityFeed.tsx         # Live on-chain events
│           └── About.tsx                # Project info
├── skill/
│   └── SKILL.md                       # OpenClaw skill definition
└── README.md
```

---

## Running Locally

### Prerequisites
- Node.js v22+
- Sui CLI
- Sui testnet wallet with SUI balance
- Replicate API token (for LLM calls)

### Agent

```bash
cd scripts
npm install

# Create .env with your Replicate API token
echo "REPLICATE_API_TOKEN=your_token_here" > .env

# Run autonomous agent (creates 2 listings)
npx tsx src/sealforge-agent.ts auto

# Create a listing on a specific topic
npx tsx src/sealforge-agent.ts create "DeFi yield analysis"

# Scan data sources only (no listing created)
npx tsx src/sealforge-agent.ts scan

# Run full pipeline test
npm run full-pipeline
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — connect a Sui wallet to purchase and decrypt intelligence.

---

## Seal Integration Deep Dive

The `seal_approve` function is the cryptographic access gate:

```move
entry fun seal_approve(id: vector<u8>, listing: &ContentListing, ctx: &TxContext) {
    let listing_id_bytes = object::id_bytes(listing);
    assert!(is_prefix(&listing_id_bytes, &id), EInvalidPrefix);
    assert!(
        listing.creator == sender || listing.buyers.contains(&sender),
        ENoAccess,
    );
}
```

**Encryption ID format:** `[listing_object_id_bytes (32)] + [nonce (5)]` = 37 bytes

When a buyer requests decryption, Seal key servers build a transaction calling `seal_approve` and simulate it. If the caller is not the creator or a buyer, the assert fails and decryption is denied. No centralized server controls access.

---

## Key Technical Decisions

1. **Chicken-and-egg solved**: Listings start with empty `walrus_blob_id`. Create listing first → use object ID for encryption → upload to Walrus → update listing with blob ID.

2. **Clock-skew handling**: Seal key servers have zero tolerance for forward clock skew. `SessionKey` creation time is backdated by 5 seconds.

3. **LLM fallback chain**: Claude 4.5 Sonnet (primary) → DeepSeek R1 (fallback with 3 retries + 12s delay for rate limits) → Static fallback signal pool.

4. **Activity logging**: Every agent phase logs to `frontend/public/agent-activity.json`, which the Dashboard renders as a real-time brain activity feed.

---

## License

MIT
