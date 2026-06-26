import React, { useState, useMemo, useRef } from 'react';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import HabitHeatmap, { buildHeatmapWeeks } from './HabitHeatmap';
import { computeCompletionRate } from './habitStats';

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

  // captureRef targets a hidden no-labels heatmap.
  // Month and weekday labels are drawn as jsPDF vector text so they can never be clipped.
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    const node = captureRef.current;
    if (!node) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      // Capture the pure colored grid (no labels — they'd be clipped by html2canvas).
      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth  = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin       = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = margin + 18;

      // ── Title ────────────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(17, 24, 39);
      doc.text(habit.name, margin, y);
      y += 28;

      // ── Description ──────────────────────────────────────────────────────────
      if (habit.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(107, 114, 128);
        const lines = doc.splitTextToSize(habit.description, contentWidth) as string[];
        doc.text(lines, margin, y);
        y += lines.length * 15;
      }
      y += 20;

      // ── Heatmap section ──────────────────────────────────────────────────────
      // Reserve space on the left for weekday labels and above for month labels.
      const weekdayColWidth = 26; // pt — enough for "Mon" at 8pt
      const monthRowHeight  = 14; // pt — 8pt font + gap

      // Use the same week structure the component uses to get label positions.
      const { weeks, monthLabels } = buildHeatmapWeeks(entries);
      const numWeeks = weeks.length;

      // Grid image: fill contentWidth minus the weekday column.
      const ratio      = canvas.height / canvas.width;
      const maxGridH   = pageHeight - y - monthRowHeight - 170;
      let gridW = contentWidth - weekdayColWidth;
      let gridH = gridW * ratio;
      if (gridH > maxGridH) { gridH = maxGridH; gridW = gridH / ratio; }

      const gridX = margin + weekdayColWidth;
      const gridY = y + monthRowHeight;

      // Draw month labels (vector) above the grid
      const weekPt = gridW / numWeeks;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      Object.entries(monthLabels).forEach(([idxStr, label]) => {
        doc.text(label, gridX + parseInt(idxStr) * weekPt, y + monthRowHeight - 3);
      });

      // Draw weekday labels (vector) to the left of the grid
      const rowH = gridH / 7;
      doc.setTextColor(156, 163, 175);
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((wd, i) => {
        doc.text(wd, margin, gridY + (i + 0.5) * rowH + 3);
      });

      // Place the grid image
      doc.addImage(imgData, 'PNG', gridX, gridY, gridW, gridH);
      y = gridY + gridH + 18;

      // ── Legend ───────────────────────────────────────────────────────────────
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFillColor(74, 222, 128);
      doc.rect(margin, y - 8, 9, 9, 'F');
      doc.text('Completed', margin + 14, y);
      doc.setFillColor(229, 231, 235);
      doc.rect(margin + 82, y - 8, 9, 9, 'F');
      doc.text('Not completed', margin + 96, y);
      y += 28;

      // ── Divider ──────────────────────────────────────────────────────────────
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 22;

      // ── Stats — 4 columns, native vector text ────────────────────────────────
      const stats: { value: string; label: string; color: [number, number, number] }[] = [
        { value: String(streak?.current_streak ?? '-'), label: 'CURRENT STREAK',  color: [22, 163, 74]   },
        { value: String(streak?.longest_streak ?? '-'), label: 'LONGEST STREAK',  color: [22, 163, 74]   },
        { value: String(streak?.total_streak  ?? '-'),  label: 'TOTAL COUNT',     color: [107, 114, 128] },
        { value: completionRate,                         label: 'COMPLETION RATE', color: [22, 163, 74]   },
      ];
      const colW = contentWidth / stats.length;
      stats.forEach((s, i) => {
        const cx = margin + colW * i + colW / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(26);
        doc.setTextColor(s.color[0], s.color[1], s.color[2]);
        doc.text(s.value, cx, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(s.label, cx, y + 18, { align: 'center' });
      });

      // ── Footer ───────────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - margin + 10);

      const safeName = habit.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
      doc.save(`${safeName || 'habit'}-year-box.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('Failed to export PDF', err);
      toast.error('Could not generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

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
  // Delegated to the shared helper so HabitYearOverview can reuse the same logic.
  const completionRate = useMemo(
    () => computeCompletionRate(streak, entries),
    [streak, entries],
  );

  return (
    <div className="max-w-3xl mx-auto p-4 mt-8 bg-white rounded-lg shadow-lg border relative">
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onClose}
          aria-label="Close chart"
        >
          ×
        </Button>
      )}
      <h2 className="text-2xl font-bold mb-1">{habit.name}</h2>
      <div className="mb-4 text-md text-muted-foreground">{habit.description}</div>
      {habit.habit_type === 'build' || habit.habit_type === 'break' ? (
        <div className="mb-8 p-4 rounded-lg border bg-white/80 shadow-sm">
          {/* Export button row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Year overview</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
              aria-label="Save year box as PDF"
            >
              <Download />
              {isExporting ? 'Generating…' : 'Export PDF'}
            </Button>
          </div>
          {/* Visible heatmap — shown to the user with all labels */}
          <HabitHeatmap entries={entries} />

          {/* Hidden capture element — pure grid, no labels.
              Month & weekday labels are drawn as jsPDF vector text above/left of the image. */}
          <div
            ref={captureRef}
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}
            className="bg-white"
          >
            <HabitHeatmap entries={entries} showMonthLabels={false} showWeekdayLabels={false} />
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
