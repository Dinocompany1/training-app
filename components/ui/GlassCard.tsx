// components/ui/GlassCard.tsx
import React from 'react';
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { uiTones } from '../../constants/theme';

type CardTone = keyof typeof uiTones;

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  tone?: CardTone;
};

export default function GlassCard({
  children,
  style,
  onPress,
  elevated = true,
  tone = 'neutral',
}: Props) {
  const toneStyles = uiTones[tone] || uiTones.neutral;
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const cardRadius =
    typeof flattenedStyle.borderRadius === 'number'
      ? flattenedStyle.borderRadius
      : styles.container.borderRadius;
  const content = (
    <View
      style={[
        styles.inner,
        { borderRadius: cardRadius },
        { backgroundColor: toneStyles.background, borderColor: toneStyles.border },
        style,
      ]}
    >
      {children}
    </View>
  );

  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={onPress ? 0.85 : undefined}
      onPress={onPress}
      style={[
        styles.container,
        { borderRadius: cardRadius },
        elevated ? styles.elevatedShadow : styles.flatShadow,
      ]}
    >
      {content}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
  },
  elevatedShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  flatShadow: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
});
