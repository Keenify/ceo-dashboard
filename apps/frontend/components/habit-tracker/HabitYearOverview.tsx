'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse, useHabitEntries } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';
import { HabitHeatmap, buildHeatmapWeeks } from './HabitHeatmap';
import HabitYearLineChart from './HabitYearLineChart';
import { computeCompletionRate } from './habitStats';
import { Loader2 } from 'lucide-react';

type HabitStreaksState = Record<string, HabitStreakResponse>;

/** UTC date formatter — matches HabitDetailChart's date range logic exactly */
const formatDateUTC = (date: Date) => date.toISOString().split('T')[0];

interface HabitYearOverviewProps {
  habits: FetchedHabit[];
  streaks?: HabitStreaksState;
}

/**
 * Shows every habit's full-year heatmap stacked on one screen —
 * the "zoom out" view to see the entire year's progress at a glance.
 *
 * Build/break habits → GitHub-style heatmap (rolling 1-year window).
 * Track habits → full line chart (first → last logged date, matching detail view).
 * Every row → 4-stat strip on the right: Current Streak, Longest Streak, Total Count, Completion Rate.
 */
export const HabitYearOverview: React.FC<HabitYearOverviewProps> = ({ habits, streaks }) => {
  const { fetchHabitEntries } = useHabitEntries();
  const [entriesByHabit, setEntriesByHabit] = useState<Record<string, HabitEntryResponse[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (habits.length === 0) return;

    // Fetch all history (not just one year) so that:
    //   1. Track habits have their full logged range for the line chart.
    //   2. Completion rate can be computed accurately.
    // The heatmap ignores out-of-window entries — it uses its own rolling-year window.
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear() - 5, 0, 1); // Jan 1, five years ago
    const startStr = formatDateUTC(startDate);
    const endStr = formatDateUTC(endDate);

    setLoading(true);
    // limit=2000 covers 5 years of daily entries with margin;
    // avoids the default-100 backend truncation.
    Promise.all(habits.map((h) => fetchHabitEntries(h.id, startStr, endStr, 2000)))
      .then((results) => {
        const map: Record<string, HabitEntryResponse[]> = {};
        habits.forEach((h, i) => {
          map[h.id] = results[i] ?? [];
        });
        setEntriesByHabit(map);
      })
      .catch(() => {
        // individual fetch errors are already handled inside fetchHabitEntries
      })
      .finally(() => setLoading(false));
    // fetchHabitEntries is stable (useCallback with [] deps) so excluding it is safe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits]);

  // Build the shared calendar structure once — all habits share the same date window,
  // so we render the month-label header once instead of repeating it per row.
  const { weeks, monthLabels } = useMemo(() => buildHeatmapWeeks([]), []);
  // Each week column is w-3 = 12px. Used to pin the line-chart width to the heatmap.
  const gridWidthPx = weeks.length * 12;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 rounded-lg border bg-card shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading year overview…</span>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-lg border bg-card shadow-sm text-sm text-muted-foreground">
        No habits yet. Add one to see your year overview.
      </div>
    );
  }

  const sortedHabits = [...habits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="rounded-lg border bg-card shadow-sm p-4 overflow-x-auto">
      {/* Shared month-label header — aligns with the per-habit heatmap columns.
          Track rows have their own date axis, so this header is only the time
          guide for build/break heatmap rows. */}
      <div className="flex mb-2">
        {/* Spacer matching the habit-name column width */}
        <div className="w-[200px] shrink-0 mr-3" />
        {/* Month abbreviations */}
        <div className="flex ml-[0.5px]">
          {weeks.map((_, i) => (
            <div key={i} className="w-3 text-[10px] text-gray-700 font-semibold text-center">
              {monthLabels[i] || ''}
            </div>
          ))}
        </div>
      </div>

      {/* Per-habit rows */}
      <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {sortedHabits.map((h) => {
          const streak = streaks?.[h.id] ?? null;
          const entries = entriesByHabit[h.id] ?? [];
          const isTrack = h.habit_type === 'track';
          const completionRate = computeCompletionRate(streak, entries);

          return (
            <div key={h.id} className="flex items-center gap-3">
              {/* Name column: full name (wraps), optional description below */}
              <div className="w-[200px] shrink-0 min-w-0">
                <span className="text-sm font-medium leading-tight">
                  {h.name}
                </span>
                {h.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                    {h.description}
                  </p>
                ) : null}
              </div>

              {/* Visualization: track habits → full line chart; others → heatmap */}
              {isTrack ? (
                <HabitYearLineChart
                  entries={entries}
                  widthPx={gridWidthPx}
                />
              ) : (
                <HabitHeatmap
                  entries={entries}
                  showWeekdayLabels={false}
                  showMonthLabels={false}
                />
              )}

              {/* 4-stat strip — mirrors HabitDetailChart stats row at compact size */}
              <div className="w-[220px] shrink-0 grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="text-sm font-bold text-green-600 leading-tight">
                    {streak?.current_streak ?? '-'}
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-tight">
                    Current
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-600 leading-tight">
                    {streak?.longest_streak ?? '-'}
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-tight">
                    Longest
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-500 leading-tight">
                    {streak?.total_streak ?? '-'}
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-tight">
                    Total
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-600 leading-tight">
                    {completionRate}
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-tight">
                    Rate
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HabitYearOverview;
