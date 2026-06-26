import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';

/**
 * Compute the completion rate string for a habit.
 *
 * Returns a percentage string (e.g. "7%") when calculable, or "-" when not.
 *
 * Logic: (total completions) / (days since first completion + 1), rounded.
 * Mirrors the inline useMemo in HabitDetailChart.tsx:180-193.
 */
export function computeCompletionRate(
  streak: HabitStreakResponse | null,
  entries: HabitEntryResponse[],
): string {
  if (streak && streak.total_streak > 0) {
    const completedDates = entries
      .filter((e) => e.status === 'completed')
      .map((e) => new Date(e.entry_date));
    if (completedDates.length > 0) {
      const firstDate = new Date(Math.min(...completedDates.map((d) => d.getTime())));
      const today = new Date();
      const days =
        Math.max(1, Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return `${Math.round((streak.total_streak / days) * 100)}%`;
    }
  }
  return '-';
}
