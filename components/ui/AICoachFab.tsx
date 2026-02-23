import { usePathname, useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

export default function AICoachFab() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (pathname === '/ai-coach') return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 72 + insets.bottom }]}>
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => router.push('/ai-coach')}
        accessibilityRole="button"
        accessibilityLabel={t('aiCoach.open')}
      >
        <Sparkles size={16} color={colors.textMain} />
        <Text style={styles.text}>{t('aiCoach.fab')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 300,
  },
  fab: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#60a5fa',
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  text: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
  },
});
