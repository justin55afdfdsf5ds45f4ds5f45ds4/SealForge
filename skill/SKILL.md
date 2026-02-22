# SealForge Agent Skill

## Description
SealForge is an autonomous AI agent that creates premium encrypted content and sells it on Sui blockchain. It uses Seal threshold encryption for access control and Walrus for decentralized storage.

## Commands

### /create-content <topic>
Research a topic, generate a premium report, encrypt it with Seal, upload to Walrus, and list it on the marketplace.

**Parameters:**
- `topic` (required): The research topic to create content about
- `price` (optional, default: 0.1 SUI): Price in SUI for the content listing

**Steps:**
1. Research the topic using web search
2. Generate a structured markdown report
3. Create a listing on-chain via `content_marketplace::create_listing`
4. Encrypt the report with Seal using the listing's object ID
5. Upload encrypted blob to Walrus (10 epochs for persistence)
6. Update listing with the Walrus blob ID

**Output:** Listing ID, Walrus blob ID, SuiScan link

### /list-content
Show all active content listings in the marketplace with titles, prices, and buyer counts.

### /agent-status
Show agent operational stats: total content created, total sales, revenue, wallet balance.

### /verify-pipeline
Run the full pipeline sanity check to verify the system works end-to-end.

## Configuration

### Required Environment
- Sui wallet with testnet SUI balance
- Access to Sui testnet RPC
- Access to Seal key servers (testnet)
- Access to Walrus publisher/aggregator (testnet)

### Contract Addresses
- Package: `0xa93aea637e2ef5fd86734a95e257f1400fd82573ea5072845d6e760e0feeee29`
- Marketplace: `0x55efd4d95744fe6155f0cf8b3b6cbffcca842144d33a607196334dfb73dc2cae`

### Network
- Chain: Sui Testnet
- Seal Key Servers: mysten-testnet-1, mysten-testnet-2
- Walrus: testnet publisher/aggregator
- Explorer: https://suiscan.xyz/testnet

## Tech Stack
- **Smart Contracts**: Sui Move 2024 edition
- **Encryption**: Seal threshold encryption (2-of-2)
- **Storage**: Walrus decentralized blob storage
- **Frontend**: React + Vite + Tailwind + @mysten/dapp-kit
- **Agent**: TypeScript with @mysten/sui SDK
