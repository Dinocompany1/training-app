import { Platform, ToastAndroid } from 'react-native';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastPayload = {
  message: string;
  action?: ToastAction;
  durationMs?: number;
};

type ToastInput = string | ToastPayload;
type ToastListener = (payload: ToastPayload) => void;
const listeners = new Set<ToastListener>();

export const subscribeToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const toast = (input: ToastInput) => {
  const payload: ToastPayload =
    typeof input === 'string' ? { message: input } : input;
  if (!payload.message) return;

  if (Platform.OS === 'android' && !payload.action) {
    ToastAndroid.show(payload.message, ToastAndroid.SHORT);
    return;
  }
  listeners.forEach((listener) => listener(payload));
};
