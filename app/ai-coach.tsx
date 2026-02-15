import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Send, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BackPill from '../components/ui/BackPill';
import GlassCard from '../components/ui/GlassCard';
import { colors, gradients, spacing, typography } from '../constants/theme';
import { useTranslation } from '../context/TranslationContext';
import { useWorkouts } from '../context/WorkoutsContext';
import storage from '../utils/safeStorage';
import { toISODate } from '../utils/date';
import { getAICoachReply, type AICoachTurn } from '../utils/aiCoach';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  source?: 'remote' | 'fallback';
};

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const AI_COACH_HISTORY_KEY = 'ai-coach-history-v1';
const MAX_MESSAGES = 40;

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    (obj.role === 'assistant' || obj.role === 'user') &&
    typeof obj.text === 'string' &&
    (obj.source === undefined || obj.source === 'remote' || obj.source === 'fallback')
  );
};

export default function AICoachScreen() {
  const { t, lang } = useTranslation();
  const { workouts, weeklyGoal } = useWorkouts();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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

    const reply = await getAICoachReply({
      lang,
      message,
      context: aiContext,
      history: historyForAI,
    });

    setMessages((prev) => [
      ...prev.slice(-(MAX_MESSAGES - 1)),
      {
        id: id(),
        role: 'assistant',
        text: reply.text,
        source: reply.source,
      },
    ]);
    setLoading(false);
  };

  const fallbackSeen = messages.some((m) => m.role === 'assistant' && m.source === 'fallback');
  const sourceLabel = (source?: 'remote' | 'fallback') =>
    source === 'remote' ? t('aiCoach.sourceRemote') : t('aiCoach.sourceFallback');

  return (
    <LinearGradient colors={gradients.appBackground as any} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <BackPill />
          <View style={styles.headerRight}>
            <View style={styles.headerIcon}>
              <Sparkles size={18} color={colors.primaryBright} />
            </View>
            <View>
              <Text style={styles.title}>{t('aiCoach.title')}</Text>
              <Text style={styles.subtitle}>{t('aiCoach.subtitle')}</Text>
            </View>
          </View>
        </View>

        <GlassCard style={styles.infoCard} elevated={false}>
          <Text style={styles.infoTitle}>{t('aiCoach.contextTitle')}</Text>
          <Text style={styles.infoText}>
            {t('aiCoach.contextBody', undefined, {
              count: completedWorkouts.length,
              goal: weeklyGoal,
            })}
          </Text>
          {fallbackSeen ? <Text style={styles.fallbackHint}>{t('aiCoach.fallbackHint')}</Text> : null}
        </GlassCard>

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
            placeholder={t('aiCoach.placeholder')}
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            multiline
            maxLength={300}
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.86}
              onPress={() => {
                setMessages([]);
                storage.removeItem(AI_COACH_HISTORY_KEY).catch(() => {});
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#ffffff22',
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
  infoCard: {
    borderRadius: 18,
    marginBottom: spacing.md,
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
  fallbackHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: spacing.sm,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  suggestionChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff20',
    backgroundColor: '#111827',
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
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#ffffff1f',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7c3aed',
    borderWidth: 1,
    borderColor: '#ffffff30',
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
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: '#ffffff14',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    minHeight: 76,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffffff20',
    backgroundColor: '#0b1222',
    color: colors.textMain,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
    ...typography.body,
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
    borderColor: '#ffffff24',
    backgroundColor: '#111827',
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
    backgroundColor: '#7c3aed',
    borderWidth: 1,
    borderColor: '#ffffff30',
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
