import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  value: number; // 0-1
};

export default function GlowProgressBar({ value }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.bg}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
