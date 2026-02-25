# SealForge Agent Skill

## Description
SealForge is an autonomous AI intelligence agent that scans live DeFi/market data, identifies tradeable signals using LLM chain-of-thought reasoning, encrypts premium intelligence with Seal threshold encryption, stores it on Walrus, and sells access via Sui Move smart contracts.

## Commands

### /auto
Run the full autonomous 6-phase loop. The agent will scan data sources, identify signals, reason through them, and publish 2 encrypted intelligence listings.

```bash
npx tsx scripts/src/sealforge-agent.ts auto
```

### /create <topic>
Create a single intelligence listing on a specific topic.

**Parameters:**
- `topic` (required): The topic or signal to research and publish

```bash
npx tsx scripts/src/sealforge-agent.ts create "DeFi yield analysis"
```

### /scan
Scan all data sources and display raw signals without creating listings.

```bash
npx tsx scripts/src/sealforge-agent.ts scan
```

### /full-pipeline
Run end-to-end pipeline test: create listing, encrypt, upload to Walrus, purchase, decrypt.

```bash
cd scripts && npm run full-pipeline
```

### /verify-all
Sanity check: verify all scripts work, contracts are accessible, and the system is healthy.

```bash
cd scripts && npm run verify-all
```

## 6-Phase Agent Loop

| Phase | Description |
|-------|------------|
| SCAN | Fetch live data from DefiLlama (TVL, yields, protocols), CoinGecko (prices, trending), RSS feeds |
| IDENTIFY | LLM (Claude 4.5 Sonnet) picks the #1 tradeable signal, assigns theme/confidence/price |
| HUNT | Deep-dive web fetches for additional data specific to the identified signal |
| REASON | LLM chain-of-thought reasoning: 3-6 steps with increasing confidence + conclusion + actionable play |
| PACKAGE | Assemble IntelligencePayload JSON, Seal encrypt, Walrus upload |
| PUBLISH | Create on-chain listing, update blob ID, record in treasury |

## IntelligencePayload Schema

The encrypted content follows a structured JSON schema:
- `signal`: title, theme, confidence, category, timestamp
- `reasoning`: array of labeled steps with source references
- `conclusion`: summary verdict, actionable play, timeframe
- `actions`: clickable links to protocols/explorers
- `sources`: attributed data sources with URLs and types
- `metadata`: agent version, model used, generation timestamp

## Configuration

### Required Environment
- Sui wallet with testnet SUI balance
- Replicate API token (for Claude 4.5 Sonnet + DeepSeek R1)
- Access to Sui testnet RPC
- Access to Seal key servers (testnet)
- Access to Walrus publisher/aggregator (testnet)

### Contract Addresses
- Package: `0x69ba4d42032299994c9c97a927773f23b36ba4f908a50d8b4be7b440ad9dfbcf`
- Marketplace: `0xcb6adca892ca552d5efb5652fddc1adcd44e1b9bdc51db89a45968d42e6ff59d`
- Treasury: `0x62337a9c38d31aa62552158865b90beafd739c7ff171e0d83bae05d2d24c510a`
- Agent Address: `0xe8c76a2ee8fcabb173a327a5f8228d9e18cf868ac39d2406e6e72ab13d9fba3c`

### Network
- Chain: Sui Testnet
- Seal Key Servers: mysten-testnet-1, mysten-testnet-2 (2-of-2 threshold)
- Walrus: testnet publisher/aggregator
- Explorer: https://suiscan.xyz/testnet

## Tech Stack
- **Smart Contracts**: Sui Move 2024 edition
- **Encryption**: Seal threshold encryption (2-of-2)
- **Storage**: Walrus decentralized blob storage
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + @mysten/dapp-kit
- **LLM (Primary)**: Claude 4.5 Sonnet via Replicate API
- **LLM (Fallback)**: DeepSeek R1 via Replicate API
- **Data Sources**: DefiLlama, CoinGecko, RSS feeds
- **Agent**: TypeScript with @mysten/sui + @mysten/seal SDKs
