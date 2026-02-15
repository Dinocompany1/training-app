import type { AppLang } from './date';

export type AIInsightRequest = {
  lang: AppLang;
  todayISO: string;
  period: '7d' | '30d' | 'all' | 'custom';
  weeklyGoal: number;
  summary: {
    sessions: number;
    activeDays: number;
    totalMinutes: number;
    totalVolume: number;
    avgMinutes: number;
  };
  topExercises: Array<{
    name: string;
    sessions: number;
    bestWeight: number;
  }>;
};

export type AIInsightResponse = {
  summary: string;
  actions: string[];
  nextStep: string;
  confidence: 'low' | 'medium' | 'high';
  source: 'remote' | 'fallback';
};

const isInsightResponse = (value: unknown): value is Omit<AIInsightResponse, 'source'> => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.actions) &&
    obj.actions.every((item) => typeof item === 'string') &&
    typeof obj.nextStep === 'string' &&
    (obj.confidence === 'low' || obj.confidence === 'medium' || obj.confidence === 'high')
  );
};

const fallbackInsight = (payload: AIInsightRequest): AIInsightResponse => {
  const isSv = payload.lang === 'sv';
  const actions: string[] = [];

  if (payload.weeklyGoal > 0) {
    const left = Math.max(0, payload.weeklyGoal - payload.summary.sessions);
    if (left > 0) {
      actions.push(
        isSv
          ? `${left} pass kvar till veckomålet.`
          : `${left} sessions left to hit your weekly goal.`
      );
    } else {
      actions.push(isSv ? 'Veckomålet är redan uppnått.' : 'Weekly goal already achieved.');
    }
  }

  if (payload.topExercises[0]) {
    const top = payload.topExercises[0];
    actions.push(
      isSv
        ? `Fokusera på ${top.name} för nästa PB.`
        : `Focus on ${top.name} for your next PR.`
    );
  } else {
    actions.push(
      isSv ? 'Logga fler övningar för bättre insikter.' : 'Log more exercises to unlock better insights.'
    );
  }

  if (payload.summary.avgMinutes < 30 && payload.summary.sessions > 0) {
    actions.push(
      isSv ? 'Öka passen med 5-10 minuter för mer volym.' : 'Add 5-10 minutes per session for more volume.'
    );
  }

  return {
    summary: isSv
      ? `Du har ${payload.summary.sessions} pass i perioden och ${payload.summary.activeDays} aktiva dagar.`
      : `You logged ${payload.summary.sessions} sessions in this period and ${payload.summary.activeDays} active days.`,
    actions: actions.slice(0, 3),
    nextStep:
      actions[0] ||
      (isSv ? 'Fortsätt logga pass regelbundet.' : 'Keep logging sessions consistently.'),
    confidence: 'medium',
    source: 'fallback',
  };
};

export const getAIInsight = async (payload: AIInsightRequest): Promise<AIInsightResponse> => {
  const endpoint = process.env.EXPO_PUBLIC_AI_INSIGHTS_URL;
  if (!endpoint) return fallbackInsight(payload);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return fallbackInsight(payload);
    const data = (await response.json()) as unknown;
    if (!isInsightResponse(data)) return fallbackInsight(payload);
    return { ...data, source: 'remote' };
  } catch {
    return fallbackInsight(payload);
  }
};

