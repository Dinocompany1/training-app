const normalize = (value?: string | null) => {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const appConfig = {
  privacyPolicyUrl: normalize(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
  termsUrl: normalize(process.env.EXPO_PUBLIC_TERMS_URL),
  supportEmail: normalize(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
};

