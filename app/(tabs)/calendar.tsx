// app/(tabs)/calendar.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  Alert,
  Platform,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateObject } from 'react-native-calendars';
import GlassCard from '../../components/ui/GlassCard';
import NeonButton from '../../components/ui/NeonButton';
import BadgePill from '../../components/ui/BadgePill';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { toast } from '../../utils/toast';

function parseISO(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CalendarScreen() {
  const { workouts, removeWorkout, addWorkout, templates } = useWorkouts();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'PLANNED'>('ALL');
  const todayIso = new Date().toISOString().slice(0, 10);

  const nearestWorkoutDate = useMemo(() => {
    if (workouts.length === 0) return null;
    const upcoming = workouts
      .map((w) => w.date)
      .filter((d) => d >= todayIso)
      .sort();
    if (upcoming.length > 0) return upcoming[0];
    // annars äldsta
    return workouts.map((w) => w.date).sort()[0] || null;
  }, [workouts, todayIso]);

  useEffect(() => {
    if (!selectedDate && nearestWorkoutDate) {
      setSelectedDate(nearestWorkoutDate);
    } else if (!selectedDate && workouts.length === 0) {
      setSelectedDate(todayIso);
    }
  }, [nearestWorkoutDate, selectedDate, todayIso, workouts.length]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        customStyles: {
          container: object;
          text: object;
        };
      }
    > = {};

    workouts.forEach((w) => {
      const color = w.color || '#3b82f6';
      const textColor = '#f9fafb';
      const isPlanned = !w.isCompleted;
      const plannedBackground = hexToRgba(color, 0.2);

      // om flera pass samma dag – vi låter sista “vinna”
      marks[w.date] = {
        customStyles: {
          container: {
            backgroundColor: isPlanned ? plannedBackground : color,
            borderRadius: 10,
            borderWidth: isPlanned ? 1 : 0,
            borderColor: isPlanned ? color : 'transparent',
          },
          text: {
            color: isPlanned ? '#e5e7eb' : textColor,
            fontWeight: '700',
          },
        },
      };
    });

    if (selectedDate) {
      // lägg en liten extra “ring”-känsla runt vald dag
      const existing = marks[selectedDate];
      marks[selectedDate] = {
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: '#fbbf24',
            borderRadius: 10,
            padding: 1,
            backgroundColor: existing
              ? (existing.customStyles.container as any).backgroundColor
              : '#0f172a',
          },
          text: {
            color: existing
              ? (existing.customStyles.text as any).color
              : '#e5e7eb',
            fontWeight: '800',
          },
        },
      };
    }

    return marks;
  }, [workouts, selectedDate]);

  const workoutsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return workouts
      .filter((w) => {
        if (w.date !== selectedDate) return false;
        if (statusFilter === 'DONE') return !!w.isCompleted;
        if (statusFilter === 'PLANNED') return !w.isCompleted;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [workouts, selectedDate, statusFilter]);

  const totalWorkouts = workouts.length;

  const thisMonthCounts = useMemo(() => {
    if (workouts.length === 0) return 0;
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    return workouts.filter((w) => {
      const d = parseISO(w.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }, [workouts]);

  const daySummary = useMemo(() => {
    if (!selectedDate) return null;
    const list = workouts.filter((w) => w.date === selectedDate);
    const totalDuration = list.reduce(
      (sum, w) => sum + (w.durationMinutes || 0),
      0
    );
    const totalExercises = list.reduce(
      (sum, w) => sum + (w.exercises?.length || 0),
      0
    );
    return {
      total: list.length,
      duration: totalDuration,
      exercises: totalExercises,
    };
  }, [workouts, selectedDate]);

  const handleDayPress = (day: DateObject) => {
    setSelectedDate(day.dateString);
  };

  const handleDelete = (w: (typeof workouts)[number]) => {
    Alert.alert('Ta bort pass', `Vill du ta bort "${w.title}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeWorkout(w.id);
          toast('Pass borttaget');
          Alert.alert('Borttaget', 'Passet togs bort.', [
            {
              text: 'Ångra',
              style: 'default',
              onPress: () => {
                Haptics.selectionAsync();
                addWorkout(w);
              },
            },
            { text: 'OK', style: 'default' },
          ]);
        },
      },
    ]);
  };

  const renderEmptyState = () => (
    <GlassCard style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Ingen data i kalendern ännu</Text>
      <Text style={styles.emptySubtitle}>
        Planera ett framtida pass eller starta ett snabbt pass för att fylla kalendern.
      </Text>
    </GlassCard>
  );

  return (
    <View style={styles.gradient}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={workoutsForSelectedDay}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListEmptyComponent={
            workouts.length === 0 ? renderEmptyState : null
          }
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Din träningskalender</Text>
                <Text style={styles.subtitle}>
                  Se dina pass månad för månad och tryck på en dag för detaljer.
                </Text>
              </View>

              <View style={styles.row}>
                <GlassCard style={styles.smallCard}>
                  <Text style={styles.smallLabel}>Totalt antal pass</Text>
                  <Text style={styles.smallValue}>{totalWorkouts}</Text>
                  <Text style={styles.smallSub}>
                    Alla pass du loggat i appen.
                  </Text>
                </GlassCard>

                <GlassCard style={styles.smallCard}>
                  <Text style={styles.smallLabel}>Den här månaden</Text>
                  <Text style={styles.smallValue}>{thisMonthCounts}</Text>
                  <Text style={styles.smallSub}>
                    pass loggade under aktuell månad.
                  </Text>
                </GlassCard>
              </View>

              <GlassCard style={styles.calendarCard}>
                <Calendar
                  theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    monthTextColor: colors.textMain,
                    dayTextColor: colors.textMain,
                    textDisabledColor: '#4b5563',
                    todayTextColor: '#f97316',
                    arrowColor: colors.textMain,
                  }}
                  markingType="custom"
                  markedDates={markedDates}
                  onDayPress={handleDayPress}
                  disableAllTouchEventsForDisabledDays={true}
                  enableSwipeMonths={true}
                />
              </GlassCard>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {selectedDate
                    ? `Pass den ${selectedDate}`
                    : 'Tryck på en dag för att se pass'}
                </Text>
                {selectedDate && (
                  <TouchableOpacity
                    style={styles.planChip}
                    onPress={() =>
                      router.push({
                        pathname: '/schedule-workout',
                        params: { date: selectedDate },
                      })
                    }
                    activeOpacity={0.9}
                    accessibilityLabel="Planera pass för vald dag"
                    accessibilityRole="button"
                  >
                    <Text style={styles.planChipText}>🗓️ Planera pass</Text>
                  </TouchableOpacity>
                )}

                {daySummary && (
                  <View style={styles.daySummaryRow}>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>Pass</Text>
                      <Text style={styles.summaryValue}>{daySummary.total}</Text>
                    </View>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>Tid</Text>
                      <Text style={styles.summaryValue}>
                        {daySummary.duration > 0
                          ? `${daySummary.duration} min`
                          : 'okänd'}
                      </Text>
                    </View>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>Övningar</Text>
                      <Text style={styles.summaryValue}>
                        {daySummary.exercises}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedDate && (
                  <View style={styles.filterRow}>
                    {[
                      { key: 'ALL', label: 'Alla' },
                      { key: 'DONE', label: 'Klara' },
                      { key: 'PLANNED', label: 'Planerade' },
                    ].map((f) => {
                      const active = statusFilter === f.key;
                      return (
                        <BadgePill
                          key={f.key}
                          label={f.label}
                          tone={active ? 'primary' : 'neutral'}
                          style={styles.filterChip}
                          onPress={() =>
                            setStatusFilter(f.key as typeof statusFilter)
                          }
                        />
                      );
                    })}
                  </View>
                )}

                {selectedDate && workoutsForSelectedDay.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      Inga pass loggade den här dagen ännu.
                    </Text>
                  </View>
                )}
              </View>
            </>
          }
          renderItem={({ item: w }) => (
            <GlassCard key={w.id} style={[styles.workoutItem, styles.glowCard]}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineBar} />
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: w.color || '#3b82f6' },
                  ]}
                />
                <View style={styles.timelineContent}>
                  {w.sourceTemplateId ? (
                    <View style={styles.templatePill}>
                      <View
                        style={[
                          styles.templateDot,
                          {
                            backgroundColor:
                              templates.find((t) => t.id === w.sourceTemplateId)?.color ||
                              w.color ||
                              colors.primary,
                          },
                        ]}
                      />
                      <Text style={styles.templatePillText}>
                        {templates.find((t) => t.id === w.sourceTemplateId)?.name || 'Rutin'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.timelineHeader}>
                    <Text style={styles.workoutTitle}>{w.title}</Text>
                    <View style={styles.headerPills}>
                      {w.sourceTemplateId && (
                        <View style={styles.templatePill}>
                          <Text style={styles.templatePillText}>Rutin</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.statusPill,
                          w.isCompleted
                            ? styles.statusPillDone
                            : styles.statusPillPlanned,
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {w.isCompleted ? 'Klart' : 'Planerat'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {w.notes ? (
                    <Text style={styles.workoutNotes}>{w.notes}</Text>
                  ) : (
                    <Text style={styles.workoutNotesMuted}>
                      Inga anteckningar
                    </Text>
                  )}
                  <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>
                        {w.durationMinutes
                          ? `${w.durationMinutes} min`
                          : 'Tid okänd'}
                      </Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>
                        {w.exercises?.length ?? 0} övningar
                      </Text>
                    </View>
                  </View>
                  {!w.isCompleted && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.startNowButton]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          router.replace({
                            pathname: '/workout/quick-workout',
                            params: {
                              title: w.title,
                              color: w.color,
                              templateId: w.sourceTemplateId,
                            },
                          });
                        }}
                        activeOpacity={0.9}
                        accessibilityLabel="Starta pass nu"
                        accessibilityRole="button"
                      >
                        <Text style={styles.startNowText}>Starta nu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.deleteButton]}
                        onPress={() => handleDelete(w)}
                        activeOpacity={0.9}
                        accessibilityLabel="Ta bort pass"
                        accessibilityRole="button"
                      >
                        <Text style={styles.deleteText}>Ta bort</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </GlassCard>
          )}
          ListFooterComponent={<View style={{ height: 40 }} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  smallCard: {
    flex: 1,
  },
  smallLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 4,
  },
  smallValue: {
    ...typography.title,
    fontSize: 18,
    color: colors.textMain,
  },
  smallSub: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },
  calendarCard: {
    marginBottom: 12,
  },
  section: {
    marginTop: 4,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 8,
  },
  planChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 8,
  },
  planChipText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 14,
    backgroundColor: '#020617',
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#0b1220',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 14,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  emptyActions: {
    marginTop: 12,
  },
  list: {
    gap: 8,
  },
  workoutItem: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  workoutTitle: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  workoutNotes: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  workoutNotesMuted: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  metaText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusPillPlanned: {
    backgroundColor: '#0b1220',
    borderColor: colors.primary,
  },
  statusText: {
    color: '#0b1120',
    fontSize: 11,
    fontWeight: '700',
  },
  headerPills: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  templatePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#312e81',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templatePillText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  startNowButton: {
    borderColor: colors.accentGreen,
    backgroundColor: '#0f172a',
  },
  startNowText: {
    color: colors.accentGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: '#ef4444',
    backgroundColor: '#0f172a',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  filterChipActive: {
    borderColor: colors.accentGreen,
    backgroundColor: '#14532d',
  },
  filterText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#bbf7d0',
  },
  planButton: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    alignItems: 'center',
  },
  planButtonText: {
    color: '#0b1220',
    fontWeight: '800',
    fontSize: 13,
  },
  daySummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#111827',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  summaryValue: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineBar: {
    width: 2,
    backgroundColor: '#1f2937',
    borderRadius: 999,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
