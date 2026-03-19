import { Button } from "@/components/ui/button";
import { FetchedHabit } from "@/app/habit-tracker/services/useHabits";
import { HabitEntryResponse } from "@/app/habit-tracker/services/useHabitEntry";
import { HabitStreakResponse } from "@/app/habit-tracker/services/useHabitStreaks";
type HabitEntriesState = Record<string, Record<string, HabitEntryResponse>>;
type HabitStreaksState = Record<string, HabitStreakResponse>;
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DeleteHabitConfirmModal } from "./DeleteHabitConfirmModal";
import React from 'react';
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import "./weekend-highlight.css";
import HabitRow, { formatDate, getContrastYIQ } from './HabitRow';
import { HabitTableDraggable } from './HabitTableDraggable';

/**
 * Props for the HabitTable component.
 */
interface HabitTableProps {
  habits: FetchedHabit[];
  dates: Date[];
  entries: HabitEntriesState;
  streaks: HabitStreaksState;
  onCreateOrUpdateEntry: (habitId: string, dateStr: string, value?: string | null) => void;
  onCellClick?: (habitId: string, dateStr: string) => void;
  onEdit: (habit: FetchedHabit) => void;
  onDelete: (habitId: string) => void;
  onNewHabit: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isNextDisabled: boolean;
  onJumpToDate: (date: Date) => void;
  onUpdateSortOrder?: (habitId: string, sort_order: number) => Promise<void>;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  onRowClick?: (habitId: string) => void;
}

/**
 * The main Habit Tracker table component.
 * Renders the header with date navigation, the table body with habit rows, 
 * and a footer button to add new habits.
 */
export const HabitTable = ({
  habits,
  dates,
  entries,
  streaks,
  onCreateOrUpdateEntry,
  onCellClick,
  onEdit,
  onDelete,
  onNewHabit,
  onPreviousPage,
  onNextPage,
  isNextDisabled,
  onJumpToDate,
  onUpdateSortOrder,
  isEditMode,
  setIsEditMode,
  onRowClick
}: HabitTableProps) => {
  // Debug log for visible dates and today
  const todayNow = new Date();
  const todayUtcNow = new Date(Date.UTC(todayNow.getUTCFullYear(), todayNow.getUTCMonth(), todayNow.getUTCDate()));

  // Add local state for sorted habits
  const [localHabits, setLocalHabits] = useState<FetchedHabit[]>([]);

  // Effect to update local state when habits prop changes
  React.useEffect(() => {
    setLocalHabits([...habits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  }, [habits]);

  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);
  const [deleteHabitName, setDeleteHabitName] = useState<string | undefined>(undefined);
  const handleRequestDelete = (habitId: string, habitName: string) => {
    setDeleteHabitId(habitId);
    setDeleteHabitName(habitName);
  };
  const handleConfirmDelete = () => {
    if (deleteHabitId) onDelete(deleteHabitId);
    setDeleteHabitId(null);
    setDeleteHabitName(undefined);
  };
  const handleCancelDelete = () => {
    setDeleteHabitId(null);
    setDeleteHabitName(undefined);
  };

  // Month and weekday names for display
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

  // Determine the month and year to display based on the middle date of the range
  const displayMonth = months[dates[Math.floor(dates.length / 2)].getMonth()];
  const displayYear = dates[Math.floor(dates.length / 2)].getFullYear();

  const [showCalendar, setShowCalendar] = useState(false);

  // Handler for updating sort order (for drag-and-drop)
  const updateHabitSortOrder = async (habitId: string, sort_order: number) => {
    if (onUpdateSortOrder) {
      await onUpdateSortOrder(habitId, sort_order);
    }
  };

  if (isEditMode) {
    return (
      <HabitTableDraggable
        habits={habits}
        dates={dates}
        entries={entries}
        streaks={streaks}
        onCreateOrUpdateEntry={onCreateOrUpdateEntry}
        onCellClick={onCellClick}
        onEdit={onEdit}
        onDelete={onDelete}
        onNewHabit={onNewHabit}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        isNextDisabled={isNextDisabled}
        onJumpToDate={onJumpToDate}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        updateHabitSortOrder={updateHabitSortOrder}
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Top navigation for changing date range */}
      <div className="flex items-center justify-between px-3 py-2 border-b relative">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPreviousPage} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold flex items-center gap-2">
          {displayMonth} {displayYear}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-2"
            onClick={() => setShowCalendar((v) => !v)}
            aria-label="Jump to date"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNextPage} disabled={isNextDisabled} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
        </Button>
        {showCalendar && (
          <div className="absolute left-1/2 -translate-x-1/2 top-12 z-50 bg-card rounded shadow p-2">
            <Calendar
              mode="single"
              selected={dates[dates.length-1]}
              onSelect={(date) => {
                setShowCalendar(false);
                if (date) onJumpToDate(date);
              }}
              initialFocus
              fromDate={new Date(2000, 0, 1)}
              toDate={new Date()}
            />
          </div>
        )}
      </div>
      {/* Table container with horizontal scroll */}
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted/50">
              {/* Habits Column Header with Edit Toggle */}
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[320px]">
                <div className="flex items-center justify-between">
                  <span>Habits</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setIsEditMode(!isEditMode)}
                    aria-label="Toggle edit mode"
                  >
                    <SlidersHorizontal className={cn("h-3.5 w-3.5", isEditMode && "text-primary")} />
                  </Button>
                </div>
              </th>
              {/* Date Column Headers */}
              {dates.map((date) => {
                const isToday = formatDate(new Date()) === formatDate(date);
                const isSunday = date.getDay() === 0;
                const isSaturday = date.getDay() === 6;
                const weekendClass = (isSunday || isSaturday) ? "bg-yellow-50 dark:bg-yellow-900" : "";
                return (
                  <th 
                    key={date.toISOString()} 
                    className={cn(
                      "py-1 text-center w-[40px] border border-border relative",
                      (isSunday || isSaturday) && "weekend-highlighted-cell",
                      isToday && "bg-primary/10"
                    )}
                  >
                    {/* Month Abbreviation */}
                    <div className="text-[10px] text-muted-foreground">
                      {months[date.getMonth()].toUpperCase()}
                    </div>
                    {/* Date Number */}
                    <div className="text-sm font-semibold">
                      {date.getDate()}
                    </div>
                    {/* Weekday Abbreviation */}
                    <div className="text-[10px] text-muted-foreground">
                      {weekdays[date.getDay()]}
                    </div>
                  </th>
                );
              })}
              {/* Current Streak Column Header - Multi-line & Reduced width */}
              <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">
                <div>Current</div>
                <div>Streak</div>
              </th>
              {/* Longest Streak Column Header - Multi-line & Reduced width */}
              <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">
                <div>Longest</div>
                <div>Streak</div>
              </th>
              {/* Total Streak Column Header - Multi-line & Reduced width */}
              <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">
                <div>Total</div>
                <div>Streak</div>
              </th>
            </tr>
          </thead>
          {/* Table Body */}
          <tbody>
            {/* Sort habits by sort_order before rendering */}
            {localHabits
              .map((habit) => {
                const habitEntries = entries[habit.id] || {};
                const habitStreakData = streaks[habit.id];
                return (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    dates={dates}
                    entries={habitEntries}
                    streakData={habitStreakData}
                    isEditMode={isEditMode}
                    onCreateOrUpdateEntry={onCreateOrUpdateEntry}
                    onCellClick={onCellClick}
                    onEdit={onEdit}
                    onDelete={() => handleRequestDelete(habit.id, habit.name)}
                    onRowClick={onRowClick}
                  />
                );
              })}
            {/* Row for daily score, with Add Habit button in the first cell */}
            <tr>
              <td className="p-1.5">
                <Button
                  variant="ghost"
                  className="h-8 flex items-center justify-start gap-1.5 text-sm text-muted-foreground hover:text-foreground w-full"
                  onClick={onNewHabit}
                  aria-label="Add new habit"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Habit</span>
                </Button>
              </td>
              {dates.map((date) => {
                const dateStr = formatDate(date);
                let score = 0;
                localHabits.forEach((habit) => {
                  const entry = entries[habit.id]?.[dateStr];
                  if (entry?.status === 'completed') {
                    if (habit.habit_type === 'build' || habit.habit_type === 'track') {
                      score += 1;
                    } else if (habit.habit_type === 'break') {
                      score -= 1;
                    }
                  }
                });
                let bgColor = "bg-gray-200 text-gray-700";
                if (score > 0) bgColor = "bg-green-500 text-white";
                else if (score < 0) bgColor = "bg-red-500 text-white";
                return (
                  <td key={dateStr} className="text-center">
                    <span className={`inline-block min-w-[32px] px-2 py-1 rounded-full font-bold shadow-sm text-sm transition-colors duration-200 ${bgColor}`}>
                      {score}
                    </span>
                  </td>
                );
              })}
              {/* Empty cells for streak columns */}
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <DeleteHabitConfirmModal
        open={!!deleteHabitId}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        habitName={deleteHabitName}
      />
    </div>
  );
}; 