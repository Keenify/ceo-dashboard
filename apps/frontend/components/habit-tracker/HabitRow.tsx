import React, { useState, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';
import { Pencil, Trash2, ArrowUpCircle, Ban, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';

/**
 * Utility: Formats a Date object into a YYYY-MM-DD string.
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Utility: Calculates contrasting text color (black or white) for a given hex background.
 */
export function getContrastYIQ(hexcolor: string): string {
  hexcolor = hexcolor.replace('#', '');
  const r = parseInt(hexcolor.substring(0, 2), 16);
  const g = parseInt(hexcolor.substring(2, 4), 16);
  const b = parseInt(hexcolor.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

/**
 * Props for the HabitRow component.
 */
export interface HabitRowProps {
  habit: FetchedHabit;
  dates: Date[];
  entries: Record<string, HabitEntryResponse>;
  streakData?: HabitStreakResponse;
  isEditMode: boolean;
  onCreateOrUpdateEntry: (habitId: string, dateStr: string, value?: string | null) => void;
  onCellClick?: (habitId: string, dateStr: string) => void;
  onEdit: (habit: FetchedHabit) => void;
  onDelete: (habitId: string) => void;
  rowRef?: Ref<HTMLTableRowElement>;
  draggableProps?: React.HTMLAttributes<HTMLTableRowElement>;
  dragHandleProps?: React.HTMLAttributes<HTMLTableRowElement>;
  rowStyle?: React.CSSProperties;
  isDragging?: boolean;
  onRowClick?: (habitId: string) => void;
}

/**
 * Represents a single row in the habit tracker table.
 * Displays the habit name, edit button, daily completion boxes, and streak.
 */
const HabitRow: React.FC<HabitRowProps> = ({ habit, dates, entries, streakData, isEditMode, onCreateOrUpdateEntry, onCellClick, onEdit, onDelete, rowRef, draggableProps, dragHandleProps, rowStyle, isDragging, onRowClick }) => {
  // Choose icon and color based on habit type
  let HabitTypeIcon = ArrowUpCircle;
  let iconColor = 'text-green-500';
  if (habit.habit_type === 'break') {
    HabitTypeIcon = Ban;
    iconColor = 'text-red-500';
  } else if (habit.habit_type === 'track') {
    HabitTypeIcon = BarChart2;
    iconColor = 'text-blue-500';
  }

  // State for inline editing of track habits
  const [editingCell, setEditingCell] = useState<string | null>(null); // Stores dateStr of cell being edited
  const [editValue, setEditValue] = useState<string>(""); // Current value in the input

  if (isDragging) {
    // Only render the habit column for drag preview
    return (
      <tr
        key={habit.id}
        className="group drag-preview-row"
        ref={rowRef}
        {...draggableProps}
        {...dragHandleProps}
        style={rowStyle}
      >
        <td className="px-3 py-2 flex items-start w-[320px] bg-card rounded shadow-lg">
          {isEditMode && (
            <div className="flex items-center mr-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(habit);
                }}
                aria-label={`Edit habit ${habit.name}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(habit.id);
                }}
                aria-label={`Delete habit ${habit.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-start overflow-hidden flex-grow min-w-0">
            <HabitTypeIcon className={`h-5 w-5 mr-2 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
            <span className="text-sm font-medium pr-1" title={habit.name}>{habit.name}</span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      key={habit.id}
      className="group hover:bg-muted/50"
      ref={rowRef}
      {...draggableProps}
      {...dragHandleProps}
      style={rowStyle}
    >
      {/* Habit Name and Edit/Delete Buttons */}
      <td
        className="px-3 py-2 flex items-start w-[320px] habit-name-cell"
        onClick={() => {
          if (!isEditMode && onRowClick) onRowClick(habit.id);
        }}
        style={{ cursor: !isEditMode && onRowClick ? 'pointer' : undefined }}
      >
        {/* Conditional Edit/Delete Icons */}
        {isEditMode && (
          <div className="flex items-center mr-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(habit);
              }}
              aria-label={`Edit habit ${habit.name}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive hover:text-destructive/90"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(habit.id);
              }}
              aria-label={`Delete habit ${habit.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
        {/* Habit Type Icon and Name */}
        <div className="flex items-start overflow-hidden flex-grow min-w-0">
          <HabitTypeIcon className={`h-5 w-5 mr-2 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
          <span
            className="text-sm font-medium pr-1 habit-name-link"
            title={habit.description}
            style={{ textDecoration: !isEditMode && onRowClick ? 'underline' : undefined }}
          >
            {habit.name}
          </span>
        </div>
      </td>
      {/* Daily Completion Boxes */}
      {dates.map((date) => {
        const dateStr = formatDate(date);
        const entry = entries?.[dateStr];
        const isCompleted = entry?.status === 'completed';
        const isTrackHabit = habit.habit_type === 'track';
        const hexColor = habit.color_code;
        const completedStyle = isCompleted ? { backgroundColor: hexColor } : {};

        // --- Handlers for Inline Input ---
        const handleCellClick = () => {
          // Call onCellClick immediately for note date selection (fixes lag bug)
          if (onCellClick) {
            onCellClick(habit.id, dateStr);
          }
          
          if (isTrackHabit) {
            setEditValue(entry?.value?.toString() ?? ""); // Pre-fill with current value
            setEditingCell(dateStr);
          } else {
            // For build/break, toggle immediately
            onCreateOrUpdateEntry(habit.id, dateStr, null); // Send null for value
          }
        };

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          setEditValue(e.target.value);
        };

        const handleInputSubmit = () => {
          if (editingCell !== dateStr) return; // Only submit if this cell is being edited

          // Trim whitespace and parse carefully
          const trimmedValue = editValue.trim();
          const value = trimmedValue === "" ? null : trimmedValue;

          if (trimmedValue === "" && value !== null) {
            return;
          }
          onCreateOrUpdateEntry(habit.id, dateStr, value);
          setEditingCell(null); // Exit edit mode
        };

        const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            handleInputSubmit();
          }
          if (e.key === 'Escape') {
            setEditingCell(null); // Cancel edit on Escape
          }
        };
        // --- End Handlers ---

        return (
          <td
            key={dateStr}
            className={cn(
              "p-0 text-center w-[40px] h-[40px] cursor-pointer transition-all duration-150 relative",
              !isCompleted && (date.getDay() === 0 || date.getDay() === 6) && "weekend-highlighted-cell",
              isCompleted
                ? "text-white"
                : "bg-white dark:bg-background border border-border",
              editingCell !== dateStr && (isCompleted ? "hover:brightness-90 dark:hover:brightness-110" : "hover:bg-muted/50")
            )}
            style={completedStyle}
            onClick={handleCellClick}
            aria-label={isTrackHabit ? `Enter value for ${habit.name} on ${dateStr}` : `Toggle ${habit.name} for ${dateStr}`}
            title={`${habit.name}${entry ? ` (${entry.status}${entry.value !== null ? ": " + entry.value : ""})` : ' (pending)'}`}
          >
            {editingCell === dateStr ? (
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editValue}
                onChange={handleInputChange}
                onBlur={handleInputSubmit}
                onKeyDown={handleInputKeyDown}
                className="absolute inset-0 w-full h-full text-center border-none rounded-none bg-transparent text-inherit p-0 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                autoFocus
              />
            ) : isTrackHabit && isCompleted && entry?.value !== null ? (
              <span
                className="flex items-center justify-center h-full w-full text-xs font-medium m-0 p-0"
                style={{ color: getContrastYIQ(hexColor) }}
              >
                {entry.value}
              </span>
            ) : (
              <div className="h-full"></div>
            )}
          </td>
        );
      })}
      {/* Current Streak Column */}
      <td className="px-3 py-2 text-center w-[45px]">
        <span className="text-sm font-medium">{streakData?.current_streak ?? 0}</span>
      </td>
      {/* Longest Streak Column */}
      <td className="px-3 py-2 text-center w-[45px]">
        <span className="text-sm font-medium">{streakData?.longest_streak ?? 0}</span>
      </td>
      {/* Total Streak Column */}
      <td className="px-3 py-2 text-center w-[45px]">
        <span className="text-sm font-medium">{streakData?.total_streak ?? 0}</span>
      </td>
    </tr>
  );
};

export default HabitRow;

<style jsx global>{`
  .habit-name-cell:hover .habit-name-link {
    text-decoration: underline;
    color: #22c55e;
  }
`}</style> 