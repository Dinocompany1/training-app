import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Send, RefreshCw, UserRoundCog } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackPill from '../components/ui/BackPill';
import GlassCard from '../components/ui/GlassCard';
import ScreenHeader from '../components/ui/ScreenHeader';
import StaggerReveal from '../components/ui/StaggerReveal';
import { colors, gradients, inputs, spacing, typography } from '../constants/theme';
import { useTranslation } from '../context/TranslationContext';
import { useWorkouts } from '../context/WorkoutsContext';
import storage from '../utils/safeStorage';
import { toISODate } from '../utils/date';
import { getAICoachReply, type AICoachTurn } from '../utils/aiCoach';
import { hasAICoachProfileData, loadAICoachProfile, type AICoachProfile } from '../utils/aiCoachProfile';
import { createId } from '../utils/id';
import { toast } from '../utils/toast';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  source?: 'remote' | 'fallback';
  workoutTitle?: string;
  basis?: string;
};

const id = () => createId('ai');
const AI_COACH_HISTORY_KEY = 'ai-coach-history-v1';
const MAX_MESSAGES = 40;

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    (obj.role === 'assistant' || obj.role === 'user') &&
    typeof obj.text === 'string' &&
    (obj.source === undefined || obj.source === 'remote' || obj.source === 'fallback') &&
    (obj.workoutTitle === undefined || typeof obj.workoutTitle === 'string') &&
    (obj.basis === undefined || typeof obj.basis === 'string')
  );
};

export default function AICoachScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { workouts, weeklyGoal } = useWorkouts();
  const [input, setInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<AICoachProfile>({
    goal: '',
    focusExercises: '',
    limitations: '',
    schedule: '',
    preferences: '',
  });

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const raw = await storage.getItem(AI_COACH_HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const safeMessages = parsed.filter(isChatMessage).slice(-MAX_MESSAGES);
        setMessages(safeMessages);
      } catch {
        // Ignore invalid persisted history
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    storage
      .setItem(AI_COACH_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
      .catch(() => {});
  }, [messages]);

  const refreshProfile = useCallback(() => {
    loadAICoachProfile().then((data) => {
      setProfile(data);
    });
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  const completedWorkouts = useMemo(
    () => (workouts || []).filter((w) => w.isCompleted),
    [workouts]
  );

  const aiContext = useMemo(
    () => ({
      workouts: completedWorkouts,
      weeklyGoal,
      todayISO: toISODate(new Date()),
    }),
    [completedWorkouts, weeklyGoal]
  );

  const suggestions = useMemo(
    () => [
      t('aiCoach.quickNextSession'),
      t('aiCoach.quickPb'),
      t('aiCoach.quickSummary'),
    ],
    [t]
  );

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || loading) return;

    const userMsg: ChatMessage = { id: id(), role: 'user', text: message };
    const historyForAI: AICoachTurn[] = [...messages, userMsg]
      .slice(-12)
      .map((item) => ({
        role: item.role,
        text: item.text,
      }));
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setInput('');
    setLoading(true);
    try {
      const reply = await getAICoachReply({
        lang,
        message,
        context: aiContext,
        history: historyForAI,
        profile,
        strictMode: 'normal',
      });

      setMessages((prev) => [
        ...prev.slice(-(MAX_MESSAGES - 1)),
        {
          id: id(),
          role: 'assistant',
          text: reply.text,
          source: reply.source,
          workoutTitle: reply.workoutTitle,
          basis: reply.basis,
        },
      ]);
    } catch {
      toast(t('common.error', 'Ett fel uppstod'));
    } finally {
      setLoading(false);
    }
  };

  const regenerateDirectAnswer = useCallback(
    async (assistantId: string) => {
      if (loading) return;
      const idx = messages.findIndex((m) => m.id === assistantId && m.role === 'assistant');
      if (idx < 0) return;
      let userMessage: ChatMessage | null = null;
      for (let i = idx - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') {
          userMessage = messages[i];
          break;
        }
      }
      if (!userMessage) {
        toast(t('aiCoach.retryNoQuestion', 'Kunde inte hitta frågan att förbättra svaret från.'));
        return;
      }
      setLoading(true);
      setRetryingMessageId(assistantId);
      const historyForAI: AICoachTurn[] = messages
        .slice(Math.max(0, idx - 12), idx)
        .map((item) => ({ role: item.role, text: item.text }));
      const previousAnswerText = messages[idx]?.text || '';
      const normalizeForCompare = (value: string) =>
        value
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .trim();
      try {
        const reply = await getAICoachReply({
          lang,
          message: userMessage.text,
          context: aiContext,
          history: historyForAI,
          profile,
          strictMode: 'strict',
          forceDirect: true,
          revisePreviousAnswer: previousAnswerText,
          reviseReason:
            lang === 'sv'
              ? 'Svarade inte tillräckligt direkt på frågan'
              : 'Did not answer the question directly enough',
        });
        const isTooSimilar =
          normalizeForCompare(reply.text) === normalizeForCompare(previousAnswerText) ||
          normalizeForCompare(reply.text).includes(normalizeForCompare(previousAnswerText).slice(0, 80));
        if (isTooSimilar) {
          toast(
            t(
              'aiCoach.retryStillSimilar',
              'Svaret blev för likt. Försök igen med en mer specifik följdfråga.'
            )
          );
          return;
        }
        setMessages((prev) => [
          ...prev.slice(-(MAX_MESSAGES - 1)),
          {
            id: id(),
            role: 'assistant',
            text: reply.text,
            source: reply.source,
            workoutTitle: reply.workoutTitle,
            basis: reply.basis,
          },
        ]);
        toast(t('aiCoach.retryUpdated', 'Förbättrat svar klart.'));
      } finally {
        setLoading(false);
        setRetryingMessageId(null);
      }
    },
    [aiContext, lang, loading, messages, profile, t]
  );

  const fallbackSeen = messages.some((m) => m.role === 'assistant' && m.source === 'fallback');
  const hasProfile = hasAICoachProfileData(profile);
  const sourceLabel = (source?: 'remote' | 'fallback') =>
    source === 'remote' ? t('aiCoach.sourceRemote') : t('aiCoach.sourceFallback');
  const createWorkoutFromReply = useCallback(
    (message: ChatMessage) => {
      const suggestedTitle =
        message.workoutTitle?.trim() ||
        t('aiCoach.createWorkoutDefaultTitle', 'AI-planerat pass');
      router.push({
        pathname: '/workout/quick-workout',
        params: {
          title: suggestedTitle.slice(0, 60),
          color: '#22c55e',
        },
      });
    },
    [router, t]
  );

  return (
    <LinearGradient colors={gradients.appBackground as any} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <StaggerReveal delay={40}>
            <View style={styles.header}>
              <BackPill />
              <View style={styles.headerRight}>
                <View style={styles.headerIcon}>
                  <Sparkles size={18} color={colors.primaryBright} />
                </View>
                <ScreenHeader
                  title={t('aiCoach.title')}
                  subtitle={t('aiCoach.subtitle')}
                  compact
                  tone="violet"
                  style={styles.headerTitle}
                />
              </View>
              <TouchableOpacity
                style={styles.profileBtn}
                activeOpacity={0.86}
                onPress={() => router.push('/ai-coach-profile')}
                accessibilityRole="button"
                accessibilityLabel={t('aiCoach.profileOpen')}
              >
                <UserRoundCog size={15} color={colors.textMain} />
                <Text style={styles.profileBtnText}>{t('aiCoach.profileButton')}</Text>
              </TouchableOpacity>
            </View>
          </StaggerReveal>

          <StaggerReveal delay={90}>
            <GlassCard style={styles.infoCard} elevated={false} tone="violet">
              <Text style={styles.infoTitle}>{t('aiCoach.contextTitle')}</Text>
              <Text style={styles.infoText}>
                {t('aiCoach.contextBody', undefined, {
                  count: completedWorkouts.length,
                  goal: weeklyGoal,
                })}
              </Text>
              <Text style={styles.profileHint}>
                {hasProfile ? t('aiCoach.profileConnected') : t('aiCoach.profileNotSet')}
              </Text>
              {fallbackSeen ? <Text style={styles.fallbackHint}>{t('aiCoach.fallbackHint')}</Text> : null}
            </GlassCard>
          </StaggerReveal>

          <StaggerReveal delay={130}>
            <View style={styles.suggestionsRow}>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.suggestionChip}
                  activeOpacity={0.86}
                  onPress={() => {
                    void sendMessage(item);
                  }}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </StaggerReveal>

        <ScrollView
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <GlassCard style={styles.emptyCard} elevated={false}>
              <Text style={styles.emptyText}>{t('aiCoach.empty')}</Text>
            </GlassCard>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.message,
                  message.role === 'assistant' ? styles.assistantMessage : styles.userMessage,
                ]}
              >
                {message.role === 'assistant' ? (
                  <Text style={styles.sourceTag}>{sourceLabel(message.source)}</Text>
                ) : null}
                <Text style={styles.messageText}>{message.text}</Text>
                {message.role === 'assistant' ? (
                  <>
                    <TouchableOpacity
                      style={styles.createWorkoutBtn}
                      activeOpacity={0.86}
                      onPress={() => createWorkoutFromReply(message)}
                      accessibilityRole="button"
                      accessibilityLabel={t('aiCoach.createWorkoutFromReply', 'Skapa pass av svaret')}
                    >
                      <Text style={styles.createWorkoutBtnText}>
                        {t('aiCoach.createWorkoutFromReply', 'Skapa pass av svaret')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.missedBtn, retryingMessageId === message.id ? styles.missedBtnDisabled : null]}
                      activeOpacity={0.86}
                      disabled={loading}
                      onPress={() => {
                        void regenerateDirectAnswer(message.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('aiCoach.answerMissed', 'Svarade inte på min fråga')}
                    >
                      <Text style={styles.missedBtnText}>
                        {retryingMessageId === message.id
                          ? t('aiCoach.retrying', 'Förbättrar svar...')
                          : t('aiCoach.answerMissed', 'Svarade inte på min fråga')}
                      </Text>
                    </TouchableOpacity>
                    {message.basis ? <Text style={styles.basisText}>{message.basis}</Text> : null}
                  </>
                ) : null}
              </View>
            ))
          )}

          {loading ? (
            <View style={[styles.message, styles.assistantMessage, styles.loadingBubble]}>
              <ActivityIndicator size="small" color={colors.textMain} />
              <Text style={styles.messageText}>{t('aiCoach.loading')}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder={t('aiCoach.placeholder')}
            placeholderTextColor={colors.textSoft}
            style={[styles.input, isInputFocused ? styles.inputFocused : null]}
            multiline
            maxLength={300}
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.86}
              onPress={() => {
                Alert.alert(t('aiCoach.clear'), t('aiCoach.clearConfirm'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                      setMessages([]);
                      storage.removeItem(AI_COACH_HISTORY_KEY).catch(() => {});
                    },
                  },
                ]);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('aiCoach.clear')}
            >
              <RefreshCw size={14} color={colors.textMain} />
              <Text style={styles.secondaryBtnText}>{t('aiCoach.clear')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, loading ? styles.sendBtnDisabled : null]}
              disabled={loading}
              activeOpacity={0.86}
              onPress={() => {
                void sendMessage(input);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('aiCoach.send')}
            >
              <Send size={14} color={colors.textMain} />
              <Text style={styles.sendBtnText}>{t('aiCoach.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerTitle: { marginBottom: 0 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: {
    ...typography.title,
    color: colors.textMain,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSoft,
  },
  profileBtn: {
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileBtnText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 18,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
  },
  profileHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: spacing.sm,
  },
  fallbackHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: spacing.sm,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  suggestionChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  suggestionText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
    textAlign: 'center',
  },
  chatList: { flex: 1 },
  chatContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  emptyCard: {
    borderRadius: 16,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  message: {
    maxWidth: '92%',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.primaryBright,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageText: {
    ...typography.body,
    color: colors.textMain,
    lineHeight: 19,
  },
  sourceTag: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: spacing.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  createWorkoutBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentGreen,
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  createWorkoutBtnText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '800',
  },
  missedBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  missedBtnText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  missedBtnDisabled: {
    opacity: 0.65,
  },
  basisText: {
    marginTop: spacing.xs,
    ...typography.micro,
    color: colors.textSoft,
  },
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    minHeight: 76,
    maxHeight: 140,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    backgroundColor: colors.backgroundSoft,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    textAlignVertical: 'top',
    ...typography.body,
  },
  inputFocused: {
    borderColor: colors.primaryBright,
    shadowColor: colors.primaryBright,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  secondaryBtn: {
    height: 40,
    minWidth: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  sendBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
  },
});
