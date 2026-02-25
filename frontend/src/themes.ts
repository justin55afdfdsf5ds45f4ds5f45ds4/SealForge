export type VisualTheme = 'blue-data' | 'red-alert' | 'green-money' | 'purple-deep' | 'orange-hot';

export interface ThemeConfig {
  gradient: string;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  accentBg: string;
  border: string;
  icon: string;
  label: string;
  glow: string;
}

export const THEMES: Record<VisualTheme, ThemeConfig> = {
  'blue-data': {
    gradient: 'from-blue-600 to-cyan-500',
    gradientFrom: '#2563eb',
    gradientTo: '#06b6d4',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: '\u{1F4CA}',
    label: 'DATA SIGNAL',
    glow: 'shadow-blue-500/20',
  },
  'red-alert': {
    gradient: 'from-red-600 to-orange-500',
    gradientFrom: '#dc2626',
    gradientTo: '#f97316',
    accent: 'text-red-400',
    accentBg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: '\u{1F6A8}',
    label: 'HIGH ALERT',
    glow: 'shadow-red-500/20',
  },
  'green-money': {
    gradient: 'from-green-600 to-emerald-500',
    gradientFrom: '#16a34a',
    gradientTo: '#10b981',
    accent: 'text-green-400',
    accentBg: 'bg-green-500/20',
    border: 'border-green-500/30',
    icon: '\u{1F4B0}',
    label: 'ALPHA SIGNAL',
    glow: 'shadow-green-500/20',
  },
  'purple-deep': {
    gradient: 'from-purple-600 to-violet-500',
    gradientFrom: '#9333ea',
    gradientTo: '#8b5cf6',
    accent: 'text-purple-400',
    accentBg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    icon: '\u{1F52C}',
    label: 'DEEP ANALYSIS',
    glow: 'shadow-purple-500/20',
  },
  'orange-hot': {
    gradient: 'from-orange-600 to-amber-500',
    gradientFrom: '#ea580c',
    gradientTo: '#f59e0b',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    icon: '\u{1F525}',
    label: 'TRENDING',
    glow: 'shadow-orange-500/20',
  },
};

export function getTheme(name: string): ThemeConfig {
  return THEMES[name as VisualTheme] || THEMES['blue-data'];
}
