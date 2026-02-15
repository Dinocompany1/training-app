// components/ui/GlassCard.tsx
import React from 'react';
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
};

export default function GlassCard({ children, style, onPress, elevated = true }: Props) {
  const content = <View style={[styles.inner, style]}>{children}</View>;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={onPress ? 0.85 : undefined}
      onPress={onPress}
      style={[styles.container, elevated ? styles.elevatedShadow : styles.flatShadow]}
    >
      {content}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  elevatedShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(18,22,40,0.96)', // något ljusare än bakgrunden
    borderWidth: 1,
    borderColor: '#a855f733', // mjukare lila slinga
  },
  flatShadow: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
});
