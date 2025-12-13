// constants/theme.ts
export const colors = {
  // Primär lila-identitet
  primary: '#a855f7',
  primaryBright: '#c084fc',
  secondary: '#7c3aed',
  accent: '#ec4899',
  success: '#22c55e',
  warning: '#f59e0b',
  // legacy aliases (behåll för kompabilitet)
  accentBlue: '#7c3aed',
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

export const gradients = {
  appBackground: ['#030312', '#050414', '#0a0820'],
  progress: ['#a855f7', '#7c3aed'],
  primaryButton: ['#a855f7', '#c084fc'],
  streak: ['#7c3aed', '#c084fc'],
  outlineFill: ['#0b0a1f', '#0f1024'],
};
