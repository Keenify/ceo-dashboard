"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox"; // Use Shadcn Checkbox
import { Trash2, Move, Star, Pencil } from 'lucide-react';
import { FetchedTodo } from '@/app/todo/services/useTodos';

interface BaseTodoItemProps {
  todo: FetchedTodo;
  isEditing: boolean;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onToggleComplete: (todo: FetchedTodo) => void;
  onDeleteClick: (todoId: string) => void;
  onTextClick: (todo: FetchedTodo) => void; // To start editing
  onSaveEdit: () => void; // Triggered by Enter/Blur
  onCancelEdit: () => void; // Triggered by Escape
  onToggleHighlight: (todo: FetchedTodo) => void;
  onUpdateColor: (todo: FetchedTodo, color: string | null) => void; // NEW
  attributes?: React.HTMLAttributes<HTMLElement>;
  listeners?: React.HTMLAttributes<HTMLElement>;
}

const COLORS = [
  "#fde047", // yellow-300
  "#f87171", // red-400
  "#34d399", // green-400
  "#60a5fa", // blue-400
  "#a78bfa", // purple-400
  "#9ca3af", // gray-400
];

export function BaseTodoItem({
  todo,
  isEditing,
  editingValue,
  onEditingValueChange,
  onToggleComplete,
  onDeleteClick,
  onTextClick,
  onSaveEdit,
  onCancelEdit,
  onToggleHighlight,
  onUpdateColor, // NEW
  attributes,
  listeners,
}: BaseTodoItemProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const starButtonRef = useRef<HTMLButtonElement>(null);
  const [showActionContainer, setShowActionContainer] = useState(false);
  const [actionContainerPosition, setActionContainerPosition] = useState({ top: 0, left: 0 });
  const todoRowRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const colorPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to check if a string is a URL
  const isUrl = (text: string) => {
    return /^https?:\/\//i.test(text) || /^www\./i.test(text);
  };

  // Timer-based single vs double click for URLs
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleUrlClick = (e: React.MouseEvent) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = setTimeout(() => {
      let url = todo.title;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      clickTimer.current = null;
    }, 250);
  };

  const handleUrlDoubleClick = (e: React.MouseEvent) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onTextClick(todo);
  };

  const handleColorSelect = (color: string | null) => {
    setShowColorPicker(false);
    setShowActionContainer(false); // Hide action container immediately
    // Clear any pending timeouts
    if (colorPickerTimeoutRef.current) {
      clearTimeout(colorPickerTimeoutRef.current);
      colorPickerTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    onUpdateColor(todo, color);
  };

  const handleStarClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!showColorPicker && starButtonRef.current) {
      const rect = starButtonRef.current.getBoundingClientRect();
      const colorPickerWidth = 200; // Estimated width of color picker
      const colorPickerHeight = 50; // Estimated height of color picker
      
      // Calculate position with viewport boundary checks
      // Position under the todo item row, not just the star button
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX - 50; // Offset left a bit from the star
      
      // Ensure color picker doesn't go off the right edge
      if (left + colorPickerWidth > window.innerWidth) {
        left = window.innerWidth - colorPickerWidth - 10;
      }
      
      // Ensure color picker doesn't go off the left edge
      if (left < 10) {
        left = 10;
      }
      
      // If there's not enough space below, position above the button
      if (top + colorPickerHeight > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - colorPickerHeight - 8;
      }
      
      const position = { top, left };
      setPickerPosition(position);
      
      // Set auto-hide timeout for color picker
      colorPickerTimeoutRef.current = setTimeout(() => {
        setShowColorPicker(false);
        colorPickerTimeoutRef.current = null;
      }, 3000); // Hide after 3 seconds of inactivity
    } else {
      // If closing, clear timeout
      if (colorPickerTimeoutRef.current) {
        clearTimeout(colorPickerTimeoutRef.current);
        colorPickerTimeoutRef.current = null;
      }
    }
    setShowColorPicker((v) => !v);
  };

  // Color picker mouse handlers
  const handleColorPickerEnter = () => {
    // Clear timeout when mouse enters color picker
    if (colorPickerTimeoutRef.current) {
      clearTimeout(colorPickerTimeoutRef.current);
      colorPickerTimeoutRef.current = null;
    }
  };

  const handleColorPickerLeave = () => {
    // Set shorter timeout when mouse leaves color picker
    colorPickerTimeoutRef.current = setTimeout(() => {
      setShowColorPicker(false);
      colorPickerTimeoutRef.current = null;
    }, 150); // Hide after 500ms when mouse leaves
  };

  // Close color picker if focus is lost
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setShowColorPicker(false);
      if (colorPickerTimeoutRef.current) {
        clearTimeout(colorPickerTimeoutRef.current);
        colorPickerTimeoutRef.current = null;
      }
    }
  };

  // Handle mouse enter/leave for action container
  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    if (todoRowRef.current) {
      const rect = todoRowRef.current.getBoundingClientRect();
      setActionContainerPosition({
        top: rect.top + window.scrollY + (rect.height / 2),
        left: rect.right + window.scrollX // No gap - stick directly to edge
      });
      setShowActionContainer(true);
    }
  };

  const handleMouseLeave = () => {
    // Add delay before hiding to allow user to reach action container
    hideTimeoutRef.current = setTimeout(() => {
      setShowActionContainer(false);
    }, 150); // 150ms delay
  };

  const handleActionContainerEnter = () => {
    // Clear hide timeout when mouse enters action container
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleActionContainerLeave = () => {
    // Hide immediately when leaving action container
    setShowActionContainer(false);
  };

  // Auto-resize textarea when in edit mode
  useEffect(() => {
    if (isEditing) {
      const textarea = document.querySelector(`#todo-${todo.id}-textarea`) as HTMLTextAreaElement;
      if (textarea) {
        setTimeout(() => {
          // Set cursor to end of text
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
          // Auto-resize
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }, 0);
      }
    }
  }, [isEditing, todo.id]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (colorPickerTimeoutRef.current) {
        clearTimeout(colorPickerTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={todoRowRef}
      className={`group flex items-start text-sm p-1.5 border-b border-solid border-border min-h-8 ${todo.is_completed ? 'text-muted-foreground' : ''}`}
      style={{ backgroundColor: todo.color_code || undefined }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Drag handle (DnD listeners only here) */}
      <button
        type="button"
        aria-label="Drag"
        tabIndex={-1}
        className="mr-2 flex items-center justify-center cursor-grab text-muted-foreground hover:text-primary focus:outline-none bg-transparent border-none p-0 h-8 w-8 rounded transition-colors hover:bg-accent invisible group-hover:visible mt-0.5"
        {...attributes}
        {...listeners}
        style={{ background: 'transparent', border: 'none', padding: 0 }}
      >
        <Move className="h-5 w-5" />
      </button>
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.is_completed}
        onCheckedChange={() => onToggleComplete(todo)}
        className="mr-2 shrink-0 mt-0.5"
        aria-label={`Mark ${todo.title} as complete`}
      />
      
      {/* Todo text - expand to fill all available space */}
      <div className="flex-1 min-w-0 flex items-center relative">
        {isEditing ? (
          <textarea 
            id={`todo-${todo.id}-textarea`}
            value={editingValue}
            onChange={(e) => onEditingValueChange(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); onSaveEdit(); }
              if (event.key === 'Escape') { event.preventDefault(); onCancelEdit(); }
            }}
            onBlur={onSaveEdit}
            className={`resize-none h-auto px-1 py-0.5 text-sm border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none w-full bg-transparent overflow-hidden ${todo.is_completed ? 'line-through' : ''}`}
            style={{ 
              minHeight: '1.25rem',
              height: 'auto',
              lineHeight: '1.25rem',
              fontFamily: 'inherit'
            }}
            rows={1}
            autoFocus
            onInput={(e) => {
              // Auto-resize textarea
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
            onFocus={(e) => {
              // Set cursor to end when focused
              const target = e.target as HTMLTextAreaElement;
              const length = target.value.length;
              target.setSelectionRange(length, length);
            }}
          />
        ) : (
          isUrl(todo.title) ? (
            <a
              href={/^https?:\/\//i.test(todo.title) ? todo.title : `https://${todo.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full break-words touch-none underline text-blue-600 hover:text-blue-800 ${todo.is_completed ? 'line-through' : ''} py-0.5`}
              title={todo.title}
              tabIndex={0}
            >
              {todo.title}
            </a>
          ) : (
            <span
              onClick={() => onTextClick(todo)}
              onDoubleClick={() => onTextClick(todo)}
              className={`block w-full break-words cursor-pointer touch-none px-1 py-0.5 ${todo.is_completed ? 'line-through' : ''}`}
              tabIndex={0}
            >
              {todo.title}
            </span>
          )
        )}
        

      </div>
      {showColorPicker && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          className="fixed z-[99999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 flex gap-1"
          style={{ 
            top: `${pickerPosition.top}px`, 
            left: `${pickerPosition.left}px`,
            pointerEvents: 'auto'
          }}
          tabIndex={-1}
          onBlur={handleBlur}
          onMouseEnter={handleColorPickerEnter}
          onMouseLeave={handleColorPickerLeave}
        >
          {/* Clear/Remove color option */}
          <button
            className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-400 focus:outline-none transition-colors"
            onClick={() => handleColorSelect(null)}
            title="Remove color"
          >
            <span className="text-xs font-bold">×</span>
          </button>
          {COLORS.map(color => (
            <button
              key={color}
              className="w-5 h-5 rounded-full border border-gray-200 shadow-sm focus:outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
              title={`Select color ${color}`}
            />
          ))}
        </div>,
        document.body
      )}

      {showActionContainer && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1 flex items-center gap-1"
          style={{ 
            top: `${actionContainerPosition.top - 16}px`, // Center vertically 
            left: `${actionContainerPosition.left}px`,
            pointerEvents: 'auto'
          }}
          onMouseEnter={handleActionContainerEnter}
          onMouseLeave={handleActionContainerLeave}
        >
          {/* Star button */}
          <button
            ref={starButtonRef}
            type="button"
            aria-label="Highlight"
            tabIndex={0}
            className="flex items-center justify-center cursor-pointer text-yellow-500 hover:text-yellow-600 focus:outline-none h-6 w-6 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={handleStarClick}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: 0
            }}
          >
            <Star className="h-4 w-4" fill={todo.color_code ? 'currentColor' : 'none'} />
          </button>
          
          {/* Pencil icon (only for URL todos) */}
          {!isEditing && isUrl(todo.title) && (
            <button
              type="button"
              onClick={() => onTextClick(todo)}
              aria-label="Edit"
              tabIndex={0}
              className="flex items-center justify-center cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none h-6 w-6 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              style={{ 
                background: 'transparent', 
                border: 'none', 
                padding: 0
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          
          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(todo.id);
            }}
            aria-label={`Delete ${todo.title}`}
            tabIndex={0}
            className="flex items-center justify-center cursor-pointer text-gray-500 hover:text-red-600 focus:outline-none h-6 w-6 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: 0
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
} 