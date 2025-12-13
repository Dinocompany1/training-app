import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  width?: number | string;
  height?: number;
};

export default function SkeletonRow({ width = '100%', height = 12 }: Props) {
  return <View style={[styles.shimmer, { width, height }]} />;
}

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginVertical: 4,
  },
});
