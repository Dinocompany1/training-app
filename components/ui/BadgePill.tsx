import React from 'react';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii } from '../../constants/theme';

type Props = {
  label: string;
  tone?: 'primary' | 'neutral' | 'success';
  style?: ViewStyle;
  onPress?: () => void;
};

export default function BadgePill({ label, tone = 'neutral', style, onPress }: Props) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const interactive = Boolean(onPress);

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

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

  if (!interactive) {
    return (
      <View style={[styles.pill, toneStyle, style]}>
        <Text style={[styles.text, textStyle]} accessible={false}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={({ pressed }) => [styles.pill, toneStyle, pressed ? styles.pressed : null, style]}
        onPressIn={() => {
          animateTo(0.98);
          Haptics.selectionAsync();
        }}
        onPressOut={() => animateTo(1)}
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <Text style={[styles.text, textStyle]} accessible={false}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
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
  pressed: {
    opacity: 0.92,
  },
});
