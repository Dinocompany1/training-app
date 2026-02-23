import React from 'react';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii, typography } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const variantStyle = {
    primary: styles.primary,
    secondary: styles.secondary,
    success: styles.success,
    danger: styles.danger,
    ghost: styles.ghost,
  }[variant];

  const textStyle = {
    primary: styles.textLight,
    secondary: styles.textLight,
    success: styles.textDark,
    danger: styles.textLight,
    ghost: styles.textLight,
  }[variant];

  const handlePressIn = () => {
    if (disabled) return;
    animateTo(0.98);
    if (variant === 'danger') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
  };

  const handlePressOut = () => {
    animateTo(1);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={({ pressed }) => [
          styles.base,
          variantStyle,
          disabled ? styles.disabled : null,
          pressed && !disabled ? styles.pressed : null,
          style,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
      >
        <Text style={[styles.textBase, textStyle]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryBright,
  },
  secondary: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  success: {
    backgroundColor: colors.accentGreen,
    borderColor: '#86efac',
  },
  danger: {
    backgroundColor: '#b91c1c',
    borderColor: '#f87171',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: '#475569',
  },
  textBase: {
    ...typography.bodyBold,
    fontWeight: '800',
  },
  textLight: {
    color: colors.textMain,
  },
  textDark: {
    color: '#032e1f',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.92,
  },
});
