import { usePathname, useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, typography } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

export default function AICoachFab() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname === '/ai-coach') return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
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
    bottom: 92,
    zIndex: 300,
  },
  fab: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffffff30',
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
  },
});
