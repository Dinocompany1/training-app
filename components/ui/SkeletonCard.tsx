import React from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  height?: number;
  style?: ViewStyle;
};

export default function SkeletonCard({ height = 90, style }: Props) {
  const opacity = React.useRef(new Animated.Value(0.45)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { height }, style]}>
      <Animated.View style={[styles.shimmer, { opacity }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: colors.backgroundSoft,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 10,
  },
  shimmer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
