// constants/theme.ts
export const colors = {
  // Primär lila-identitet
  primary: '#a855f7',
  primaryBright: '#c084fc',
  primarySoft: 'rgba(168,85,247,0.16)',
  secondary: '#7c3aed',
  accent: '#ec4899',
  success: '#22c55e',
  warning: '#f59e0b',
  // legacy aliases (behåll för kompabilitet)
  accentBlue: '#3b82f6',
  accentGreen: '#22c55e',
  accentPurple: '#c084fc',

  // Neutrala ytor
  background: '#050414',
  backgroundSoft: '#0b0a1f',
  surface: '#0f1024',
  surfaceElevated: '#131530',
  cardBorder: 'rgba(168,85,247,0.24)',

  // Text
  textMain: '#f9fafb',
  textMuted: '#cbd5e1',
  textSoft: '#94a3b8',

  // Ikoner / chips
  iconBg: 'rgba(168,85,247,0.14)',
};

export const typography = {
  display: { fontFamily: 'Georgia', fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  title: { fontFamily: 'Georgia', fontSize: 18, lineHeight: 24, fontWeight: '800' as const },
  subtitle: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  body: { fontFamily: 'System', fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  bodyBold: { fontFamily: 'System', fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  caption: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  micro: { fontFamily: 'System', fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const gradients = {
  appBackground: ['#030312', '#050414', '#0a0820'] as const,
  progress: ['#a855f7', '#7c3aed'] as const,
  primaryButton: ['#a855f7', '#c084fc'] as const,
  streak: ['#7c3aed', '#c084fc'] as const,
  outlineFill: ['#0b0a1f', '#0f1024'] as const,
};

// Legacy compatibility for Expo starter files that reference Colors.light/dark.
export const Colors = {
  light: {
    text: colors.textMain,
    background: '#ffffff',
    tint: colors.primary,
    icon: colors.textSoft,
    tabIconDefault: colors.textSoft,
    tabIconSelected: colors.primary,
  },
  dark: {
    text: colors.textMain,
    background: colors.background,
    tint: colors.primary,
    icon: colors.textSoft,
    tabIconDefault: colors.textSoft,
    tabIconSelected: colors.primary,
  },
} as const;
