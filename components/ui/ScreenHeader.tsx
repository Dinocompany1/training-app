import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, typography, uiTones } from '../../constants/theme';

type HeaderTone = keyof typeof uiTones;

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  kicker?: string;
  compact?: boolean;
  tone?: HeaderTone;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  kickerStyle?: StyleProp<TextStyle>;
};

export default function ScreenHeader({
  title,
  subtitle,
  kicker,
  compact = false,
  tone = 'neutral',
  style,
  titleStyle,
  subtitleStyle,
  kickerStyle,
}: ScreenHeaderProps) {
  const toneStyles = uiTones[tone];
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, style]}>
      {kicker ? (
        <Text
          style={[
            styles.kicker,
            compact ? styles.kickerCompact : null,
            { color: toneStyles.kicker },
            kickerStyle,
          ]}
        >
          {kicker}
        </Text>
      ) : null}
      <Text style={[styles.title, compact ? styles.titleCompact : null, titleStyle]}>{title}</Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            compact ? styles.subtitleCompact : null,
            { color: toneStyles.text },
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  wrapCompact: {
    marginBottom: 0,
  },
  kicker: {
    ...typography.micro,
    color: '#93c5fd',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kickerCompact: {
    marginBottom: 2,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
    fontSize: 26,
    lineHeight: 32,
  },
  titleCompact: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 24,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 4,
  },
  subtitleCompact: {
    ...typography.caption,
    marginTop: 2,
  },
});
