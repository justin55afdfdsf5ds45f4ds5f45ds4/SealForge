/**
 * SealForge Intelligence Payload — the structured JSON that gets encrypted and sold.
 * This is what buyers see when they decrypt content via the IntelViewer.
 */

export type VisualTheme = 'blue-data' | 'red-alert' | 'green-money' | 'purple-deep' | 'orange-hot';

export interface IntelligencePayload {
  version: '1.0';
  signal: {
    title: string;
    theme: VisualTheme;
    confidence: number;       // 0-100
    category: string;         // e.g. "DeFi", "Market Structure", "Protocol Update"
    timestamp: string;        // ISO 8601
  };
  reasoning: {
    steps: Array<{
      label: string;
      text: string;
      confidence: number;     // 0-100, shows how confidence changed per step
      source?: string;        // Reference to a source title
    }>;
  };
  conclusion: {
    summary: string;
    play: string;             // The actionable takeaway
    timeframe: string;        // e.g. "24-48h", "1 week"
  };
  actions: Array<{
    label: string;
    url: string;
    type: 'defi' | 'research' | 'trade' | 'track' | 'external';
  }>;
  sources: Array<{
    title: string;
    url: string;
    type: 'api' | 'rss' | 'web';
  }>;
  metadata: {
    agent: string;
    model: string;
    generated_at: string;
    data_sources_scanned: number;
    signals_found: number;
  };
}
