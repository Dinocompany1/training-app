import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { colors, gradients, typography } from '../../constants/theme';
import { toast } from '../../utils/toast';

type Props = {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  toastMessage?: string;
  accessibilityLabel?: string;
  variant?: 'primary' | 'green' | 'ghost';
  hideIcon?: boolean;
};

export default function NeonButton({
  title,
  onPress,
  style,
  disabled,
  toastMessage,
  accessibilityLabel,
  variant = 'primary',
  hideIcon = false,
}: Props) {
  const isGreen = variant === 'green';
  const isGhost = variant === 'ghost';
  const gradientColors = isGreen
    ? [colors.success, '#34d399']
    : [colors.primary, colors.primaryBright];
  const shadowStyle = isGreen
    ? { shadowColor: colors.success }
    : { shadowColor: colors.primary };

  if (isGhost) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          onPress();
          if (toastMessage) toast(toastMessage);
        }}
        disabled={disabled}
        style={[styles.shadow, styles.ghostShadow, disabled && styles.disabled, style]}
        accessibilityLabel={accessibilityLabel || title}
        accessibilityRole="button"
      >
        <View style={styles.ghostButton}>
          <Text style={styles.ghostText}>{title}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        onPress();
        if (toastMessage) toast(toastMessage);
      }}
      disabled={disabled}
      style={[styles.shadow, shadowStyle, disabled && styles.disabled, style]}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ghostShadow: {
    shadowColor: colors.primary,
  },
  button: {
    borderRadius: 16,
    minHeight: 46,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodyBold,
    color: '#0b1220',
    fontSize: 15,
  },
  ghostButton: {
    borderRadius: 16,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSoft,
  },
  ghostText: {
    ...typography.bodyBold,
    color: colors.primaryBright,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
