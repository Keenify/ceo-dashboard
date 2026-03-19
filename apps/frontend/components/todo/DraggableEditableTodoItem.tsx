import React from 'react';
import ReactDOM from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Move, Star, Pencil } from 'lucide-react';
import { FetchedTodo } from '@/app/todo/services/useTodos';

interface DraggableEditableTodoItemProps {
  todo: FetchedTodo;
  isEditing: boolean;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onToggleComplete: (todo: FetchedTodo) => void;
  onDeleteClick: (todoId: string) => void;
  onTextClick: (todo: FetchedTodo) => void;
  onSaveEdit: () => Promise<any>;
  onCancelEdit: () => void;
  // dnd-kit props
  attributes?: React.HTMLAttributes<HTMLElement>;
  listeners?: React.HTMLAttributes<HTMLElement>;
  onUpdateColor: (todo: FetchedTodo, color: string | null) => void;
  onToggleHighlight: (todo: FetchedTodo) => void;
  isDragging?: boolean;
}

const COLORS = [
  "#fde047", // yellow-300
  "#f87171", // red-400
  "#34d399", // green-400
  "#60a5fa", // blue-400
  "#a78bfa", // purple-400
  "#9ca3af", // gray-400
];

/**
 * This component ensures drag-and-drop and editing can coexist:
 * - When editing, drag listeners are NOT attached, so user can type and interact with input.
 * - When not editing, drag listeners are attached to the text span, so user can drag.
 * - You can use this as a drop-in replacement for BaseTodoItem in dnd-kit Sortable context.
 */
export function DraggableEditableTodoItem({
  todo,
  isEditing: isEditingProp,
  editingValue: editingValueProp,
  onEditingValueChange: onEditingValueChangeProp,
  onToggleComplete,
  onDeleteClick,
  onTextClick,
  onSaveEdit: onSaveEditProp,
  onCancelEdit: onCancelEditProp,
  attributes = {},
  listeners = {},
  onUpdateColor,
  onToggleHighlight,
  isDragging = false,
}: DraggableEditableTodoItemProps) {
  
  // Internal state for uncontrolled edit mode
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState(todo.title);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isMouseOver, setIsMouseOver] = React.useState(false);
  const [pickerPosition, setPickerPosition] = React.useState({ top: 0, left: 0 });
  const starButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showActionContainer, setShowActionContainer] = React.useState(false);
  const [actionContainerPosition, setActionContainerPosition] = React.useState({ top: 0, left: 0 });
  const todoRowRef = React.useRef<HTMLDivElement>(null);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const colorPickerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Determine if controlled or uncontrolled
  const isControlled = typeof isEditingProp === 'boolean';
  const currentlyEditing = isControlled ? isEditingProp : isEditing;
  const value = isControlled ? editingValueProp : editingValue;
  const onEditingValueChange = isControlled ? onEditingValueChangeProp : setEditingValue;

  // Save/cancel handlers
  const handleSaveEdit = () => {
    if (isControlled) {
      onSaveEditProp();
    } else {
      setIsEditing(false);
      if (editingValue.trim() && editingValue !== todo.title) {
        if (typeof onSaveEditProp === 'function') onSaveEditProp();
      }
    }
  };
  const handleCancelEdit = () => {
    if (isControlled) {
      onCancelEditProp();
    } else {
      setIsEditing(false);
      setEditingValue(todo.title);
    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  };

  // Enter edit mode on click (was handleTextDoubleClick)
  const handleTextClick = () => {
    if (!isControlled) {
      setIsEditing(true);
      // Use requestAnimationFrame for immediate but safe focus
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Set cursor to end of text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
          // Auto-resize on initial render
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
      });
    } else if (onTextClick) {
      // Immediate callback for controlled mode
      onTextClick(todo);
    }
  };

  // Color picker logic
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
    }, 150); // Hide after 150ms when mouse leaves
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

  // Helper to check if a string is a URL
  const isUrl = (text: string) => {
    return /^https?:\/\//i.test(text) || /^www\./i.test(text);
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
  React.useEffect(() => {
    if (currentlyEditing && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          // Set cursor to end of text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
                        // Auto-resize to fit content
              inputRef.current.style.height = 'auto';
              inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  }, [currentlyEditing]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
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
      className={`group flex items-start text-sm px-1.5 py-1 border-b border-solid border-border min-h-8 ${
        todo.is_completed ? 'text-muted-foreground' : ''
      } ${isDragging ? 'opacity-70 shadow-lg border border-primary/50 rounded bg-primary/5' : ''} 
      ${isMouseOver && !currentlyEditing ? 'bg-accent/30' : ''} 
      transition-all duration-150`}
      style={{ 
        backgroundColor: todo.color_code || undefined, 
        position: 'relative',
        cursor: currentlyEditing ? 'text' : (isDragging ? 'grabbing' : 'grab'),
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        // Always use auto height to allow full content display
        height: 'auto',
      }}
      onMouseEnter={() => {
        setIsMouseOver(true);
        handleMouseEnter();
      }}
      onMouseLeave={() => {
        setIsMouseOver(false);
        handleMouseLeave();
      }}
    >
      {/* Make the move icon more prominent - users need to see this is draggable */}
      <div 
        className={`mr-2 flex items-start justify-center text-muted-foreground hover:text-primary focus:outline-none touch-none mt-0.5
        ${isMouseOver && !currentlyEditing ? 'text-primary' : ''}
        ${isDragging ? 'text-primary' : ''}`}
        {...listeners}
        {...attributes}
        style={{touchAction: 'none'}}
      >
        <Move className={`w-4 h-4 ${isDragging ? 'text-primary' : ''}`} />
      </div>
      
      {/* Checkbox for completion */}
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.is_completed}
        onCheckedChange={() => onToggleComplete(todo)}
        className="mr-2 shrink-0 mt-0.5"
        aria-label={`Mark ${todo.title} as complete`}
      />
      {/* Todo text - expand to fill all available space */}
      <div className="flex-1 min-w-0 flex items-center relative">
        {currentlyEditing ? (
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onEditingValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`resize-none text-sm border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none w-full bg-transparent overflow-hidden ${todo.is_completed ? 'line-through' : ''}`}
            style={{ 
              height: 'auto', // Always auto to fit content
              lineHeight: '1.4', // Consistent with display mode
              fontFamily: 'inherit'
            }}
            rows={1}
            autoFocus
            onInput={(e) => {
              // Auto-resize textarea to fit content
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              // Allow textarea to expand naturally to fit all content
              target.style.height = `${target.scrollHeight}px`;
            }}
            onFocus={(e) => {
              // Set cursor to end when focused and ensure proper selection
              const target = e.target as HTMLTextAreaElement;
              setTimeout(() => {
                const length = target.value.length;
                target.setSelectionRange(length, length);
                // Ensure proper height on focus
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }, 0);
            }}
          />
        ) : (
          isUrl(todo.title) ? (
            <>
              <a
                href={/^https?:\/\//i.test(todo.title) ? todo.title : `https://${todo.title}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full break-words touch-none underline text-blue-600 hover:text-blue-800 ${todo.is_completed ? 'line-through' : ''}`}
                style={{ 
                  lineHeight: '1.4', // Slightly tighter line height for better readability
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  // Always allow full height expansion
                  height: 'auto',
                  overflow: 'visible',
                }}
                title={todo.title}
                tabIndex={0}
              >
                {todo.title}
              </a>
            </>
          ) : (
            <span
              className="block w-full break-words cursor-pointer"
              style={{ 
                lineHeight: '1.4', // Slightly tighter line height for better readability
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                // Always allow full height expansion
                height: 'auto',
                overflow: 'visible',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTextClick();
              }}
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
          {/* Remove color option */}
          <button
            className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-400 focus:outline-none transition-colors"
            style={{ backgroundColor: 'transparent' }}
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
          {!currentlyEditing && isUrl(todo.title) && (
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
