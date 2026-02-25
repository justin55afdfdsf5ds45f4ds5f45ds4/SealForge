export type VisualTheme = 'blue-data' | 'red-alert' | 'green-money' | 'purple-deep' | 'orange-hot';

export interface IntelligencePayload {
  version: '1.0';
  signal: {
    title: string;
    theme: VisualTheme;
    confidence: number;
    category: string;
    timestamp: string;
  };
  reasoning: {
    steps: Array<{
      label: string;
      text: string;
      confidence: number;
      source?: string;
    }>;
  };
  conclusion: {
    summary: string;
    play: string;
    timeframe: string;
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
