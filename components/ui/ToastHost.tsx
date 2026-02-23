import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../constants/theme';
import { subscribeToasts, ToastAction } from '../../utils/toast';

const HIDE_DELAY_MS = 2200;

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<ToastAction | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hideAnimated = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        setMessage('');
        setAction(undefined);
      });
    };

    const unsubscribe = subscribeToasts((nextToast) => {
      setMessage(nextToast.message);
      setAction(nextToast.action);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
      hideTimer.current = setTimeout(() => {
        hideAnimated();
      }, nextToast.durationMs ?? HIDE_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity, translateY]);

  if (!visible || !message) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.text}>{message}</Text>
        {action ? (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              action.onPress();
              setVisible(false);
              setMessage('');
              setAction(undefined);
            }}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 400,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '96%',
    minWidth: '65%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  text: {
    ...typography.caption,
    color: colors.textMain,
    textAlign: 'center',
    fontWeight: '700',
  },
  actionButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionText: {
    ...typography.caption,
    color: '#93c5fd',
    fontWeight: '800',
  },
});
