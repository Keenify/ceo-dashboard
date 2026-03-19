import React, { useState, useMemo } from 'react';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';
import { Button } from '@/components/ui/button';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

/**
 * Props for HabitDetailChart
 */
export interface HabitDetailChartProps {
  habit: FetchedHabit;
  entries: HabitEntryResponse[];
  streak: HabitStreakResponse | null;
  onClose?: () => void;
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

/**
 * Displays a detailed chart and stats for a habit, including calendar grid or line/bar chart depending on habit type.
 */
export const HabitDetailChart: React.FC<HabitDetailChartProps> = ({ habit, entries, streak, onClose }) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // --- Calendar Grid Data Preprocessing (for build/break habits) ---
  const { weeks, weekdays, monthLabels, getCellColor, getCellTooltip } = useMemo(() => {
    // 1. Find the first Monday before or on the start date
    const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const endDate = new Date();
    const firstMonday = new Date(startDate);
    firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
    // 2. Build weeks: each week is an array of 7 days (Mon-Sun)
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
    // 4. Color scale
    function getCellColor(entry?: HabitEntryResponse) {
      if (!entry) return 'bg-gray-100';
      if (entry.status === 'completed') return 'bg-green-400';
      return 'bg-gray-200';
    }
    // 5. Tooltip
    function getCellTooltip(date: Date, entry?: HabitEntryResponse) {
      const dateStr = date.toLocaleDateString();
      if (!entry) return `${dateStr}: Not completed`;
      if (entry.status === 'completed') return `${dateStr}: Completed`;
      return `${dateStr}: Not completed`;
    }
    return { weeks, weekdays, monthLabels, getCellColor, getCellTooltip };
  }, [entries]);

  // --- Chart Data Preprocessing (for track habits) ---
  const { rawTrackData, trackData, minY, maxY } = useMemo(() => {
    const rawTrackData = entries
      .filter((e) => e.value !== null && !isNaN(Number(e.value)) && Number(e.value) !== 0)
      .map((e) => ({ date: e.entry_date, value: Number(e.value) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let trackData: { date: string; value: number | null }[] = [];
    if (rawTrackData.length > 0) {
      const firstDate = new Date(rawTrackData[0].date);
      const lastDate = new Date(rawTrackData[rawTrackData.length - 1].date);
      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const found = rawTrackData.find((t) => t.date === dateStr);
        trackData.push({ date: dateStr, value: found ? found.value : null });
      }
    }
    const yValues = trackData.filter(d => d.value !== null).map(d => d.value as number);
    const minValue = yValues.length > 0 ? Math.min(...yValues) : 0;
    const maxValue = yValues.length > 0 ? Math.max(...yValues) : 1;
    const buffer = Math.max(1, Math.round((maxValue - minValue) * 0.05));
    const minY = minValue - buffer;
    const maxY = maxValue + buffer;
    return { rawTrackData, trackData, minY, maxY };
  }, [entries]);

  // --- Completion Rate Calculation ---
  const completionRate = useMemo(() => {
    if (streak && streak.total_streak > 0) {
      const completedDates = entries
        .filter((e) => e.status === 'completed')
        .map((e) => new Date(e.entry_date));
      if (completedDates.length > 0) {
        const firstDate = new Date(Math.min(...completedDates.map(d => d.getTime())));
        const today = new Date();
        const days = Math.max(1, Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return `${Math.round((streak.total_streak / days) * 100)}%`;
      }
    }
    return '-';
  }, [streak, entries]);

  return (
    <div className="max-w-3xl mx-auto p-4 mt-8 bg-white rounded-lg shadow-lg border relative">
      {onClose && (
        <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={onClose} aria-label="Close chart">
          ×
        </Button>
      )}
      <h2 className="text-2xl font-bold mb-1">{habit.name}</h2>
      <div className="mb-4 text-md text-muted-foreground">{habit.description}</div>
      {habit.habit_type === 'build' || habit.habit_type === 'break' ? (
        <div className="mb-8 p-4 rounded-lg border bg-white/80 shadow-sm">
          <div className="flex">
            {/* Weekday labels on the left */}
            <div className="flex flex-col justify-between mr-0.5 mt-3.5">
              {weekdays.map((wd) => (
                <div key={wd} className="h-3 text-[10px] text-gray-400 font-medium flex items-center" style={{ height: 12 }}>{wd}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div>
              {/* Month labels */}
              <div className="flex mb-0 ml-[0.5px]">
                {weeks.map((_, i) => (
                  <div key={i} className="w-3 text-[10px] text-gray-700 font-semibold text-center">
                    {monthLabels[i] || ''}
                  </div>
                ))}
              </div>
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
        </div>
      ) : (
        <div className="mb-8 bg-white rounded shadow p-2">
          {/* Chart type toggle */}
          <div className="flex gap-2 mb-2 justify-end">
            <button
              className={`px-3 py-1 rounded-full text-sm font-medium border ${chartType === 'line' ? 'bg-green-100 text-green-700 border-green-400' : 'bg-gray-100 text-gray-500 border-gray-300'} transition-colors`}
              onClick={() => setChartType('line')}
            >
              Line Chart
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm font-medium border ${chartType === 'bar' ? 'bg-green-100 text-green-700 border-green-400' : 'bg-gray-100 text-gray-500 border-gray-300'} transition-colors`}
              onClick={() => setChartType('bar')}
            >
              Bar Chart
            </button>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {rawTrackData.length === 0 ? (
              <div className="text-gray-400 text-sm">No data to display.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={trackData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      fontSize={12}
                      angle={-30}
                      textAnchor="end"
                      height={40}
                      interval={Math.ceil(trackData.length / 10)}
                    />
                    <YAxis fontSize={12} width={40} domain={[minY, maxY]} allowDataOverflow />
                    <Tooltip labelFormatter={d => new Date(d).toLocaleDateString()} />
                    <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={true} connectNulls={false} />
                  </LineChart>
                ) : (
                  <BarChart data={trackData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      fontSize={12}
                      angle={-30}
                      textAnchor="end"
                      height={40}
                      interval={Math.ceil(trackData.length / 10)}
                    />
                    <YAxis fontSize={12} width={40} domain={[minY, maxY]} allowDataOverflow />
                    <Tooltip labelFormatter={d => new Date(d).toLocaleDateString()} />
                    <Bar dataKey="value" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{streak?.current_streak ?? '-'}</div>
          <div className="uppercase text-xs text-muted-foreground">Current Streak</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{streak?.longest_streak ?? '-'}</div>
          <div className="uppercase text-xs text-muted-foreground">Longest Streak</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-500">{streak?.total_streak ?? '-'}</div>
          <div className="uppercase text-xs text-muted-foreground">Total Count</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{completionRate}</div>
          <div className="uppercase text-xs text-muted-foreground">Completion Rate</div>
        </div>
      </div>
    </div>
  );
};

export default HabitDetailChart; 