import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, radii } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

type Props = {
  onPress?: () => void;
  style?: ViewStyle;
};

export default function BackPill({ onPress, style }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null, style]}
        onPressIn={() => {
          animateTo(0.97);
          Haptics.selectionAsync();
        }}
        onPressOut={() => animateTo(1)}
        onPress={() => {
          if (onPress) onPress();
          else router.back();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft size={16} color={colors.textSoft} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#050b16',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.92,
  },
});
