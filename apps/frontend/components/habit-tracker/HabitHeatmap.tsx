'use client';

import React, { useMemo } from 'react';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import clsx from 'clsx';

/**
 * UTC date formatter — preserved exactly from HabitDetailChart to avoid any
 * visual regression in the existing detail chart (do NOT change to local time here).
 */
const formatDate = (date: Date) => date.toISOString().split('T')[0];

export interface HeatmapWeeks {
  weeks: { date: Date; entry?: HabitEntryResponse }[][];
  weekdays: string[];
  monthLabels: { [weekIdx: number]: string };
}

/**
 * Builds the rolling 12-month week grid (one year ago → today, Mon–Sun columns).
 * Pure function: the date structure doesn't depend on entries; entries are used
 * only for per-cell color lookup inside the component.
 * Exported so HabitYearOverview can render the shared month-label header once.
 */
export function buildHeatmapWeeks(entries: HabitEntryResponse[]): HeatmapWeeks {
  // 1. Find the first Monday before or on the start date
  const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const endDate = new Date();
  const firstMonday = new Date(startDate);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  // 2. Build weeks: each week is an array of 7 days (Mon–Sun)
  const weeks: { date: Date; entry?: HabitEntryResponse }[][] = [];
  let week: { date: Date; entry?: HabitEntryResponse }[] = [];
  for (let d = new Date(firstMonday); d <= endDate; d.setDate(d.getDate() + 1)) {
    week.push({
      date: new Date(d),
      entry: entries.find(e => e.entry_date === formatDate(d)),
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    // Fill last week to 7 days
    while (week.length < 7) {
      const last = new Date(week[week.length - 1].date);
      last.setDate(last.getDate() + 1);
      week.push({ date: last });
    }
    weeks.push(week);
  }
  // 3. Weekday and month labels
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Find the first day of each month for month labels
  const monthLabels: { [weekIdx: number]: string } = {};
  weeks.forEach((w, i) => {
    const firstDay = w[0].date;
    if (firstDay.getDate() <= 7) {
      monthLabels[i] = firstDay.toLocaleString('default', { month: 'short' });
    }
  });
  return { weeks, weekdays, monthLabels };
}

function getCellColor(entry?: HabitEntryResponse) {
  if (!entry) return 'bg-gray-100';
  if (entry.status === 'completed') return 'bg-green-400';
  return 'bg-gray-200';
}

function getCellTooltip(date: Date, entry?: HabitEntryResponse) {
  const dateStr = date.toLocaleDateString();
  if (!entry) return `${dateStr}: Not completed`;
  if (entry.status === 'completed') return `${dateStr}: Completed`;
  return `${dateStr}: Not completed`;
}

export interface HabitHeatmapProps {
  entries: HabitEntryResponse[];
  /** Show Mon–Sun weekday labels on the left. Default: true */
  showWeekdayLabels?: boolean;
  /** Show month abbreviation header above the grid. Default: true */
  showMonthLabels?: boolean;
}

/**
 * Renders a GitHub-style contribution heatmap for a single habit.
 * Extracted from HabitDetailChart so both the detail panel and the
 * all-habits year overview can share the same rendering logic.
 */
export const HabitHeatmap: React.FC<HabitHeatmapProps> = ({
  entries,
  showWeekdayLabels = true,
  showMonthLabels = true,
}) => {
  const { weeks, weekdays, monthLabels } = useMemo(() => buildHeatmapWeeks(entries), [entries]);

  return (
    <div className="flex">
      {/* Weekday labels on the left */}
      {showWeekdayLabels && (
        <div className="flex flex-col justify-between mr-0.5 mt-3.5">
          {weekdays.map((wd) => (
            <div key={wd} className="h-3 text-[10px] text-gray-400 font-medium flex items-center" style={{ height: 12 }}>
              {wd}
            </div>
          ))}
        </div>
      )}
      {/* Calendar grid */}
      <div>
        {/* Month labels */}
        {showMonthLabels && (
          <div className="flex mb-0 ml-[0.5px]">
            {weeks.map((_, i) => (
              <div key={i} className="w-3 text-[10px] text-gray-700 font-semibold text-center">
                {monthLabels[i] || ''}
              </div>
            ))}
          </div>
        )}
        {/* Grid */}
        <div className="flex">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col">
              {week.map((cell, dayIdx) => (
                <div
                  key={dayIdx}
                  className={clsx(
                    'w-3 h-3 rounded border border-gray-200 mb-[0.5px] transition-colors duration-150',
                    getCellColor(cell.entry)
                  )}
                  title={getCellTooltip(cell.date, cell.entry)}
                  style={{ marginBottom: dayIdx < 6 ? 0.5 : 0 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HabitHeatmap;
