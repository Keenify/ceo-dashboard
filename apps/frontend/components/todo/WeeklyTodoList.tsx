"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format, startOfWeek, addDays, subDays, isToday, endOfWeek } from 'date-fns';
import { useTodos, FetchedTodo, TodoPayload, TodoUpdatePayload } from '@/app/todo/services/useTodos';
// Dnd Imports
import { 
    DndContext, 
    closestCorners,
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragEndEvent, 
    DragOverlay,
    DragStartEvent,
    UniqueIdentifier,
    closestCenter,
    pointerWithin
} from '@dnd-kit/core';
import { 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy, 
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

// Import the new DailyColumn component
import { DailyColumn } from './DailyColumn'; 
import { DraggableEditableTodoItem } from './DraggableEditableTodoItem';

interface WeeklyTodoListProps {
  user: any; 
  initialDate: Date; // Keep for internal logic if needed, or remove
  weekDates: Date[]; // Passed from page
  todosByDate: Record<string, FetchedTodo[]>; // Passed from page
  // Pass needed handlers from page
  onAddTodo: (payload: TodoPayload) => Promise<FetchedTodo | null>;
  onUpdateTodo: (todoId: string, payload: TodoUpdatePayload) => Promise<FetchedTodo | null>;
  onDeleteTodo: (todoId: string) => Promise<boolean>;
  onToggleComplete: (todo: FetchedTodo) => Promise<boolean>;
  // DND related props (optional, if needed for styling etc.)
  // activeId?: UniqueIdentifier | null;
}

const MIN_VISIBLE_LINES = 25;

// Component for individual sortable todo item
export function SortableTodoItem({ id, todo, isEditing, activeInputValue, onInputChange, onToggleComplete, onDeleteClick, onTextClick, dateString, onUpdateColor, onToggleHighlight, onSaveEdit, onCancelEdit }: {
  id: UniqueIdentifier;
  todo: FetchedTodo;
  dateString: string;
  isEditing: boolean;
  activeInputValue: string;
  onInputChange: (value: string) => void;
  onToggleComplete: (todo: FetchedTodo) => void;
  onDeleteClick: (todoId: string) => void;
  onTextClick: (todo: FetchedTodo) => void;
  onUpdateColor: (todo: FetchedTodo, color: string | null) => void;
  onToggleHighlight: (todo: FetchedTodo) => void;
  onSaveEdit: () => Promise<boolean>;
  onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: {
      dateString: dateString,
      type: 'item',
      todo: todo // Include todo data for better DnD context
    },
    // Add these options to make dragging more reliable
    animateLayoutChanges: () => false, // Disable animations for better performance
    disabled: isEditing // Disable dragging while editing
  });

  // Enhanced styling for improved drag visualization
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: isDragging ? 'relative' : undefined,
    pointerEvents: isDragging ? 'none' : undefined,
    touchAction: 'manipulation',
    userSelect: 'none',
  };

  const handleTextClick = useCallback(() => {
      if (typeof onTextClick === 'function') {
          onTextClick(todo);
      }
  }, [onTextClick, todo]);

  return (
    <div ref={setNodeRef} style={style} data-todo-id={todo.id} className="touch-manipulation">
      <DraggableEditableTodoItem
        todo={todo}
        isEditing={isEditing}
        editingValue={activeInputValue}
        onEditingValueChange={onInputChange}
        onToggleComplete={onToggleComplete}
        onDeleteClick={onDeleteClick}
        onTextClick={handleTextClick}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        attributes={attributes}
        listeners={listeners}
        onUpdateColor={onUpdateColor}
        onToggleHighlight={onToggleHighlight}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function WeeklyTodoList({
    user, 
    initialDate, // Keep or remove based on internal needs
    weekDates,
    todosByDate,
    onAddTodo,
    onUpdateTodo,
    onDeleteTodo,
    onToggleComplete,
    // activeId, // DND prop
 }: WeeklyTodoListProps) {
  // Remove state lifted to parent: weekDates, todos
  // Remove hooks lifted to parent: useTodos
  // Remove DND state: activeId, draggedItem
  // Remove DND context and handlers: sensors, handleDragStart, handleDragEnd
  
  // Keep local state for editing UI
  const [editingDateString, setEditingDateString] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [activeInputValue, setActiveInputValue] = useState<string>('');
  const activeInputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Edit/Add Handlers that call props ---

  // Simplified handleSaveAndReset - now primarily calls parent handlers
  const handleSaveAndReset = useCallback(async () => {
    if (blurTimeoutRef.current) { clearTimeout(blurTimeoutRef.current); blurTimeoutRef.current = null; }
    const taskTitle = activeInputValue.trim();
    let success = false;

    if (taskTitle && user) {
        if (editingTodoId) { // Update existing
            const originalTodo = Object.values(todosByDate).flat().find(t => t.id === editingTodoId);
             // Only call update if title actually changed
          if (originalTodo && originalTodo.title !== taskTitle) {
                const updated = await onUpdateTodo(editingTodoId, { title: taskTitle });
                success = !!updated;
          } else {
                 success = true; // No change needed, consider it success
            }
        } else if (editingDateString) { // Add new
            const payload: TodoPayload = { title: taskTitle, due_date: editingDateString, user_id: user.id }; // Let parent add user_id
            const added = await onAddTodo(payload);
            success = !!added;
        }
    }
    // Reset local editing state
    setEditingTodoId(null);
    setEditingDateString(null);
    setActiveInputValue('');
    return success;
  }, [activeInputValue, user, editingTodoId, editingDateString, onUpdateTodo, onAddTodo, todosByDate]);

  // activateEditState remains mostly the same, but calls handleSaveAndReset which now uses props
  const activateEditState = useCallback((dateString: string | null, todoToEdit: FetchedTodo | null) => {
      const previousEditingTodoId = editingTodoId;
      const previousEditingDateString = editingDateString;
      const switchContext = () => {
          if (todoToEdit && todoToEdit.id === previousEditingTodoId) return; 
          if (dateString && dateString === previousEditingDateString) return;

          if (todoToEdit) {
              setEditingTodoId(todoToEdit.id);
              setActiveInputValue(todoToEdit.title);
              setEditingDateString(null);
          } else if (dateString) {
              setEditingDateString(dateString);
              setEditingTodoId(null);
              setActiveInputValue('');
          }
          setTimeout(() => activeInputRef.current?.focus(), 0);
      };
      if (editingTodoId || editingDateString) { handleSaveAndReset().then(switchContext); }
      else { switchContext(); }
  }, [editingTodoId, editingDateString, handleSaveAndReset]);

  // Input Handlers remain the same (handleActiveInputChange, handleInputKeyDown, handleInputBlur)
  const handleActiveInputChange = (value: string) => {
    setActiveInputValue(value);
  };

  const handleInputKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const wasAddingNew = !!editingDateString; 
        const currentlyEditedDate = editingDateString;

        const saved = await handleSaveAndReset();

        if (saved && wasAddingNew && currentlyEditedDate) {
            setEditingDateString(currentlyEditedDate);
            setEditingTodoId(null);
            setActiveInputValue('');
            requestAnimationFrame(() => {
               activeInputRef.current?.focus();
            });
        }
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        setEditingTodoId(null);
        setEditingDateString(null);
        setActiveInputValue('');
    }
  };

  const handleInputBlur = () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(async () => {
          if ((editingDateString || editingTodoId) && activeInputValue.trim()) {
              await handleSaveAndReset();
          } else {
              setEditingTodoId(null);
              setEditingDateString(null);
              setActiveInputValue('');
          }
          blurTimeoutRef.current = null;
      }, 150);
  };

  // Toggle/Delete Handlers call props directly
  const handleToggleComplete = (todo: FetchedTodo) => {
    onToggleComplete(todo);
  };
  const handleDeleteClick = (todoId: string) => {
    onDeleteTodo(todoId);
  };

  // Add this function to handle cancel edit
  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingDateString(null);
    setActiveInputValue('');
  };

  // --- Render Logic ---
  return (
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 md:grid-cols-7">
        {/* Use weekDates prop */} 
          {weekDates.map((date) => {
            const dateString = format(date, 'yyyy-MM-dd');
          // Use todosByDate prop
          const dailyTodos = todosByDate[dateString] || []; 
            
            return (
              <DailyColumn
                key={dateString}
                date={date}
                dateString={dateString}
                dailyTodos={dailyTodos}
                editingTodoId={editingTodoId}
                editingDateString={editingDateString}
                activeInputValue={activeInputValue}
                activeInputRef={activeInputRef}
                apiLoading={false} // Loading state handled by parent
                apiError={null}    // Error state handled by parent
                handleActiveInputChange={handleActiveInputChange} // Pass setter directly
                onSubmitEdit={handleSaveAndReset}
                onCancelEdit={handleCancelEdit}
                handleAddInputKeyDown={handleInputKeyDown} // Local handler
                handleAddInputBlur={handleInputBlur}       // Local handler
                handleToggleComplete={handleToggleComplete} // Wrapper calling prop
                handleDeleteClick={handleDeleteClick}       // Wrapper calling prop
                activateEditState={activateEditState}       // Local handler
                onUpdateColor={(todo, color) => onUpdateTodo(todo.id, { color_code: color })}
                onToggleHighlight={() => {}} // No-op
              />
            );
          })}
        </div>
      </div>
  );
} 