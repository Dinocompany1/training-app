import React from 'react';
import { Text, View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  label: string;
  tone?: 'primary' | 'neutral' | 'success';
  style?: ViewStyle;
  onPress?: () => void;
};

export default function BadgePill({ label, tone = 'neutral', style, onPress }: Props) {
  const toneStyle =
    tone === 'primary'
      ? styles.primary
      : tone === 'success'
      ? styles.success
      : styles.neutral;
  const textStyle =
    tone === 'primary'
      ? styles.primaryText
      : tone === 'success'
      ? styles.successText
      : styles.neutralText;

  const Comp = onPress ? TouchableOpacity : View;
  return (
    <Comp
      style={[styles.pill, toneStyle, style]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={label}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={[styles.text, textStyle]} accessible={false}>
        {label}
      </Text>
    </Comp>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
  primary: {
    backgroundColor: '#0f172a',
    borderColor: colors.primary,
  },
  primaryText: {
    color: colors.primary,
  },
  neutral: {
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
  },
  neutralText: {
    color: colors.textSoft,
  },
  success: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  successText: {
    color: '#bbf7d0',
  },
});
