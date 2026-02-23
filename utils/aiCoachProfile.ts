import storage from './safeStorage';

export const AI_COACH_PROFILE_KEY = 'ai-coach-profile-v1';

export type AICoachProfile = {
  goal: string;
  focusExercises: string;
  limitations: string;
  schedule: string;
  preferences: string;
};

export const EMPTY_AI_COACH_PROFILE: AICoachProfile = {
  goal: '',
  focusExercises: '',
  limitations: '',
  schedule: '',
  preferences: '',
};

const cleanText = (value: unknown, maxLength = 220) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

export const sanitizeAICoachProfile = (value: unknown): AICoachProfile => {
  if (!value || typeof value !== 'object') return { ...EMPTY_AI_COACH_PROFILE };
  const raw = value as Record<string, unknown>;
  return {
    goal: cleanText(raw.goal, 220),
    focusExercises: cleanText(raw.focusExercises, 240),
    limitations: cleanText(raw.limitations, 260),
    schedule: cleanText(raw.schedule, 220),
    preferences: cleanText(raw.preferences, 260),
  };
};

export const hasAICoachProfileData = (profile: AICoachProfile) =>
  Boolean(
    profile.goal ||
      profile.focusExercises ||
      profile.limitations ||
      profile.schedule ||
      profile.preferences
  );

export const loadAICoachProfile = async (): Promise<AICoachProfile> => {
  try {
    const raw = await storage.getItem(AI_COACH_PROFILE_KEY);
    if (!raw) return { ...EMPTY_AI_COACH_PROFILE };
    return sanitizeAICoachProfile(JSON.parse(raw));
  } catch {
    return { ...EMPTY_AI_COACH_PROFILE };
  }
};

export const saveAICoachProfile = async (profile: AICoachProfile) => {
  const safe = sanitizeAICoachProfile(profile);
  await storage.setItem(AI_COACH_PROFILE_KEY, JSON.stringify(safe));
};
