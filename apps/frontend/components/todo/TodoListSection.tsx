"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FetchedTodoList,
  TodoListUpdatePayload,
} from "@/app/todo/services/useTodoLists";
import {
  FetchedTodo,
  TodoPayload,
  TodoUpdatePayload as TodoItemUpdatePayload,
} from "@/app/todo/services/useTodos";
import { Plus, Trash2, MoreHorizontal, Pencil, Trash, ArrowRight } from "lucide-react";
import { DraggableEditableTodoItem } from "./DraggableEditableTodoItem";
import { BaseTodoItem } from "./BaseTodoItem";
import { UniqueIdentifier, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameDialog } from './RenameDialog';
import { MoveToTabDialog } from './MoveToTabDialog';

// Re-use or define a similar constant
const MIN_VISIBLE_LINES = 25;

// Props for the sortable item wrapper
interface SortableListItemProps
  extends Omit<
    React.ComponentProps<typeof DraggableEditableTodoItem>,
    "attributes" | "listeners"
  > {
  id: UniqueIdentifier;
  listId: string;
}

// Sortable wrapper around DraggableEditableTodoItem
function SortableListItem({ id, listId, ...props }: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      listId: listId,
      type: "item",
      todo: props.todo // Include todo data for better DnD context
    },
    // Add these options to make dragging more reliable
    animateLayoutChanges: () => false, // Disable animations for better performance
    disabled: props.isEditing // Disable dragging while editing
  });

  // Enhanced styling for better drag visualization
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: isDragging ? 'relative' as const : undefined,
    pointerEvents: isDragging ? 'none' : undefined, // Allow drops while dragging
    touchAction: 'manipulation', // Improve touch handling
    userSelect: 'none' // Prevent text selection while dragging
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style as React.CSSProperties} 
      data-todo-id={props.todo.id}
      className="touch-manipulation"
    >
      <DraggableEditableTodoItem
        todo={props.todo}
        isEditing={props.isEditing}
        editingValue={props.editingValue}
        onEditingValueChange={props.onEditingValueChange}
        onToggleComplete={props.onToggleComplete}
        onDeleteClick={props.onDeleteClick}
        onTextClick={props.onTextClick}
        onSaveEdit={props.onSaveEdit}
        onCancelEdit={props.onCancelEdit}
        onUpdateColor={(todo, color) => props.onUpdateColor(todo, color)}
        onToggleHighlight={props.onToggleHighlight}
        attributes={attributes}
        listeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

interface TodoListSectionProps {
  user: any;
  list: FetchedTodoList;
  todos: FetchedTodo[];
  availableTabs: { id: string; name: string }[]; // Add available tabs for move functionality
  onAddTodo: (
    payload: Omit<TodoPayload, "user_id">
  ) => Promise<FetchedTodo | null>;
  onUpdateTodo: (
    todoId: string,
    payload: TodoItemUpdatePayload
  ) => Promise<FetchedTodo | null>;
  onDeleteTodo: (todoId: string) => Promise<boolean>;
  onToggleComplete: (todo: FetchedTodo) => Promise<boolean>;
  onUpdateList: (
    listId: string,
    payload: TodoListUpdatePayload
  ) => Promise<FetchedTodoList | null>;
  onDeleteList: (listId: string) => Promise<boolean>;
  onUpdateColor: (todo: FetchedTodo, color: string | null) => void;
  columnIndex?: number; // Optional column index for debugging layout issues
}

export default function TodoListSection({
  user,
  list,
  todos: initialTodos,
  availableTabs,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onToggleComplete,
  onUpdateList,
  onDeleteList,
  onUpdateColor,
  columnIndex,
}: TodoListSectionProps) {
  const [todos, setTodos] = useState(initialTodos);
  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false); // State for add mode
  const addInputRef = useRef<HTMLInputElement>(null); // Ref for the add input
  const [isEditingListTitle, setIsEditingListTitle] = useState(false);
  const [listTitleValue, setListTitleValue] = useState(list.name);
  const listTitleInputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMoveToTabDialog, setShowMoveToTabDialog] = useState(false);

  const todoIds = useMemo(() => todos.map((t) => t.id), [todos]);
  // Always render 2 empty lines at the end for new todos
  const numEmptyLines = Math.max(2, 20);

  // --- Add Handler ---
  const handleAddNewTodo = useCallback(async () => {
    const title = newTodoTitle.trim();
    if (!title || !user) {
      // If title is empty, just cancel add mode
      setIsAdding(false);
      setNewTodoTitle("");
      return;
    }

    const payload = { title: title, list_id: list.id };
    const added = await onAddTodo(payload);
    if (added) {
      setNewTodoTitle(""); // Clear input only on success
      // Do not setIsAdding(false); so add mode stays active
    } else {
      // Handle API error - maybe keep adding mode active?
      console.error("Failed to add todo via API");
    }
  }, [newTodoTitle, user, list.id, onAddTodo]);

  // --- Input Handlers for Adding ---
  const handleAddInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddNewTodo();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsAdding(false); // Cancel add mode
      setNewTodoTitle(""); // Clear potential input
    }
  };

  const handleAddInputBlur = () => {
    // Save on blur only if there is text, otherwise cancel add mode
    if (newTodoTitle.trim()) {
      handleAddNewTodo();
    } else {
      setIsAdding(false);
      setNewTodoTitle("");
    }
  };

  // --- Edit Handlers (remain the same) ---
  const handleStartEdit = (todo: FetchedTodo) => {
    setEditingTodoId(todo.id);
    setEditingValues((prev) => ({ ...prev, [todo.id]: todo.title }));
  };

  // ...

  // When rendering DraggableEditableTodoItem (or SortableListItem), ensure:
  // <DraggableEditableTodoItem
  //   ...
  //   isEditing={editingTodoId === todo.id}
  //   editingValue={editingValues[todo.id] !== undefined ? editingValues[todo.id] : todo.title}
  //   onTextClick={handleStartEdit}
  //   ...
  // />

  const handleCancelEdit = () => {
    setEditingTodoId(null);
  };
  const handleSaveEdit = async () => {
    if (editingTodoId) {
      const value = editingValues[editingTodoId]?.trim();
      if (!value) {
        // If the value is empty, delete the todo immediately
        await onDeleteTodo(editingTodoId);
        setEditingTodoId(null);
        setEditingValues((prev) => {
          const newVals = { ...prev };
          delete newVals[editingTodoId];
          return newVals;
        });
        handleCancelEdit();
        setIsAdding(true);
        setTimeout(() => addInputRef.current?.focus(), 0);
        return;
      }
      if (value !== todos.find((t) => t.id === editingTodoId)?.title) {
        await onUpdateTodo(editingTodoId, { title: value });
      }
      setEditingTodoId(null);
      setEditingValues((prev) => {
        const newVals = { ...prev };
        delete newVals[editingTodoId];
        return newVals;
      });
      handleCancelEdit();
      // Activate add mode for the same list after saving
      setIsAdding(true);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  // --- List Action Handlers ---
  const handleRenameList = () => {
    setShowRenameDialog(true);
  };

  const handleRenameListConfirm = async (newName: string) => {
    await onUpdateList(list.id, { name: newName });
  };

  const handleDeleteList = () => {
    if (
      confirm(
        `Are you sure you want to delete the list "${list.name}"? This cannot be undone.`
      )
    ) {
      onDeleteList(list.id);
    }
  };

  const handleMoveToTab = () => {
    setShowMoveToTabDialog(true);
  };

  const handleMoveToTabConfirm = async (targetTabId: string) => {
    await onUpdateList(list.id, { tab_id: targetTabId });
  };

  // Apply droppable to the main column div with improved behavior
  const { setNodeRef: setDroppableNodeRef, isOver: dndIsOver } = useDroppable({
    id: list.id,
    data: { 
      listId: list.id, 
      type: 'list-column',
      containerId: list.id,
      isListColumn: true,
      acceptsItems: true
    }
  });

  // Update the isOver state when dndIsOver changes
  React.useEffect(() => {
    setIsOver(dndIsOver);
  }, [dndIsOver]);

  // --- Render ---
  return (
    <div 
      className="flex flex-col border-l border-border first:border-l-0 h-full"
      data-list-id={list.id}
      data-is-droppable="true"
    >
      {/* List Title Area - Sticky */}
      <div className="p-2 text-center border-b border-border flex-shrink-0 flex items-center justify-center sticky top-0 bg-card z-10">
        <h3 className="text-xs md:text-sm font-semibold uppercase tracking-wider px-6 truncate min-w-0 flex-1 overflow-x-auto text-ellipsis break-all" title={list.name}>
          {list.name}
        </h3>
        {/* Dropdown Menu Trigger */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRenameList}>
                <Pencil className="mr-2 h-4 w-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMoveToTab} disabled={availableTabs.length === 0}>
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>Move to Tab</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteList}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete List</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Inner container: Becomes the Droppable AND Scrollable area */}
      <div
        ref={setDroppableNodeRef}
        className={`p-2 space-y-1 overflow-y-auto flex-1 ${isOver ? 'bg-primary/5 border-2 border-dashed border-primary/40' : ''} transition-colors duration-200`}
        data-column-id={list.id}
        style={{ 
          minHeight: "200px", // Ensure column has enough height for dropping
          touchAction: "manipulation", // Improve touch handling on mobile
          userSelect: "none" // Prevent text selection during drag
        }}
      >
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          {/* Show active drop indicator */}
          {isOver && todos.length === 0 && (
            <div className="flex items-center justify-center h-12 text-sm text-muted-foreground border-2 border-dashed border-primary/40 rounded bg-primary/5">
              Drop here
            </div>
          )}
          
          {/* Render existing todos directly */}
          {todos.map((todo) => {
            const isEditing = editingTodoId === todo.id;
            const editingValue = editingValues[todo.id] !== undefined ? editingValues[todo.id] : todo.title;
            return (
              <SortableListItem
                key={todo.id}
                id={todo.id}
                listId={list.id}
                todo={todo}
                isEditing={isEditing}
                editingValue={editingValue}
                onEditingValueChange={(value) => {
                  setEditingValues((prev) => ({ ...prev, [todo.id]: value }));
                }}
                onToggleComplete={onToggleComplete}
                onDeleteClick={onDeleteTodo}
                onTextClick={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onUpdateColor={(todo, color) => onUpdateTodo(todo.id, { color_code: color })}
                onToggleHighlight={() => {}} // No-op, not used
              />
            );
          })}

          {/* Always render add input at the end if in add mode */}
          {isAdding && (
            <div
              key={`input-${list.id}`}
              className="flex items-center text-sm p-1.5 border-b border-solid border-border h-8"
            >
              <span className="mr-2 w-4 shrink-0"></span>
              <Input
                ref={addInputRef}
                placeholder="Add a task..."
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                onKeyDown={handleAddInputKeyDown}
                onBlur={handleAddInputBlur}
                className="h-auto p-0 text-sm border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none w-full bg-transparent placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>
          )}

          {/* Render empty lines for padding only if needed */}
          {Array.from({ length: numEmptyLines }).map((_, index) => (
            <div
              key={`empty-${list.id}-${index}`}
              className="text-sm p-1.5 border-b border-solid border-border cursor-text h-8 text-transparent hover:bg-muted/50"
              onClick={() => {
                setIsAdding(true);
                setTimeout(() => addInputRef.current?.focus(), 0);
              }}
            >
              &nbsp;
            </div>
          ))}
        </SortableContext>
      </div>
      
      {/* Rename Dialog */}
      <RenameDialog
        isOpen={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        onConfirm={handleRenameListConfirm}
        title="Rename List"
        label="List Name"
        currentValue={list.name}
        placeholder="Enter new list name"
      />

      {/* Move to Tab Dialog */}
      <MoveToTabDialog
        isOpen={showMoveToTabDialog}
        onClose={() => setShowMoveToTabDialog(false)}
        onConfirm={handleMoveToTabConfirm}
        availableTabs={availableTabs}
        currentListName={list.name}
      />
    </div>
  );
}
