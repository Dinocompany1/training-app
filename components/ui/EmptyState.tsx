import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, typography } from '../../constants/theme';

type Props = {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onPressCta?: () => void;
};

export default function EmptyState({ title, subtitle, ctaLabel, onPressCta }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <View style={styles.iconDot} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {ctaLabel && onPressCta && (
        <TouchableOpacity style={styles.cta} onPress={onPressCta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 14,
    gap: 6,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
  cta: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.iconBg,
  },
  ctaText: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '700',
  },
});
