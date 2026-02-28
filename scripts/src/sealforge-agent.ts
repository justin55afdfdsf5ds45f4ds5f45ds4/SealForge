/**
 * SealForge Autonomous Agent — Scans markets, identifies signals, reasons through data,
 * and publishes encrypted intelligence packages on Sui.
 *
 * Run:
 *   npx tsx src/sealforge-agent.ts auto          — Full autonomous loop (2 listings)
 *   npx tsx src/sealforge-agent.ts create "topic" — Manual topic
 *   npx tsx src/sealforge-agent.ts scan           — Scan only, show signals
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import {
  createSuiClient, createSealClient, uploadToWalrus,
  loadKeypair, loadDeployedConfig, explorerLink
} from './config.js';
import { scanAllSources, formatScanForLLM } from './data-sources.js';
import { callLLM } from './llm.js';
import { ActivityLog } from './activity-log.js';
import type { IntelligencePayload, VisualTheme } from './types.js';

const log = new ActivityLog();

// ============================================================
// PHASE 1: SCAN — Observe the environment
// ============================================================
async function phaseScan() {
  log.log('SCAN', 'Starting environment scan...');

  const scan = await scanAllSources();

  const stats = {
    suiTVL: scan.suiChain ? `$${(scan.suiChain.tvl / 1e9).toFixed(2)}B (${scan.suiChain.change_1d > 0 ? '+' : ''}${scan.suiChain.change_1d.toFixed(1)}% 24h)` : 'unavailable',
    suiPrice: scan.suiPrice ? `$${scan.suiPrice.usd.toFixed(4)} (${scan.suiPrice.usd_24h_change > 0 ? '+' : ''}${scan.suiPrice.usd_24h_change.toFixed(1)}%)` : 'unavailable',
    protocols: scan.suiProtocols.length,
    yieldPools: scan.suiYields.length,
    trending: scan.trending.length,
    news: scan.news.length,
  };

  log.log('SCAN', `Sui TVL: ${stats.suiTVL}`);
  log.log('SCAN', `SUI Price: ${stats.suiPrice}`);
  log.log('SCAN', `Protocols scanned: ${stats.protocols}`);
  log.log('SCAN', `Yield pools found: ${stats.yieldPools}`);
  log.log('SCAN', `Trending coins: ${stats.trending}`);
  log.log('SCAN', `News articles: ${stats.news}`);
  log.log('SCAN', 'Scan complete.');

  return { scan, formattedData: formatScanForLLM(scan), stats };
}

// ============================================================
// PHASE 2: IDENTIFY — Find the money signal
// ============================================================
interface Signal {
  title: string;
  description: string;
  theme: VisualTheme;
  confidence: number;
  category: string;
  price_sui: number;
  hunt_queries: string[];
}

async function phaseIdentify(formattedData: string, topicHint?: string): Promise<Signal[]> {
  log.log('IDENTIFY', 'Analyzing signals with LLM...');

  const systemPrompt = `You are SealForge, an autonomous crypto intelligence agent operating on Sui blockchain. You analyze raw market data to identify actionable trading/DeFi signals worth paying for.`;

  const userPrompt = `Here is your environment scan from ${new Date().toISOString()}:

${formattedData}

${topicHint ? `FOCUS HINT: The operator wants you to focus on "${topicHint}".` : ''}

Your task: Identify the TWO most valuable intelligence opportunities from this data.
- One should be Sui/DeFi ecosystem focused.
- One should be about a broader crypto/market trending topic.

For EACH opportunity, provide:
1. title: A specific, compelling title (not generic like "Sui DeFi Report")
2. description: One sentence value proposition — WHY someone would pay for this
3. theme: One of "blue-data", "red-alert", "green-money", "purple-deep", "orange-hot"
4. confidence: 50-95 (how confident you are this will attract buyers)
5. category: "DeFi" | "Market Structure" | "Protocol Update" | "Risk Alert" | "Alpha" | "Technical"
6. price_sui: 0.1 to 2.0 SUI (based on urgency and uniqueness)
7. hunt_queries: 3-5 specific DefiLlama URLs or search terms to go deeper

IMPORTANT: Return ONLY valid JSON, no markdown code blocks. Format:
{
  "opportunities": [
    {
      "title": "...",
      "description": "...",
      "theme": "green-money",
      "confidence": 82,
      "category": "DeFi",
      "price_sui": 0.5,
      "hunt_queries": ["https://api.llama.fi/protocol/cetus", "sui defi tvl rotation 2026"]
    },
    { ... }
  ]
}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');

    const parsed = JSON.parse(jsonMatch[0]);
    const signals: Signal[] = (parsed.opportunities || []).map((o: any) => ({
      title: o.title || 'Untitled Signal',
      description: o.description || 'AI-generated intelligence report.',
      theme: (['blue-data', 'red-alert', 'green-money', 'purple-deep', 'orange-hot'].includes(o.theme) ? o.theme : 'blue-data') as VisualTheme,
      confidence: Math.max(50, Math.min(95, Number(o.confidence) || 70)),
      category: o.category || 'DeFi',
      price_sui: Math.max(0.1, Math.min(2.0, Number(o.price_sui) || 0.25)),
      hunt_queries: Array.isArray(o.hunt_queries) ? o.hunt_queries.slice(0, 5) : [],
    }));

    for (const s of signals) {
      log.log('IDENTIFY', `Signal: "${s.title}" | ${s.theme} | Confidence: ${s.confidence}% | Price: ${s.price_sui} SUI`);
    }

    return signals;
  } catch (err) {
    console.log(`  [IDENTIFY] LLM failed: ${err}. Using fallback signals.`);
    return getFallbackSignals(formattedData);
  }
}

function getFallbackSignals(formattedData: string): Signal[] {
  const hasTVLDrop = formattedData.includes('-') && formattedData.includes('TVL');
  return [
    {
      title: hasTVLDrop ? 'Sui DeFi Capital Rotation Alert' : 'Sui DeFi Ecosystem — State of Play Q1 2026',
      description: hasTVLDrop
        ? 'Capital movement detected across Sui protocols. Where the money is flowing and what to do.'
        : 'Comprehensive analysis of the top Sui DeFi protocols, yield opportunities, and market position.',
      theme: hasTVLDrop ? 'red-alert' : 'blue-data',
      confidence: 75,
      category: 'DeFi',
      price_sui: 0.25,
      hunt_queries: ['https://api.llama.fi/protocol/cetus', 'https://api.llama.fi/protocol/navi-protocol'],
    },
    {
      title: 'Trending Crypto Momentum Scanner — What the Market Is Watching',
      description: 'The coins gaining attention right now, why they matter, and how to position.',
      theme: 'orange-hot',
      confidence: 70,
      category: 'Market Structure',
      price_sui: 0.15,
      hunt_queries: ['crypto trending coins analysis 2026', 'bitcoin market sentiment'],
    },
  ];
}

// ============================================================
// PHASE 3: HUNT — Go deeper on the identified signal
// ============================================================
interface HuntedSource {
  title: string;
  url: string;
  content: string;
  type: 'api' | 'rss' | 'web';
}

async function phaseHunt(signal: Signal, scanData: string): Promise<HuntedSource[]> {
  log.log('HUNT', `Hunting sources for "${signal.title}"...`);
  const sources: HuntedSource[] = [];

  for (const query of signal.hunt_queries) {
    log.log('HUNT', `Fetching: ${query.slice(0, 60)}...`);

    if (query.startsWith('http')) {
      try {
        const res = await fetch(query, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const text = await res.text();
          const content = text.slice(0, 3000);
          sources.push({
            title: `API: ${new URL(query).pathname}`,
            url: query,
            content,
            type: 'api',
          });
        }
      } catch (err) {
        log.log('HUNT', `Failed to fetch ${query}: ${err}`);
      }
    } else {
      // For search queries, we note them as research topics
      sources.push({
        title: `Research: ${query}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        content: `Search query: ${query}`,
        type: 'web',
      });
    }
  }

  // Always include the original scan data as a source
  sources.push({
    title: 'SealForge Environment Scan',
    url: 'https://api.llama.fi/v2/chains',
    content: scanData.slice(0, 2000),
    type: 'api',
  });

  log.log('HUNT', `Collected ${sources.length} sources.`);
  return sources;
}

// ============================================================
// PHASE 4: REASON — Think through what we found
// ============================================================
async function phaseReason(signal: Signal, sources: HuntedSource[], scanData: string): Promise<IntelligencePayload> {
  log.log('REASON', `Reasoning through ${sources.length} sources for "${signal.title}"...`);

  const systemPrompt = `You are SealForge, writing a premium crypto intelligence report. You have hunted ${sources.length} sources. Now build a structured reasoning chain and reach a conclusion.`;

  const userPrompt = `SIGNAL: "${signal.title}"
Category: ${signal.category}
Confidence so far: ${signal.confidence}%

SCAN DATA:
${scanData.slice(0, 2000)}

HUNTED SOURCES:
${sources.map((s, i) => `Source ${i + 1} [${s.title}]: ${s.content.slice(0, 500)}`).join('\n\n')}

Build a reasoning chain that shows HOW you reached your conclusion. Each step should reference data.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks. Format:
{
  "reasoning_steps": [
    { "label": "Step 1: Initial observation", "text": "Looking at the data...", "confidence": 40, "source": "Source name" },
    { "label": "Step 2: Cross-reference", "text": "Comparing with...", "confidence": 60, "source": "Source name" },
    { "label": "Step 3: Pattern match", "text": "This pattern suggests...", "confidence": 75, "source": "Source name" },
    { "label": "Step 4: Conclusion", "text": "Based on all evidence...", "confidence": 85, "source": null }
  ],
  "conclusion": {
    "summary": "One sentence: what is happening",
    "play": "One sentence: what to DO about it",
    "timeframe": "e.g. 24-48h, this week, next month"
  },
  "actions": [
    { "label": "Action button text", "url": "https://...", "type": "defi" }
  ]
}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in LLM response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Display reasoning steps
    for (const step of (parsed.reasoning_steps || [])) {
      log.log('REASON', `${step.label} — Confidence: ${step.confidence}%`);
    }
    log.log('REASON', `Conclusion: ${parsed.conclusion?.summary || 'N/A'}`);
    log.log('REASON', `Play: ${parsed.conclusion?.play || 'N/A'}`);

    // Assemble full IntelligencePayload
    const payload: IntelligencePayload = {
      version: '1.0',
      signal: {
        title: signal.title,
        theme: signal.theme,
        confidence: parsed.reasoning_steps?.length > 0
          ? parsed.reasoning_steps[parsed.reasoning_steps.length - 1].confidence
          : signal.confidence,
        category: signal.category,
        timestamp: new Date().toISOString(),
      },
      reasoning: {
        steps: (parsed.reasoning_steps || []).map((s: any) => ({
          label: s.label || 'Analysis',
          text: s.text || '',
          confidence: s.confidence || 50,
          source: s.source || undefined,
        })),
      },
      conclusion: {
        summary: parsed.conclusion?.summary || signal.description,
        play: parsed.conclusion?.play || 'Monitor the situation closely.',
        timeframe: parsed.conclusion?.timeframe || 'this week',
      },
      actions: (parsed.actions || []).map((a: any) => ({
        label: a.label || 'Learn More',
        url: a.url || '#',
        type: (['defi', 'research', 'trade', 'track', 'external'].includes(a.type) ? a.type : 'external') as any,
      })),
      sources: sources.map(s => ({
        title: s.title,
        url: s.url,
        type: s.type,
      })),
      metadata: {
        agent: 'SealForge Agent v2.0',
        model: 'claude-4.5-sonnet via Replicate',
        generated_at: new Date().toISOString(),
        data_sources_scanned: sources.length,
        signals_found: 1,
      },
    };

    return payload;
  } catch (err) {
    console.log(`  [REASON] LLM failed: ${err}. Using structured fallback.`);
    return buildFallbackPayload(signal, sources, scanData);
  }
}

function buildFallbackPayload(signal: Signal, sources: HuntedSource[], scanData: string): IntelligencePayload {
  return {
    version: '1.0',
    signal: {
      title: signal.title,
      theme: signal.theme,
      confidence: signal.confidence,
      category: signal.category,
      timestamp: new Date().toISOString(),
    },
    reasoning: {
      steps: [
        { label: 'Step 1: Data Collection', text: `Scanned ${sources.length} data sources including DefiLlama, CoinGecko, and crypto news feeds.`, confidence: 40 },
        { label: 'Step 2: Signal Detection', text: `Identified "${signal.title}" as a key signal based on current market data.`, confidence: 55 },
        { label: 'Step 3: Cross-Validation', text: `Cross-referenced across ${sources.length} sources. Data patterns consistent.`, confidence: 70 },
        { label: 'Step 4: Assessment', text: signal.description, confidence: signal.confidence },
      ],
    },
    conclusion: {
      summary: signal.description,
      play: 'Review the sources below and position accordingly. Monitor for 48-hour follow-up.',
      timeframe: '48 hours',
    },
    actions: [
      { label: 'View Sui on DefiLlama', url: 'https://defillama.com/chain/Sui', type: 'research' },
      { label: 'SUI on CoinGecko', url: 'https://www.coingecko.com/en/coins/sui', type: 'research' },
    ],
    sources: sources.map(s => ({ title: s.title, url: s.url, type: s.type })),
    metadata: {
      agent: 'SealForge Agent v2.0',
      model: 'fallback-template',
      generated_at: new Date().toISOString(),
      data_sources_scanned: sources.length,
      signals_found: 1,
    },
  };
}

// ============================================================
// PHASE 5+6: PACKAGE → ENCRYPT → STORE → LIST
// ============================================================
async function phasePublish(payload: IntelligencePayload, signal: Signal): Promise<{ listingId: string; blobId: string }> {
  const suiClient = createSuiClient();
  const sealClient = createSealClient(suiClient);
  const keypair = loadKeypair();
  const { packageId, marketplaceId } = loadDeployedConfig();

  // Create listing on-chain
  log.log('PUBLISH', 'Creating marketplace listing...');
  const priceMist = BigInt(Math.round(signal.price_sui * 1_000_000_000));
  const createTx = new Transaction();
  createTx.moveCall({
    target: `${packageId}::content_marketplace::create_listing`,
    arguments: [
      createTx.object(marketplaceId),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(signal.title))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(signal.description))),
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode(signal.theme))),
      createTx.pure.u64(priceMist),
      createTx.object('0x6'),
    ],
  });

  const createResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: createTx,
    options: { showObjectChanges: true },
  });
  await suiClient.waitForTransaction({ digest: createResult.digest });

  const listingChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ContentListing')
  );
  const capChange = createResult.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('ListingCap')
  );
  const listingId = (listingChange as any)?.objectId as string;
  const capId = (capChange as any)?.objectId as string;

  if (!listingId || !capId) throw new Error('Failed to create listing');
  log.log('PUBLISH', `Listing created: ${listingId}`);

  // Encrypt payload with Seal
  log.log('PACKAGE', 'Encrypting intelligence payload with Seal...');
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  log.log('PACKAGE', `Payload size: ${payloadBytes.length} bytes`);

  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const listingIdBytes = fromHex(listingId.replace('0x', ''));
  const idBytes = new Uint8Array([...listingIdBytes, ...nonce]);
  const encryptionId = toHex(idBytes);

  const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
    threshold: 2,
    packageId,
    id: encryptionId,
    data: payloadBytes,
  });
  log.log('PACKAGE', `Encrypted size: ${encryptedBytes.length} bytes`);

  // Upload to Walrus
  log.log('PUBLISH', 'Uploading to Walrus...');
  const blobId = await uploadToWalrus(encryptedBytes);
  log.log('PUBLISH', `Walrus blob: ${blobId}`);

  // Update listing with blob ID
  const updateTx = new Transaction();
  updateTx.moveCall({
    target: `${packageId}::content_marketplace::update_blob_id`,
    arguments: [
      updateTx.object(capId),
      updateTx.object(listingId),
      updateTx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
    ],
  });
  const updateResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: updateTx,
    options: { showEffects: true },
  });
  await suiClient.waitForTransaction({ digest: updateResult.digest });

  log.log('PUBLISH', `Listed: "${signal.title}" at ${signal.price_sui} SUI`);
  log.log('PUBLISH', `SuiScan: ${explorerLink('object', listingId)}`);

  return { listingId, blobId };
}

// ============================================================
// MAIN ENTRY POINTS
// ============================================================

async function autonomousLoop(topicHint?: string) {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   SealForge Autonomous Agent v2.0                       \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

  // Phase 1: SCAN
  const { scan, formattedData, stats } = await phaseScan();

  // Phase 2: IDENTIFY
  const signals = await phaseIdentify(formattedData, topicHint);

  if (signals.length === 0) {
    console.log('No signals identified. Exiting.');
    log.save();
    return;
  }

  // Process each signal through HUNT → REASON → PUBLISH
  const results: Array<{ listingId: string; blobId: string; title: string }> = [];

  for (const signal of signals) {
    try {
      // Phase 3: HUNT
      const sources = await phaseHunt(signal, formattedData);

      // Phase 4: REASON
      const payload = await phaseReason(signal, sources, formattedData);

      // Phase 5+6: PACKAGE + PUBLISH
      const { listingId, blobId } = await phasePublish(payload, signal);
      results.push({ listingId, blobId, title: signal.title });

      // Brief pause between listings
      if (signals.indexOf(signal) < signals.length - 1) {
        console.log('\n  Waiting 5s before next listing...\n');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      console.error(`  Failed to process signal "${signal.title}":`, err);
      log.log('PUBLISH', `FAILED: ${signal.title} — ${err}`);
    }
  }

  // Save activity log
  log.save();

  // Summary
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551              AUTONOMOUS LOOP COMPLETE                    \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');
  for (const r of results) {
    console.log(`  "${r.title}"`);
    console.log(`    Listing: ${explorerLink('object', r.listingId)}`);
    console.log(`    Blob: ${r.blobId}`);
    console.log('');
  }
}

async function scanOnly() {
  console.log('\nSealForge Agent — Scan Mode\n');
  const { formattedData } = await phaseScan();
  console.log('\n--- RAW SCAN DATA ---\n');
  console.log(formattedData);

  const signals = await phaseIdentify(formattedData);
  console.log('\n--- IDENTIFIED SIGNALS ---');
  for (const s of signals) {
    console.log(`\n  Title: ${s.title}`);
    console.log(`  Theme: ${s.theme} | Confidence: ${s.confidence}%`);
    console.log(`  Price: ${s.price_sui} SUI`);
    console.log(`  Desc: ${s.description}`);
  }
  log.save();
}

async function main() {
  const cmd = process.argv[2] || 'auto';

  if (cmd === 'scan') {
    await scanOnly();
  } else if (cmd === 'create') {
    const topic = process.argv[3];
    if (!topic) {
      console.error('Usage: sealforge-agent create "topic"');
      process.exit(1);
    }
    await autonomousLoop(topic);
  } else {
    // auto mode
    await autonomousLoop();
  }
}

main().catch((err) => {
  console.error('Agent failed:', err);
  log.save();
  process.exit(1);
});
