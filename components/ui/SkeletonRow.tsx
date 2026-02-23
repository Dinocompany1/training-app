import React from 'react';
import { Animated, DimensionValue, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
};

export default function SkeletonRow({ width = '100%', height = 12 }: Props) {
  const opacity = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.shimmer, { width, height, opacity }]} />;
}

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginVertical: 4,
  },
});
