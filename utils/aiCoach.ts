import type { Workout } from '../context/WorkoutsContext';
import type { AppLang } from './date';
import type { AICoachProfile } from './aiCoachProfile';
import { compareISODate, parseISODate, toISODate } from './date';
import { fetchWithTimeout } from './fetchWithTimeout';
import { workoutRecencyTimestamp } from './workoutRecency';
import { supabase } from './supabaseClient';

export type AICoachContext = {
  workouts: Workout[];
  weeklyGoal: number;
  todayISO: string;
};

export type AICoachTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AICoachReply = {
  text: string;
  source: 'remote' | 'fallback';
  workoutTitle: string;
  basis: string;
};

type Intent = 'next' | 'pb' | 'summary' | 'volume' | 'balance' | 'unknown';

type ExerciseStat = {
  name: string;
  sessions: number;
  sets: number;
  reps: number;
  volume: number;
  bestWeight: number;
};

type PBEvent = {
  exercise: string;
  date: string;
  weight: number;
  delta: number;
};

type ContextAnalysis = {
  totalSessions: number;
  sessions7: number;
  sessions30: number;
  minutes7: number;
  volume7: number;
  avgMinutes7: number;
  lastWorkoutDate: string | null;
  daysSinceLast: number | null;
  topExercises: ExerciseStat[];
  topExerciseWindowDays: number;
  pbEvents30: PBEvent[];
  latestPb: PBEvent | null;
  weeklyGoal: number;
  weeklyLeft: number;
  muscleFocusTip: string | null;
};

const sanitize = (input: string) => input.trim().replace(/\s+/g, ' ');

const parseRepsValue = (reps: string) => {
  if (!reps) return 0;
  const nums = reps.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  const values = nums.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
};

const parseWeight = (weight?: number) => {
  const value = Number(weight ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
};

const workoutVolume = (workout: Workout): number =>
  (workout.exercises || []).reduce((total, ex) => {
    const sets = ex.performedSets || [];
    if (sets.length > 0) {
      return total + sets.reduce((sum, set) => {
        const reps = parseRepsValue(String(set.reps || '0'));
        const weight = parseWeight(set.weight);
        return sum + reps * weight;
      }, 0);
    }
    const reps = parseRepsValue(ex.reps || '0');
    const weight = parseWeight(ex.weight);
    return total + Math.max(0, ex.sets || 0) * reps * weight;
  }, 0);

const daysBetweenISO = (startISO: string, endISO: string): number | null => {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

const containsAny = (text: string, words: string[]) => words.some((word) => text.includes(word));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickIntentFromText = (text: string): Intent => {
  if (containsAny(text, ['nästa', 'next', 'plan', 'schema', 'pass idag', 'workout today'])) return 'next';
  if (containsAny(text, ['pb', 'pr', 'rekord', 'record', 'stark', 'stronger'])) return 'pb';
  if (containsAny(text, ['volym', 'volume', 'set', 'reps', 'för mycket', 'too much'])) return 'volume';
  if (containsAny(text, ['balans', 'muskel', 'muscle', 'ojämn', 'split'])) return 'balance';
  if (containsAny(text, ['sammanfatta', 'summary', 'status', 'översikt', 'overview'])) return 'summary';
  return 'unknown';
};

const looksLikeFollowup = (text: string) =>
  containsAny(text, [
    'och',
    'mer',
    'varför',
    'hur då',
    'förklara',
    'utveckla',
    'också',
    'then',
    'why',
    'explain',
    'more',
    'also',
    'what about',
  ]);

const pickIntent = (message: string, history: AICoachTurn[]): Intent => {
  const text = message.toLowerCase();
  const direct = pickIntentFromText(text);
  if (direct !== 'unknown') return direct;

  if (!looksLikeFollowup(text)) return 'unknown';

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn.role !== 'user') continue;
    const fromHistory = pickIntentFromText(turn.text.toLowerCase());
    if (fromHistory !== 'unknown') return fromHistory;
  }

  return 'unknown';
};

const englishMuscle = (input?: string) => {
  const key = (input || '').trim().toLowerCase();
  if (!key) return 'Other';
  if (key.includes('bröst') || key.includes('chest')) return 'Chest';
  if (key.includes('rygg') || key.includes('back')) return 'Back';
  if (key.includes('ben') || key.includes('leg')) return 'Legs';
  if (key.includes('axlar') || key.includes('shoulder')) return 'Shoulders';
  if (key.includes('arm')) return 'Arms';
  return 'Other';
};

const localizeMuscle = (muscle: string, lang: AppLang) => {
  if (lang === 'en') return muscle;
  if (muscle === 'Chest') return 'Bröst';
  if (muscle === 'Back') return 'Rygg';
  if (muscle === 'Legs') return 'Ben';
  if (muscle === 'Shoulders') return 'Axlar';
  if (muscle === 'Arms') return 'Armar';
  return 'Övrigt';
};

const analyzeContext = (context: AICoachContext): ContextAnalysis => {
  const completed = (context.workouts || []).filter((w) => w.isCompleted);
  const todayISO = context.todayISO || toISODate(new Date());

  const sortedAsc = [...completed].sort((a, b) => {
    const diff = workoutRecencyTimestamp(a) - workoutRecencyTimestamp(b);
    if (diff !== 0) return diff;
    return compareISODate(a.date, b.date);
  });
  const sortedDesc = [...completed].sort((a, b) => {
    const diff = workoutRecencyTimestamp(b) - workoutRecencyTimestamp(a);
    if (diff !== 0) return diff;
    return compareISODate(b.date, a.date);
  });

  const day7 = parseISODate(todayISO) || new Date();
  day7.setDate(day7.getDate() - 6);
  const cutoff7 = toISODate(day7);

  const day30 = parseISODate(todayISO) || new Date();
  day30.setDate(day30.getDate() - 29);
  const cutoff30 = toISODate(day30);

  const sessions7 = completed.filter((w) => compareISODate(w.date, cutoff7) >= 0);
  const sessions30 = completed.filter((w) => compareISODate(w.date, cutoff30) >= 0);

  const minutes7 = sessions7.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const volume7 = Math.round(sessions7.reduce((sum, w) => sum + workoutVolume(w), 0));

  const exerciseMap = new Map<string, ExerciseStat>();
  const recentExerciseMap = new Map<string, ExerciseStat>();
  const bestPerExercise = new Map<string, number>();
  const pbEvents30: PBEvent[] = [];
  const muscleSessions = new Map<string, number>();

  sortedAsc.forEach((workout) => {
    const uniqueMuscles = new Set<string>();

    (workout.exercises || []).forEach((ex) => {
      if (!ex.name) return;
      const key = ex.name.trim();
      if (!key) return;

      const existing = exerciseMap.get(key) || {
        name: key,
        sessions: 0,
        sets: 0,
        reps: 0,
        volume: 0,
        bestWeight: 0,
      };

      existing.sessions += 1;

      const sets = ex.performedSets || [];
      if (sets.length > 0) {
        sets.forEach((set) => {
          const reps = parseRepsValue(String(set.reps || '0'));
          const weight = parseWeight(set.weight);
          existing.sets += 1;
          existing.reps += reps;
          existing.volume += reps * weight;
          existing.bestWeight = Math.max(existing.bestWeight, weight);
        });
      } else {
        const setCount = Math.max(0, ex.sets || 0);
        const reps = parseRepsValue(ex.reps || '0');
        const weight = parseWeight(ex.weight);
        existing.sets += setCount;
        existing.reps += reps * setCount;
        existing.volume += reps * setCount * weight;
        existing.bestWeight = Math.max(existing.bestWeight, weight);
      }

      exerciseMap.set(key, existing);
      if (compareISODate(workout.date, cutoff30) >= 0) {
        const recentExisting = recentExerciseMap.get(key) || {
          name: key,
          sessions: 0,
          sets: 0,
          reps: 0,
          volume: 0,
          bestWeight: 0,
        };
        recentExisting.sessions += 1;
        if (sets.length > 0) {
          sets.forEach((set) => {
            const reps = parseRepsValue(String(set.reps || '0'));
            const weight = parseWeight(set.weight);
            recentExisting.sets += 1;
            recentExisting.reps += reps;
            recentExisting.volume += reps * weight;
            recentExisting.bestWeight = Math.max(recentExisting.bestWeight, weight);
          });
        } else {
          const setCount = Math.max(0, ex.sets || 0);
          const reps = parseRepsValue(ex.reps || '0');
          const weight = parseWeight(ex.weight);
          recentExisting.sets += setCount;
          recentExisting.reps += reps * setCount;
          recentExisting.volume += reps * setCount * weight;
          recentExisting.bestWeight = Math.max(recentExisting.bestWeight, weight);
        }
        recentExerciseMap.set(key, recentExisting);
      }

      const currentBest = bestPerExercise.get(key) || 0;
      if (existing.bestWeight > currentBest) {
        const delta = existing.bestWeight - currentBest;
        bestPerExercise.set(key, existing.bestWeight);
        if (delta > 0 && compareISODate(workout.date, cutoff30) >= 0) {
          pbEvents30.push({
            exercise: key,
            date: workout.date,
            weight: existing.bestWeight,
            delta,
          });
        }
      }

      uniqueMuscles.add(englishMuscle(ex.muscleGroup));
    });

    uniqueMuscles.forEach((muscle) => {
      muscleSessions.set(muscle, (muscleSessions.get(muscle) || 0) + 1);
    });
  });

  const topExerciseSource = recentExerciseMap.size > 0 ? recentExerciseMap : exerciseMap;
  const topExerciseWindowDays = recentExerciseMap.size > 0 ? 30 : 0;
  const topExercises = Array.from(topExerciseSource.values())
    .sort((a, b) => {
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;
      return b.volume - a.volume;
    })
    .slice(0, 3)
    .map((entry) => ({
      ...entry,
      volume: Math.round(entry.volume),
      bestWeight: Math.round(entry.bestWeight * 10) / 10,
    }));

  pbEvents30.sort((a, b) => compareISODate(b.date, a.date));
  const muscleTotals = Array.from(muscleSessions.entries()).sort((a, b) => a[1] - b[1]);
  const muscleFocusTip = muscleTotals.length > 1 ? muscleTotals[0][0] : null;

  const lastWorkoutDate = sortedDesc[0]?.date || null;
  const daysSinceLast = lastWorkoutDate ? daysBetweenISO(lastWorkoutDate, todayISO) : null;
  const weeklyLeft = Math.max(0, (context.weeklyGoal || 0) - sessions7.length);

  return {
    totalSessions: completed.length,
    sessions7: sessions7.length,
    sessions30: sessions30.length,
    minutes7,
    volume7,
    avgMinutes7: sessions7.length > 0 ? Math.round(minutes7 / sessions7.length) : 0,
    lastWorkoutDate,
    daysSinceLast,
    topExercises,
    topExerciseWindowDays,
    pbEvents30,
    latestPb: pbEvents30[0] || null,
    weeklyGoal: context.weeklyGoal || 0,
    weeklyLeft,
    muscleFocusTip,
  };
};

const formatSteps = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

const defaultCoachQuestion = (lang: AppLang) =>
  lang === 'sv'
    ? 'Vill du att jag gör ett konkret passupplägg för nästa pass?'
    : 'Do you want me to build a concrete next-session workout for you?';

type CoachTone = 'neutral' | 'direct' | 'supportive';

const detectCoachTone = (lang: AppLang, profile?: AICoachProfile | null): CoachTone => {
  const preferences = (profile?.preferences || '').toLowerCase();
  if (
    preferences.includes('hård') ||
    preferences.includes('rak') ||
    preferences.includes('tuff') ||
    preferences.includes('strict') ||
    preferences.includes('direct')
  ) {
    return 'direct';
  }
  if (
    preferences.includes('mjuk') ||
    preferences.includes('snäll') ||
    preferences.includes('lugn') ||
    preferences.includes('gentle') ||
    preferences.includes('supportive')
  ) {
    return 'supportive';
  }
  return lang === 'sv' ? 'direct' : 'neutral';
};

const profileFieldIsRelevant = (
  field: 'focusExercises' | 'limitations' | 'schedule',
  message: string
) => {
  const lower = message.toLowerCase();
  if (field === 'focusExercises') {
    return containsAny(lower, [
      'övning',
      'exercise',
      'fokus',
      'focus',
      'muskel',
      'muscle',
      'push',
      'pull',
      'legs',
      'split',
    ]);
  }
  if (field === 'limitations') {
    return containsAny(lower, [
      'skada',
      'ont',
      'smärta',
      'injury',
      'pain',
      'avoid',
      'undvika',
      'kan inte',
      "can't",
      'rehab',
    ]);
  }
  return containsAny(lower, [
    'vilka dagar',
    'which days',
    'dagar',
    'days',
    'vecka',
    'week',
    'fördela veckan',
    'weekly split',
    'week split',
    'när',
    'when',
    'calendar',
    'kalender',
    'måndag',
    'tisdag',
    'onsdag',
    'torsdag',
    'fredag',
    'lördag',
    'söndag',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]);
};

const contextualizeCoachProfile = (profile: AICoachProfile | undefined, message: string): AICoachProfile | null => {
  if (!profile) return null;
  const goal = (profile.goal || '').trim();
  // Do not send free-form preferences to the model by default:
  // they often cause overfitting ("you prefer X") even on generic questions.
  const preferences = '';
  const focusExercises = profileFieldIsRelevant('focusExercises', message) ? (profile.focusExercises || '').trim() : '';
  const limitations = profileFieldIsRelevant('limitations', message) ? (profile.limitations || '').trim() : '';
  const schedule = profileFieldIsRelevant('schedule', message) ? (profile.schedule || '').trim() : '';
  if (!goal && !preferences && !focusExercises && !limitations && !schedule) return null;
  return {
    goal,
    preferences,
    focusExercises,
    limitations,
    schedule,
  };
};

const stripUnverifiedPreferenceClaims = (
  text: string,
  message: string,
  profile: AICoachProfile | null | undefined
) => {
  const allowFocus = Boolean(profile?.focusExercises?.trim()) && profileFieldIsRelevant('focusExercises', message);
  const allowSchedule = Boolean(profile?.schedule?.trim()) && profileFieldIsRelevant('schedule', message);
  const allowLimitations = Boolean(profile?.limitations?.trim()) && profileFieldIsRelevant('limitations', message);

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      if (
        !allowFocus &&
        (lower.includes('du föredrar') ||
          lower.includes('fokus på push') ||
          lower.includes('focus on push') ||
          lower.includes('you prefer'))
      ) {
        return false;
      }
      if (
        !allowSchedule &&
        (lower.includes('du tränar helst') ||
          lower.includes('helst på') ||
          lower.includes('train mainly on') ||
          lower.includes('prefer to train on'))
      ) {
        return false;
      }
      if (
        !allowLimitations &&
        (lower.includes('du undviker') ||
          lower.includes('avoid running') ||
          lower.includes('undviker löpning'))
      ) {
        return false;
      }
      return true;
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const isYesNoLikeQuestion = (message: string) => {
  const lower = message.trim().toLowerCase();
  return /^(ska|bör|kan|är|får|is|are|can|should|do)\b/.test(lower);
};

const wordsFromMessage = (message?: string) =>
  (message || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

const overlapScore = (line: string, words: string[]) => {
  if (words.length === 0) return 0;
  const lower = line.toLowerCase();
  let score = 0;
  words.forEach((w) => {
    if (lower.includes(w)) score += 1;
  });
  return score;
};

const simpleHash = (input: string) =>
  input.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 7);

const buildAdaptiveSteps = (
  lang: AppLang,
  intent: Intent,
  analysis: ContextAnalysis,
  userMessage?: string
) => {
  const top = analysis.topExercises[0]?.name;
  const seed = simpleHash((userMessage || '').toLowerCase()) % 3;
  const lower = (userMessage || '').toLowerCase();

  if (containsAny(lower, ['teknik', 'form', 'teknik', 'technique', 'form'])) {
    return lang === 'sv'
      ? [
          `1. Kör ${top || 'huvudövningen'} med 1 lättare uppvärmningsset extra för teknikfokus.`,
          '2. Filma första arbetssetet och justera direkt till nästa set.',
        ]
      : [
          `1. Run ${top || 'your main lift'} with one extra lighter warm-up set for technique focus.`,
          '2. Record the first working set and adjust immediately for the next set.',
        ];
  }

  if (intent === 'pb') {
    return lang === 'sv'
      ? [
          `1. Kör ${top || 'huvudövningen'} tidigt i passet när du är fräsch.`,
          '2. Höj belastning eller reps minimalt jämfört med senast.',
        ]
      : [
          `1. Perform ${top || 'your main lift'} early in the session while fresh.`,
          '2. Increase load or reps minimally versus your last session.',
        ];
  }

  if (seed === 0) {
    return lang === 'sv'
      ? [
          `1. Starta med ${top || 'en huvudövning'} och håll kvaliteten hög i varje set.`,
          '2. Avsluta med en kompletterande övning där du lämnar 1-2 reps i tanken.',
        ]
      : [
          `1. Start with ${top || 'one main lift'} and keep quality high on each set.`,
          '2. Finish with one supporting exercise leaving 1-2 reps in reserve.',
        ];
  }
  if (seed === 1) {
    return lang === 'sv'
      ? [
          '1. Korta passet till 45-60 min och prioritera två viktigaste övningarna.',
          '2. Logga exakt reps/vikt så nästa pass kan byggas smartare.',
        ]
      : [
          '1. Keep the session to 45-60 min and prioritize your two most important lifts.',
          '2. Log exact reps/load so the next session can be built smarter.',
        ];
  }
  return lang === 'sv'
    ? [
        '1. Fokusera på jämn prestation i alla arbetsset istället för maxning direkt.',
        '2. Avsluta med en tydlig progressionstarget till nästa pass.',
      ]
    : [
        '1. Focus on consistent performance across all working sets instead of maxing immediately.',
        '2. End with one clear progression target for next session.',
      ];
};

const shouldIncludeStatus = (intent: Intent, userMessage?: string) => {
  if (intent === 'summary' || intent === 'volume' || intent === 'balance') return true;
  const lower = (userMessage || '').toLowerCase();
  return containsAny(lower, ['status', 'sammanfatta', 'översikt', 'summary', 'overview', 'analysera', 'analyze']);
};

const shouldIncludeSteps = (intent: Intent, userMessage?: string) => {
  if (intent === 'next' || intent === 'pb' || intent === 'volume' || intent === 'balance') return true;
  const lower = (userMessage || '').toLowerCase();
  return containsAny(lower, [
    'plan',
    'upplägg',
    'schema',
    'program',
    'nästa pass',
    'next workout',
    'workout plan',
  ]);
};

const isMetaLine = (line: string) => {
  const lower = line.toLowerCase();
  return (
    lower.startsWith('status:') ||
    lower.startsWith('nästa steg') ||
    lower.startsWith('next steps') ||
    lower.startsWith('översikt:') ||
    lower.startsWith('overview:')
  );
};

const neutralizeSpecificFocusTerms = (
  text: string,
  lang: AppLang,
  exerciseNames: string[],
  userMessage?: string
) => {
  const userLower = (userMessage || '').toLowerCase();
  const userMentionsSpecific = exerciseNames.some((name) => userLower.includes(name.toLowerCase()));
  if (userMentionsSpecific) return text;

  let out = text;
  exerciseNames.forEach((name) => {
    const safeName = name.trim();
    if (!safeName) return;
    out = out.replace(new RegExp(`\\b${escapeRegExp(safeName)}\\b`, 'gi'), lang === 'sv' ? 'en övning' : 'an exercise');
  });
  out = out.replace(
    /\b(marklyft|deadlift|pushövningar|push exercises|push-övningar|pressövningar|press exercises)\b/gi,
    lang === 'sv' ? 'styrkeövningar' : 'strength exercises'
  );
  return out;
};

const isGenericOpener = (line: string) => {
  const lower = line.trim().toLowerCase();
  return (
    lower.startsWith('bra, vi håller det enkelt') ||
    lower.startsWith('bra, vi håller det här enkelt') ||
    lower.startsWith('bra fråga') ||
    lower.startsWith('toppen') ||
    lower.startsWith('great question') ||
    lower.startsWith("let's keep this simple") ||
    lower.startsWith('good question')
  );
};

const normalizeReply = (
  lang: AppLang,
  rawText: string,
  analysis: ContextAnalysis,
  profile?: AICoachProfile | null,
  userMessage?: string,
  intent: Intent = 'unknown',
  mode: 'fallback' | 'remote' = 'fallback'
) => {
  const cleaned = sanitize(rawText).replace(/\n{3,}/g, '\n\n');
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  void detectCoachTone(lang, profile);
  const nonGenericLines = lines.filter((line, index) => !(index === 0 && isGenericOpener(line)));
  const safeLines = nonGenericLines.length > 0 ? nonGenericLines : lines;

  const top = analysis.topExercises[0];
  const statusLine =
    lang === 'sv'
      ? `Status: ${analysis.sessions7} pass senaste 7 dagar, ${analysis.minutes7} min totalt${analysis.weeklyGoal > 0 ? `, ${analysis.weeklyLeft} kvar till veckomål` : ''}.`
      : `Status: ${analysis.sessions7} sessions in the last 7 days, ${analysis.minutes7} minutes total${analysis.weeklyGoal > 0 ? `, ${analysis.weeklyLeft} left to weekly goal` : ''}.`;

  const numberedLines = safeLines.filter((line) => /^\d+\.\s/.test(line));
  const steps = numberedLines.slice(0, 4);
  if (steps.length === 0) {
    steps.push(...buildAdaptiveSteps(lang, intent, analysis, userMessage));
  }

  const candidateBodyLines = safeLines.filter((line) => !/^\d+\.\s/.test(line) && !isMetaLine(line));
  const messageWords = wordsFromMessage(userMessage);
  const sortedBodyLines = [...candidateBodyLines].sort(
    (a, b) => overlapScore(b, messageWords) - overlapScore(a, messageWords)
  );
  const firstBodyLine = sortedBodyLines[0];
  const secondBodyLine = sortedBodyLines[1];
  const bodyLine =
    firstBodyLine
      ? firstBodyLine
      : lang === 'sv'
        ? `Fokus: ${top ? top.name : 'bygg en stabil grund i huvudövningarna'} och jämn progression.`
        : `Focus: ${top ? top.name : 'build a stable base in your main lifts'} with consistent progression.`;

  if (mode === 'remote') {
    const remoteBody = safeLines.filter((line) => !isMetaLine(line)).slice(0, 6);
    const exerciseNames = analysis.topExercises.map((ex) => ex.name);
    const neutralizedBody =
      intent === 'unknown'
        ? remoteBody.map((line) => neutralizeSpecificFocusTerms(line, lang, exerciseNames, userMessage))
        : remoteBody;
    const builtRemote = neutralizedBody.length > 0 ? [...neutralizedBody] : [bodyLine];
    const shouldAutoInjectSteps =
      (intent === 'next' || intent === 'pb') &&
      shouldIncludeSteps(intent, userMessage) &&
      !neutralizedBody.some((line) => /^\d+\.\s/.test(line));
    if (shouldAutoInjectSteps) {
      builtRemote.push(lang === 'sv' ? 'Nästa steg:' : 'Next steps:', ...steps.slice(0, 2));
    }
    return builtRemote
      .join('\n')
      .replace(
        /jag hittar inga genomförda pass ännu|i cannot find any completed workouts yet/gi,
        lang === 'sv'
          ? 'Jag ser inga genomförda pass ännu i din historik'
          : 'I can see no completed workouts in your history yet'
      );
  }

  const hasQuestion = cleaned.includes('?');
  const endingQuestion = hasQuestion ? null : defaultCoachQuestion(lang);

  const built = [bodyLine];
  if (secondBodyLine && secondBodyLine !== bodyLine && overlapScore(secondBodyLine, messageWords) > 0) {
    built.push(secondBodyLine);
  }
  if (shouldIncludeStatus(intent, userMessage)) {
    built.push(statusLine);
  }
  if (shouldIncludeSteps(intent, userMessage)) {
    built.push(lang === 'sv' ? 'Nästa steg:' : 'Next steps:', ...steps.slice(0, 3));
  }
  if (userMessage && isYesNoLikeQuestion(userMessage) && built.length > 1) {
    built.splice(1);
    if (shouldIncludeSteps(intent, userMessage)) {
      built.push(lang === 'sv' ? 'Nästa steg:' : 'Next steps:', ...steps.slice(0, 2));
    }
  }
  if (endingQuestion) built.push(endingQuestion);
  return built
    .join('\n')
    .replace(
      /jag hittar inga genomförda pass ännu|i cannot find any completed workouts yet/gi,
      lang === 'sv'
        ? 'Jag ser inga genomförda pass ännu i din historik'
        : 'I can see no completed workouts in your history yet'
    );
};

const basisLine = (lang: AppLang, analysis: ContextAnalysis) => {
  if (lang === 'sv') {
    return `Bygger på: ${analysis.sessions7} pass senaste 7 dagar${analysis.lastWorkoutDate ? `, senaste pass ${analysis.lastWorkoutDate}` : ''}.`;
  }
  return `Based on: ${analysis.sessions7} sessions in last 7 days${analysis.lastWorkoutDate ? `, last workout ${analysis.lastWorkoutDate}` : ''}.`;
};

const workoutTitleForIntent = (lang: AppLang, intent: Intent, analysis: ContextAnalysis): string => {
  const top = analysis.topExercises[0]?.name;
  if (lang === 'sv') {
    if (intent === 'pb') return top ? `PB-fokus: ${top}` : 'PB-fokus pass';
    if (intent === 'next') return top ? `Nästa pass: ${top}` : 'Nästa träningspass';
    if (intent === 'volume') return 'Volymfokuserat pass';
    return 'AI-planerat pass';
  }
  if (intent === 'pb') return top ? `PR focus: ${top}` : 'PR focus workout';
  if (intent === 'next') return top ? `Next session: ${top}` : 'Next workout';
  if (intent === 'volume') return 'Volume-focused workout';
  return 'AI planned workout';
};

const responseForIntent = (
  lang: AppLang,
  intent: Intent,
  analysis: ContextAnalysis,
  message: string
): string => {
  const isSv = lang === 'sv';
  const top = analysis.topExercises[0];
  const second = analysis.topExercises[1];
  const third = analysis.topExercises[2];
  const muscleTip = analysis.muscleFocusTip ? localizeMuscle(analysis.muscleFocusTip, lang) : null;

  if (analysis.totalSessions === 0) {
    return isSv
      ? 'Jag hittar inga genomförda pass ännu. Kör ett snabbpass med set/reps/vikt så kan jag ge riktigt relevanta råd.'
      : 'I cannot find any completed workouts yet. Log one session with sets/reps/weight and I can give truly relevant advice.';
  }

  if (intent === 'next') {
    const status = isSv
      ? `Läge: ${analysis.sessions7} pass senaste 7 dagar${analysis.weeklyGoal > 0 ? `, ${analysis.weeklyLeft} kvar till veckomålet` : ''}.`
      : `Status: ${analysis.sessions7} sessions in the last 7 days${analysis.weeklyGoal > 0 ? `, ${analysis.weeklyLeft} left to weekly goal` : ''}.`;
    const steps = isSv
      ? [
          top
            ? `Bygg passet runt ${top.name} (2-4 arbetsset).`
            : 'Välj en huvudövning (2-4 arbetsset).',
          second
            ? `Lägg in ${second.name} som huvudkomplement.`
            : 'Lägg in en kompletterande drag- eller pressövning.',
          analysis.daysSinceLast != null && analysis.daysSinceLast >= 2
            ? 'Kör normal/tung intensitet idag och sikta på liten progression.'
            : 'Kör medelintensitet idag och prioritera teknik + jämn kvalitet på seten.',
        ]
      : [
          top
            ? `Build the session around ${top.name} (2-4 working sets).`
            : 'Pick one main lift (2-4 working sets).',
          second
            ? `Add ${second.name} as the main supporting lift.`
            : 'Add one supporting pull or push exercise.',
          analysis.daysSinceLast != null && analysis.daysSinceLast >= 2
            ? 'Run normal/heavy intensity today and aim for small progression.'
            : 'Use moderate intensity today and prioritize technique + consistent set quality.',
        ];

    return `${status}\n${isSv ? 'Nästa steg:' : 'Next steps:'}\n${formatSteps(steps)}`;
  }

  if (intent === 'pb') {
    const status = analysis.latestPb
      ? isSv
        ? `Senaste PB: ${analysis.latestPb.exercise} ${analysis.latestPb.weight} kg (${analysis.latestPb.date}, +${analysis.latestPb.delta.toFixed(1)} kg).`
        : `Latest PR: ${analysis.latestPb.exercise} ${analysis.latestPb.weight} kg (${analysis.latestPb.date}, +${analysis.latestPb.delta.toFixed(1)} kg).`
      : isSv
        ? 'Inga nya PB senaste 30 dagar.'
        : 'No new PR in the last 30 days.';

    const steps = isSv
      ? [
          top ? `Behåll hög frekvens i ${top.name} (du svarar bra där).` : 'Välj en huvudövning och följ den 2-3 pass i rad.',
          'Mål nästa pass: +1 rep på tyngsta setet eller +1.25 till +2.5 kg med samma reps.',
          'Stoppa när teknik tappar, annars blir progressionen svårare att upprepa.',
        ]
      : [
          top ? `Keep high frequency on ${top.name} (you respond well there).` : 'Pick one main lift and repeat it for 2-3 sessions.',
          'Next target: +1 rep on your heaviest set or +1.25 to +2.5 kg at same reps.',
          'Stop when technique breaks down, otherwise progression is harder to repeat.',
        ];

    return `${status}\n${isSv ? 'PB-plan:' : 'PR plan:'}\n${formatSteps(steps)}`;
  }

  if (intent === 'volume') {
    const status = isSv
      ? `Volym 7 dagar: ${analysis.volume7}, tid ${analysis.minutes7} min, snitt ${analysis.avgMinutes7} min/pass.`
      : `7-day volume: ${analysis.volume7}, time ${analysis.minutes7} min, average ${analysis.avgMinutes7} min/session.`;

    const steps = isSv
      ? [
          analysis.avgMinutes7 < 35
            ? 'Öka med 1 arbetsset i huvudövningen för mer träningsstimuli.'
            : 'Behåll nuvarande volym om återhämtning känns bra.',
          third ? `Prioritera kvalitet i ${third.name} istället för fler övningar.` : 'Prioritera kvalitet i befintliga övningar före fler övningar.',
          'Utvärdera efter 2 veckor: bättre reps, vikt eller teknik = rätt nivå.',
        ]
      : [
          analysis.avgMinutes7 < 35
            ? 'Add 1 working set to the main lift for more training stimulus.'
            : 'Keep current volume if recovery feels good.',
          third ? `Prioritize quality in ${third.name} instead of adding more exercises.` : 'Prioritize quality in current exercises before adding more exercises.',
          'Review after 2 weeks: better reps, load, or technique means the level is right.',
        ];

    return `${status}\n${isSv ? 'Volymjustering:' : 'Volume adjustment:'}\n${formatSteps(steps)}`;
  }

  if (intent === 'balance') {
    const status = isSv
      ? `Mest tränat nu: ${top ? top.name : 'okänt'}.${muscleTip ? ` Lägst frekvens: ${muscleTip}.` : ''}`
      : `Most trained now: ${top ? top.name : 'unknown'}.${muscleTip ? ` Lowest frequency: ${muscleTip}.` : ''}`;

    const steps = isSv
      ? [
          muscleTip ? `Lägg till 1 extra övning för ${muscleTip} i nästa två pass.` : 'Fortsätt nuvarande split och följ utvecklingen i 2 veckor.',
          top ? `Behåll ${top.name} stabilt så du inte tappar huvudprogression.` : 'Behåll en tydlig huvudövning per pass.',
          'Målet är jämn veckobelastning, inte maxvolym på en muskelgrupp.',
        ]
      : [
          muscleTip ? `Add 1 extra exercise for ${muscleTip} in your next two sessions.` : 'Keep your current split and monitor for 2 weeks.',
          top ? `Keep ${top.name} stable so you do not lose main progression.` : 'Keep one clear main lift each session.',
          'The goal is balanced weekly load, not max volume on one muscle group.',
        ];

    return `${status}\n${isSv ? 'Balansplan:' : 'Balance plan:'}\n${formatSteps(steps)}`;
  }

  const lower = message.toLowerCase();
  const askedWhy = containsAny(lower, ['varför', 'why']);
  const askedShort = containsAny(lower, ['kort', 'short']);

  if (askedWhy && top) {
    return isSv
      ? `Du får rådet att fokusera på ${top.name} eftersom den har högst frekvens i din data (${top.sessions} pass), vilket gör progressionen mer förutsägbar. Nästa steg: 1) håll samma upplägg i 2-3 pass, 2) öka reps eller vikt lite, 3) följ teknik och återhämtning.`
      : `I recommend focusing on ${top.name} because it has the highest frequency in your data (${top.sessions} sessions), which makes progression more predictable. Next: 1) keep the same setup for 2-3 sessions, 2) increase reps or load slightly, 3) track technique and recovery.`;
  }

  if (askedShort) {
    return isSv
      ? `Kort läge: ${analysis.sessions7} pass/7 dagar. Fokus nästa pass: ${top ? top.name : 'en huvudövning'} och liten progression.`
      : `Short status: ${analysis.sessions7} sessions/7 days. Next focus: ${top ? top.name : 'one main lift'} with small progression.`;
  }

  return isSv
    ? `Översikt: ${analysis.totalSessions} pass totalt, ${analysis.sessions7} senaste 7 dagar. Senaste pass: ${analysis.lastWorkoutDate || 'okänt'}.${top ? ` Mest loggad nyligen: ${top.name}.` : ''} Skriv t.ex. "vad ska jag köra nästa pass?" eller "hur tar jag PB i ${top ? top.name : 'min huvudövning'}?".`
    : `Overview: ${analysis.totalSessions} sessions total, ${analysis.sessions7} in the last 7 days. Last workout: ${analysis.lastWorkoutDate || 'unknown'}.${top ? ` Most logged recently: ${top.name}.` : ''} Ask for example "what should I train next?" or "how do I improve PR in ${top ? top.name : 'my main lift'}?".`;
};

const fallbackReply = (
  lang: AppLang,
  message: string,
  context: AICoachContext,
  history: AICoachTurn[],
  profile?: AICoachProfile
): AICoachReply => {
  const analysis = analyzeContext(context);
  const intent = pickIntent(message, history);
  const baseText = responseForIntent(lang, intent, analysis, message);

  return {
    source: 'fallback',
    text: normalizeReply(lang, baseText, analysis, profile, message, intent),
    workoutTitle: workoutTitleForIntent(lang, intent, analysis),
    basis: basisLine(lang, analysis),
  };
};

const buildEndpointHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!supabase) return headers;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Leave header set without auth; server can reject and fallback logic will handle.
  }
  return headers;
};

export const getAICoachReply = async (params: {
  lang: AppLang;
  message: string;
  context: AICoachContext;
  history?: AICoachTurn[];
  profile?: AICoachProfile;
  strictMode?: 'normal' | 'strict';
  forceDirect?: boolean;
  revisePreviousAnswer?: string;
  reviseReason?: string;
}): Promise<AICoachReply> => {
  const endpoint = process.env.EXPO_PUBLIC_AI_CHAT_URL;
  const cleanedMessage = sanitize(params.message);
  const history = params.history || [];

  if (!cleanedMessage) {
    const analysis = analyzeContext(params.context);
    const tone = detectCoachTone(params.lang, params.profile);
    const emptyText =
      params.lang === 'sv'
        ? tone === 'direct'
          ? 'Skriv din fråga direkt så ger jag en konkret plan.'
          : 'Skriv en fråga så hjälper jag dig med en tydlig plan.'
        : tone === 'direct'
          ? 'Ask your question directly and I will give a concrete plan.'
          : 'Ask a question and I will help with a clear plan.';
    return {
      source: 'fallback',
      text: emptyText,
      workoutTitle: workoutTitleForIntent(params.lang, 'summary', analysis),
      basis: basisLine(params.lang, analysis),
    };
  }

  const analysis = analyzeContext(params.context);
  const intent = pickIntent(cleanedMessage, history);
  const previousAssistantReply = [...history].reverse().find((turn) => turn.role === 'assistant')?.text;
  const effectiveProfile = contextualizeCoachProfile(params.profile, cleanedMessage);

  if (!endpoint) {
    return fallbackReply(params.lang, cleanedMessage, params.context, history, params.profile);
  }

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: await buildEndpointHeaders(),
        body: JSON.stringify({
          message: cleanedMessage,
          lang: params.lang,
          context: params.context,
          contextSummary: analysis,
          coachProfile: effectiveProfile,
          history: history.slice(-12),
          responseStyle: {
            tone:
              detectCoachTone(params.lang, params.profile) === 'supportive'
                ? 'supportive-human-coach'
                : 'direct-human-coach',
            structure: 'question-first-adaptive',
            maxLength: params.strictMode === 'strict' ? 480 : 650,
            strictMode: params.strictMode || 'normal',
            forceDirect: !!params.forceDirect,
            reviseReason: params.reviseReason || null,
          },
          previousAnswer: params.revisePreviousAnswer || null,
          previousAssistantReply: previousAssistantReply || null,
          systemPrompt:
            params.lang === 'sv'
              ? 'Du är en träningscoach. Svara mänskligt och personligt, men fortfarande konkret och datadrivet. Prioritera användarens faktiska träningsdata och progression.'
              : 'You are a training coach. Respond naturally and personally, while staying concrete and data-driven. Prioritize the user’s actual training data and progression.',
        }),
      },
      { timeoutMs: 12000, retries: 1 }
    );

    if (!response.ok) {
      return fallbackReply(params.lang, cleanedMessage, params.context, history, params.profile);
    }

    const data = (await response.json()) as { reply?: unknown };
    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      return fallbackReply(params.lang, cleanedMessage, params.context, history, params.profile);
    }

    const normalizedRemote = normalizeReply(
      params.lang,
      data.reply.trim(),
      analysis,
      params.profile,
      cleanedMessage,
      intent,
      'remote'
    );
    return {
      source: 'remote',
      text: stripUnverifiedPreferenceClaims(normalizedRemote, cleanedMessage, effectiveProfile),
      workoutTitle: workoutTitleForIntent(params.lang, intent, analysis),
      basis: basisLine(params.lang, analysis),
    };
  } catch {
    return fallbackReply(params.lang, cleanedMessage, params.context, history, params.profile);
  }
};
