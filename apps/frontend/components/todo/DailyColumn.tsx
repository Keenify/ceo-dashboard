"use client";

import React, { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { UniqueIdentifier, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FetchedTodo } from '@/app/todo/services/useTodos'; 
import { SortableTodoItem } from './WeeklyTodoList'; 

const MIN_VISIBLE_LINES = 25;

interface DailyColumnProps {
  date: Date;
  dateString: string;
  dailyTodos: FetchedTodo[];
  editingTodoId: string | null;
  editingDateString: string | null;
  activeInputValue: string;
  activeInputRef: React.RefObject<HTMLInputElement>;
  apiLoading: boolean;
  apiError: Error | null;
  handleActiveInputChange: (value: string) => void;
  onSubmitEdit: () => Promise<boolean>;
  onCancelEdit: () => void;
  handleAddInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleAddInputBlur: () => void;
  handleToggleComplete: (todo: FetchedTodo) => void;
  handleDeleteClick: (todoId: string) => void;
  activateEditState: (dateString: string | null, todoToEdit: FetchedTodo | null) => void | Promise<void>;
  onUpdateColor: (todo: FetchedTodo, color: string | null) => void;
  onToggleHighlight: (todo: FetchedTodo) => void;
}

export function DailyColumn({
  date,
  dateString,
  dailyTodos,
  editingTodoId,
  editingDateString,
  activeInputValue,
  activeInputRef,
  apiLoading,
  apiError,
  handleActiveInputChange,
  onSubmitEdit,
  onCancelEdit,
  handleAddInputKeyDown,
  handleAddInputBlur,
  handleToggleComplete,
  handleDeleteClick,
  activateEditState,
  onUpdateColor,
  onToggleHighlight,
}: DailyColumnProps) {
  
  const [isOver, setIsOver] = useState(false);
  
  // Create a more distinctive data payload for the droppable
  const { setNodeRef: setDroppableNodeRef, isOver: dndIsOver } = useDroppable({
    id: dateString,
    data: {
      type: 'column',
      date: dateString,
      isDateColumn: true,
      acceptsItems: true
    }
  });
  
  // Update the isOver state when dndIsOver changes
  React.useEffect(() => {
    setIsOver(dndIsOver);
  }, [dndIsOver]);
  
  const todoIds = dailyTodos.map(t => t.id);
  const numEmptyLines = Math.max(2, MIN_VISIBLE_LINES - dailyTodos.length);

  return (
    <div
      className="flex flex-col border-l border-border first:border-l-0 md:first:border-l h-full"
      data-date={dateString}
      data-is-droppable="true"
    >
      {/* Date Header */}
      <div className={`p-2 text-center border-b border-border ${isToday(date) ? 'bg-primary/10' : ''} whitespace-nowrap overflow-x-auto`}>
        <p className="text-xs md:text-sm text-muted-foreground break-all">{format(date, 'dd MMM yyyy')}</p>
        <p className={`text-sm md:text-base font-semibold uppercase break-all ${isToday(date) ? 'text-primary' : ''}`}>
          {format(date, 'EEEE')}
        </p>
      </div>

      {/* Scrollable Todo List Area with improved droppable handling */}
      <div 
        ref={setDroppableNodeRef}
        className={`flex flex-1 flex-col ${isOver ? 'bg-primary/5 border-2 border-dashed border-primary/40' : ''} transition-colors duration-200 overflow-y-auto`}
        data-column-id={dateString}
        style={{ 
          minHeight: "200px", // Ensure column has enough height for dropping
          touchAction: "manipulation", // Improve touch handling on mobile
          userSelect: "none" // Prevent text selection during drag
        }}
      >
        {/* Wrap content in SortableContext */} 
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          <div className="flex-1 p-2 space-y-0 overflow-y-auto hide-scrollbar">
            {/* Show active drop indicator */}
            {isOver && dailyTodos.length === 0 && (
              <div className="flex items-center justify-center h-12 text-sm text-muted-foreground border-2 border-dashed border-primary/40 rounded bg-primary/5">
                Drop here
              </div>
            )}

            {/* Render existing sortable todos */} 
            {dailyTodos.map((todo, index) => (
              <SortableTodoItem
                key={todo.id}
                id={todo.id}
                dateString={dateString}
                todo={todo}
                isEditing={editingTodoId === todo.id}
                activeInputValue={activeInputValue}
                onInputChange={handleActiveInputChange}
                onToggleComplete={handleToggleComplete}
                onDeleteClick={handleDeleteClick}
                onTextClick={async () => await activateEditState(null, todo)}
                onUpdateColor={(todo, color) => onUpdateColor(todo, color)}
                onToggleHighlight={onToggleHighlight}
                onSaveEdit={onSubmitEdit}
                onCancelEdit={onCancelEdit}
              />
            ))}

            {/* Always render add input at the end if in add mode for this date */}
            {editingDateString === dateString && !editingTodoId && (
              <div key={`input-${dateString}`} className="flex items-center text-sm px-1.5 py-1 border-b border-solid border-border min-h-8">
                <span className="mr-2 w-4 shrink-0"></span>
                <span className="mr-2 w-4 shrink-0"></span>
                <Input
                  ref={activeInputRef}
                  placeholder="Add new todo..."
                  value={activeInputValue}
                  onChange={(e) => handleActiveInputChange(e.target.value)}
                  onKeyDown={handleAddInputKeyDown}
                  onBlur={handleAddInputBlur}
                  className="h-auto px-1 py-0 text-sm border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none w-full bg-transparent"
                />
              </div>
            )}

            {/* Render empty lines for padding only if needed */}
            {Array.from({ length: numEmptyLines }).map((_, index) => (
              <div
                key={`empty-${dateString}-${index}`}
                className="text-sm px-1.5 py-1 border-b border-solid border-border cursor-text min-h-8"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // If we're already editing this date string, don't duplicate the action
                  if (editingDateString === dateString && !editingTodoId) {
                    // Focus the existing input if it exists
                    if (activeInputRef.current) {
                      activeInputRef.current.focus();
                    }
                    return;
                  }
                  // Otherwise, activate edit state for this date
                  await activateEditState(dateString, null);
                }}
              >
                &nbsp;
              </div>
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
} 