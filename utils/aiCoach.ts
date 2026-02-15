import type { Workout } from '../context/WorkoutsContext';
import type { AppLang } from './date';
import { compareISODate, parseISODate, toISODate } from './date';

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

  const sortedAsc = [...completed].sort((a, b) => compareISODate(a.date, b.date));
  const sortedDesc = [...completed].sort((a, b) => compareISODate(b.date, a.date));

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

  const topExercises = Array.from(exerciseMap.values())
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
    pbEvents30,
    latestPb: pbEvents30[0] || null,
    weeklyGoal: context.weeklyGoal || 0,
    weeklyLeft,
    muscleFocusTip,
  };
};

const formatSteps = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

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
    ? `Översikt: ${analysis.totalSessions} pass totalt, ${analysis.sessions7} senaste 7 dagar. Senaste pass: ${analysis.lastWorkoutDate || 'okänt'}. Mest tränad övning: ${top ? top.name : 'okänd'}. Skriv t.ex. "vad ska jag köra nästa pass?" eller "hur tar jag PB i ${top ? top.name : 'min huvudövning'}?".`
    : `Overview: ${analysis.totalSessions} sessions total, ${analysis.sessions7} in the last 7 days. Last workout: ${analysis.lastWorkoutDate || 'unknown'}. Most trained exercise: ${top ? top.name : 'unknown'}. Ask for example "what should I train next?" or "how do I improve PR in ${top ? top.name : 'my main lift'}?".`;
};

const fallbackReply = (
  lang: AppLang,
  message: string,
  context: AICoachContext,
  history: AICoachTurn[]
): AICoachReply => {
  const analysis = analyzeContext(context);
  const intent = pickIntent(message, history);

  return {
    source: 'fallback',
    text: responseForIntent(lang, intent, analysis, message),
  };
};

export const getAICoachReply = async (params: {
  lang: AppLang;
  message: string;
  context: AICoachContext;
  history?: AICoachTurn[];
}): Promise<AICoachReply> => {
  const endpoint = process.env.EXPO_PUBLIC_AI_CHAT_URL;
  const cleanedMessage = sanitize(params.message);
  const history = params.history || [];

  if (!cleanedMessage) {
    return {
      source: 'fallback',
      text: params.lang === 'sv' ? 'Skriv en fråga så hjälper jag dig.' : 'Write a question and I will help you.',
    };
  }

  const analysis = analyzeContext(params.context);

  if (!endpoint) {
    return fallbackReply(params.lang, cleanedMessage, params.context, history);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: cleanedMessage,
        lang: params.lang,
        context: params.context,
        contextSummary: analysis,
        history: history.slice(-12),
        responseStyle: {
          tone: 'direct-coach',
          structure: 'status-plus-3-steps',
          maxLength: 650,
        },
        systemPrompt:
          params.lang === 'sv'
            ? 'Du är en träningscoach. Var konkret och datadriven. Svara i format: kort lägesbild + 2-3 tydliga nästa steg. Undvik generiska råd.'
            : 'You are a training coach. Be concrete and data-driven. Use format: short status + 2-3 clear next steps. Avoid generic advice.',
      }),
    });

    if (!response.ok) {
      return fallbackReply(params.lang, cleanedMessage, params.context, history);
    }

    const data = (await response.json()) as { reply?: unknown };
    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      return fallbackReply(params.lang, cleanedMessage, params.context, history);
    }

    return {
      source: 'remote',
      text: data.reply.trim(),
    };
  } catch {
    return fallbackReply(params.lang, cleanedMessage, params.context, history);
  }
};
