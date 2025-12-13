import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  height?: number;
  style?: ViewStyle;
};

export default function SkeletonCard({ height = 90, style }: Props) {
  return (
    <View style={[styles.card, { height }, style]}>
      <View style={[styles.shimmer]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#0b1220',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
    marginBottom: 10,
  },
  shimmer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
