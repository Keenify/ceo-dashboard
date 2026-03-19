import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { HabitStreakResponse } from '@/app/habit-tracker/services/useHabitStreaks';
import HabitRow, { formatDate, getContrastYIQ } from './HabitRow';

/**
 * Props for the HabitTableDraggable component (same as HabitTable)
 */
interface HabitTableDraggableProps {
  habits: FetchedHabit[];
  dates: Date[];
  entries: Record<string, Record<string, HabitEntryResponse>>;
  streaks: Record<string, HabitStreakResponse>;
  onCreateOrUpdateEntry: (habitId: string, dateStr: string, value?: string | null) => void;
  onCellClick?: (habitId: string, dateStr: string) => void;
  onEdit: (habit: FetchedHabit) => void;
  onDelete: (habitId: string) => void;
  onNewHabit: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isNextDisabled: boolean;
  onJumpToDate: (date: Date) => void;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  updateHabitSortOrder: (habitId: string, sort_order: number) => Promise<void>;
}

/**
 * Drag-and-drop enabled Habit Table for reordering habits by sort_order.
 * Only allows drag-and-drop when isEditMode is true.
 */
export const HabitTableDraggable: React.FC<HabitTableDraggableProps> = ({
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
  isEditMode,
  setIsEditMode,
  updateHabitSortOrder,
}) => {
  // Local state for drag-and-drop order
  const [localHabits, setLocalHabits] = useState<FetchedHabit[]>([...habits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));

  useEffect(() => {
    setLocalHabits([...habits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  }, [habits]);

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(localHabits);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setLocalHabits(reordered);
    // Only update the moved habit's sort_order (backend will reset all orders)
    const movedHabit = reordered[result.destination.index];
    await updateHabitSortOrder(movedHabit.id, result.destination.index);
    // Do NOT call onEdit here!
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Table container with horizontal scroll */}
      <div className="w-full overflow-x-auto">
        <DragDropContext onDragEnd={isEditMode ? handleDragEnd : () => {}}>
          <table className="w-full table-fixed">
            {/* Table Header (reuse from HabitTable if possible) */}
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[320px]">
                  <div className="flex items-center justify-between">
                    <span>Habits</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setIsEditMode(false)}
                      aria-label="Exit edit mode"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  </div>
                </th>
                {dates.map((date) => (
                  <th key={date.toISOString()} className="py-1 text-center w-[40px] border border-border relative">
                    {date.getDate()}
                  </th>
                ))}
                <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">Current Streak</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">Longest Streak</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-muted-foreground w-[45px]">Total Streak</th>
              </tr>
            </thead>
            <Droppable droppableId="habits-droppable" isDropDisabled={!isEditMode}>
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {localHabits.map((habit, idx) => {
                    const habitEntries = entries[habit.id] || {};
                    const habitStreakData = streaks[habit.id];
                    return (
                      <Draggable
                        key={habit.id}
                        draggableId={habit.id}
                        index={idx}
                        isDragDisabled={!isEditMode}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <HabitRow
                            habit={habit}
                            dates={dates}
                            entries={habitEntries}
                            streakData={habitStreakData}
                            isEditMode={isEditMode}
                            onCreateOrUpdateEntry={onCreateOrUpdateEntry}
                            onCellClick={onCellClick}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            rowRef={dragProvided.innerRef}
                            draggableProps={dragProvided.draggableProps}
                            dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                            rowStyle={{
                              ...dragProvided.draggableProps.style,
                              cursor: isEditMode ? 'grab' : undefined,
                              background: dragSnapshot.isDragging ? '#f3f4f6' : undefined,
                            }}
                            isDragging={dragSnapshot.isDragging}
                          />
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                  {/* Stat row and new habit button row, inside tbody but after draggable rows */}
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
                      const dateStr = date.toISOString().split('T')[0];
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
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>
    </div>
  );
}; 