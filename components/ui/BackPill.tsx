import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, typography } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

type Props = {
  onPress?: () => void;
  style?: ViewStyle;
};

export default function BackPill({ onPress, style }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={() => {
        if (onPress) onPress();
        else router.back();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <ArrowLeft size={16} color={colors.textSoft} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#050b16',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
});
