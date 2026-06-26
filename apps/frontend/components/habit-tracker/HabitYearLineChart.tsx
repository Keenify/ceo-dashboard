import React, { useMemo } from 'react';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/** UTC date formatter — matches HabitDetailChart */
const formatDate = (date: Date) => date.toISOString().split('T')[0];

interface HabitYearLineChartProps {
  entries: HabitEntryResponse[];
  /**
   * Pixel width of the heatmap grid (weeks.length * 12).
   * The chart renders at exactly widthPx so the stats strip starts at the
   * same horizontal position for both track and build/break rows.
   */
  widthPx: number;
}

/**
 * Full-history line chart for track-type habits in the Year overview.
 *
 * Mirrors HabitDetailChart.tsx exactly:
 *   - Plots the data's actual first→last logged date (not locked to one year).
 *   - Visible XAxis (month/day ticks) and YAxis with value range.
 *   - Gaps between logged dates → null values → line breaks (connectNulls=false).
 *   - Stroke #4ade80 matching the detail chart.
 *
 * Height is 120px — taller than the old sparkline so axes are readable.
 */
export const HabitYearLineChart: React.FC<HabitYearLineChartProps> = ({ entries, widthPx }) => {
  const { rawTrackData, trackData, minY, maxY, isEmpty } = useMemo(() => {
    // Mirror HabitDetailChart.tsx:155-159 filter + sort
    const rawTrackData = entries
      .filter((e) => e.value !== null && !isNaN(Number(e.value)) && Number(e.value) !== 0)
      .map((e) => ({ date: e.entry_date, value: Number(e.value) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (rawTrackData.length === 0) {
      return { rawTrackData: [], trackData: [], minY: 0, maxY: 1, isEmpty: true };
    }

    // Mirror HabitDetailChart.tsx:160-169: fill every day first→last with nulls for gaps
    const trackData: { date: string; value: number | null }[] = [];
    const firstDate = new Date(rawTrackData[0].date);
    const lastDate = new Date(rawTrackData[rawTrackData.length - 1].date);
    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      const found = rawTrackData.find((t) => t.date === dateStr);
      trackData.push({ date: dateStr, value: found ? found.value : null });
    }

    // Mirror HabitDetailChart.tsx:170-176: min/max with 5% buffer
    const yValues = trackData.filter((d) => d.value !== null).map((d) => d.value as number);
    const minValue = yValues.length > 0 ? Math.min(...yValues) : 0;
    const maxValue = yValues.length > 0 ? Math.max(...yValues) : 1;
    const buffer = Math.max(1, Math.round((maxValue - minValue) * 0.05));
    return {
      rawTrackData,
      trackData,
      minY: minValue - buffer,
      maxY: maxValue + buffer,
      isEmpty: false,
    };
  }, [entries]);

  // Empty state: same fixed dimensions so the column width stays consistent
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded"
        style={{ width: widthPx, height: 120 }}
      >
        No data
      </div>
    );
  }

  return (
    <div style={{ width: widthPx, height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={trackData}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
            fontSize={10}
            angle={-30}
            textAnchor="end"
            height={32}
            interval={Math.ceil(trackData.length / 8)}
          />
          <YAxis
            fontSize={10}
            width={36}
            domain={[minY, maxY]}
            allowDataOverflow
          />
          <Tooltip
            labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
            formatter={(v: number) => [v, 'Value']}
            contentStyle={{ fontSize: 11, padding: '2px 6px' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4ade80"
            strokeWidth={2}
            dot={rawTrackData.length <= 30}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HabitYearLineChart;
