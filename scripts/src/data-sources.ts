/**
 * Data sources for the SealForge autonomous agent.
 * All free, no API keys required.
 */

// === Types ===

export interface SuiChainData {
  tvl: number;
  change_1d: number;
  change_7d: number;
  name: string;
}

export interface YieldPool {
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  pool: string;
  chain: string;
}

export interface ProtocolData {
  name: string;
  tvl: number;
  change_1d: number;
  change_7d: number;
  category: string;
  chains: string[];
}

export interface TrendingCoin {
  name: string;
  symbol: string;
  market_cap_rank: number;
  price_btc: number;
  score: number;
}

export interface SuiPrice {
  usd: number;
  usd_24h_change: number;
  usd_market_cap: number;
}

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

export interface ScanResult {
  suiChain: SuiChainData | null;
  suiYields: YieldPool[];
  suiProtocols: ProtocolData[];
  trending: TrendingCoin[];
  suiPrice: SuiPrice | null;
  news: RSSItem[];
}

// === DefiLlama ===

export async function fetchSuiChainTVL(): Promise<SuiChainData | null> {
  try {
    const res = await fetch('https://api.llama.fi/v2/chains');
    const chains = await res.json() as any[];
    const sui = chains.find((c: any) => c.name === 'Sui');
    if (!sui) return null;
    return {
      tvl: sui.tvl,
      change_1d: sui.change_1d ?? 0,
      change_7d: sui.change_7d ?? 0,
      name: 'Sui',
    };
  } catch (err) {
    console.log(`  [DATA] DefiLlama chains failed: ${err}`);
    return null;
  }
}

export async function fetchSuiYields(): Promise<YieldPool[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools');
    const data = await res.json() as any;
    const pools = (data.data || [])
      .filter((p: any) => p.chain === 'Sui')
      .sort((a: any, b: any) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      .slice(0, 25);
    return pools.map((p: any) => ({
      project: p.project || 'unknown',
      symbol: p.symbol || '???',
      apy: p.apy || 0,
      tvlUsd: p.tvlUsd || 0,
      pool: p.pool || '',
      chain: 'Sui',
    }));
  } catch (err) {
    console.log(`  [DATA] DefiLlama yields failed: ${err}`);
    return [];
  }
}

export async function fetchSuiProtocols(): Promise<ProtocolData[]> {
  try {
    const res = await fetch('https://api.llama.fi/protocols');
    const protocols = await res.json() as any[];
    return protocols
      .filter((p: any) => (p.chains || []).includes('Sui'))
      .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 20)
      .map((p: any) => ({
        name: p.name,
        tvl: p.tvl || 0,
        change_1d: p.change_1d ?? 0,
        change_7d: p.change_7d ?? 0,
        category: p.category || 'unknown',
        chains: p.chains || [],
      }));
  } catch (err) {
    console.log(`  [DATA] DefiLlama protocols failed: ${err}`);
    return [];
  }
}

// === CoinGecko ===

export async function fetchTrending(): Promise<TrendingCoin[]> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
    const data = await res.json() as any;
    return (data.coins || []).slice(0, 10).map((c: any) => ({
      name: c.item?.name || 'unknown',
      symbol: c.item?.symbol || '???',
      market_cap_rank: c.item?.market_cap_rank || 0,
      price_btc: c.item?.price_btc || 0,
      score: c.item?.score || 0,
    }));
  } catch (err) {
    console.log(`  [DATA] CoinGecko trending failed: ${err}`);
    return [];
  }
}

export async function fetchSuiPrice(): Promise<SuiPrice | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd&include_24hr_change=true&include_market_cap=true');
    const data = await res.json() as any;
    if (!data.sui) return null;
    return {
      usd: data.sui.usd || 0,
      usd_24h_change: data.sui.usd_24h_change || 0,
      usd_market_cap: data.sui.usd_market_cap || 0,
    };
  } catch (err) {
    console.log(`  [DATA] CoinGecko SUI price failed: ${err}`);
    return null;
  }
}

// === RSS Feeds ===

function parseRSSXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
    const link = block.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1]?.trim() || '';
    const description = block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.trim() || '';

    if (title) {
      items.push({ title, link, pubDate, description: description.slice(0, 200) });
    }
  }
  return items;
}

export async function fetchRSS(url: string, label: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SealForge-Agent/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSXML(xml).slice(0, 10);
  } catch (err) {
    console.log(`  [DATA] RSS ${label} failed: ${err}`);
    return [];
  }
}

// === Main Scanner ===

const RSS_FEEDS = [
  { url: 'https://blog.sui.io/feed', label: 'Sui Blog' },
  { url: 'https://cointelegraph.com/rss', label: 'CoinTelegraph' },
  { url: 'https://decrypt.co/feed', label: 'Decrypt' },
];

export async function scanAllSources(): Promise<ScanResult> {
  console.log('  Fetching DefiLlama, CoinGecko, RSS feeds in parallel...');

  const [suiChain, suiYields, suiProtocols, trending, suiPrice, ...rssResults] = await Promise.all([
    fetchSuiChainTVL(),
    fetchSuiYields(),
    fetchSuiProtocols(),
    fetchTrending(),
    fetchSuiPrice(),
    ...RSS_FEEDS.map(f => fetchRSS(f.url, f.label)),
  ]);

  const news = rssResults.flat();

  return { suiChain, suiYields, suiProtocols, trending, suiPrice, news };
}

/**
 * Format scan results into a text dump suitable for LLM analysis.
 */
export function formatScanForLLM(scan: ScanResult): string {
  const parts: string[] = [];

  if (scan.suiChain) {
    parts.push(`=== SUI CHAIN ===
TVL: $${(scan.suiChain.tvl / 1e9).toFixed(2)}B | 24h: ${scan.suiChain.change_1d > 0 ? '+' : ''}${scan.suiChain.change_1d.toFixed(2)}% | 7d: ${scan.suiChain.change_7d > 0 ? '+' : ''}${scan.suiChain.change_7d.toFixed(2)}%`);
  }

  if (scan.suiPrice) {
    parts.push(`=== SUI PRICE ===
$${scan.suiPrice.usd.toFixed(4)} | 24h: ${scan.suiPrice.usd_24h_change > 0 ? '+' : ''}${scan.suiPrice.usd_24h_change.toFixed(2)}% | MCap: $${(scan.suiPrice.usd_market_cap / 1e9).toFixed(2)}B`);
  }

  if (scan.suiProtocols.length > 0) {
    parts.push(`=== TOP SUI PROTOCOLS (by TVL) ===
${scan.suiProtocols.slice(0, 15).map(p =>
  `- ${p.name} | ${p.category} | TVL: $${(p.tvl / 1e6).toFixed(1)}M | 24h: ${p.change_1d > 0 ? '+' : ''}${p.change_1d.toFixed(1)}% | 7d: ${p.change_7d > 0 ? '+' : ''}${p.change_7d.toFixed(1)}%`
).join('\n')}`);
  }

  if (scan.suiYields.length > 0) {
    parts.push(`=== TOP SUI YIELD POOLS ===
${scan.suiYields.slice(0, 15).map(p =>
  `- ${p.project} | ${p.symbol} | APY: ${p.apy.toFixed(2)}% | TVL: $${(p.tvlUsd / 1e6).toFixed(1)}M`
).join('\n')}`);
  }

  if (scan.trending.length > 0) {
    parts.push(`=== TRENDING COINS (CoinGecko) ===
${scan.trending.map(c =>
  `- ${c.name} (${c.symbol}) — rank #${c.market_cap_rank}`
).join('\n')}`);
  }

  if (scan.news.length > 0) {
    parts.push(`=== RECENT NEWS ===
${scan.news.slice(0, 15).map(n =>
  `- [${n.pubDate || 'recent'}] ${n.title}`
).join('\n')}`);
  }

  return parts.join('\n\n');
}
