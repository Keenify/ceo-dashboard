# Todo Components Overview

This document explains the purpose and usage of the main files/components in the `components/todo/` directory. Use this as a reference for understanding the structure and responsibilities of each part of the todo feature.

---

## 1. `BaseTodoItem.tsx`

- **Purpose:**
  - Renders a single todo item (title, checkbox, delete button, drag handle).
  - Used for non-drag-and-drop contexts or overlays.
- **Usage:**
  - Receives props for editing, completion, deletion, and drag-and-drop attributes.
  - Used in overlays and as a base for other todo item components.

---

## 2. `DraggableEditableTodoItem.tsx`

- **Purpose:**
  - Renders a single todo item with drag-and-drop and inline editing support.
  - Integrates with dnd-kit for sortable lists.
- **Usage:**
  - Used inside sortable lists (e.g., in `TodoListSection` and `WeeklyTodoList`).
  - Handles both controlled and uncontrolled editing states.

---

## 3. `DailyColumn.tsx`

- **Purpose:**
  - Renders a single day column in the weekly (date-based) todo view.
  - Displays the date header and a vertical list of todos for that day.
- **Usage:**
  - Used by `WeeklyTodoList` to render each day in the 7-day grid.
  - Handles add/edit state for todos on a specific date.

---

## 4. `WeeklyTodoList.tsx`

- **Purpose:**
  - Renders the entire weekly (date-based) todo grid (7 columns, one per day).
  - Manages editing state, add mode, and passes handlers to `DailyColumn`.
- **Usage:**
  - Used in the main todo page to show the top half (date-based todos).
  - Handles drag-and-drop and editing for all date-based todos.

---

## 5. `TodoListSection.tsx`

- **Purpose:**
  - Renders a single list-based todo column (for a specific list in a tab).
  - Displays the list title, todos, and add/edit input.
- **Usage:**
  - Used by `TabbedTodoView` to render each list in the tabbed (list-based) view.
  - Handles drag-and-drop and editing for todos in a specific list.

---

## 6. `TabbedTodoView.tsx`

- **Purpose:**
  - Renders the entire tabbed (list-based) todo view (tabs, lists, and their todos).
  - Manages tabs, lists, and passes handlers to `TodoListSection`.
- **Usage:**
  - Used in the main todo page to show the bottom half (list-based todos).
  - Handles tab switching, list management, and drag-and-drop for lists and their todos.

---

## Relationships

- `WeeklyTodoList` → uses `DailyColumn` → uses `DraggableEditableTodoItem`
- `TabbedTodoView` → uses `TodoListSection` → uses `DraggableEditableTodoItem`
- `BaseTodoItem` is used for overlays and as a base for todo item UI

---

For more details, see the comments in each file or ask the maintainers.
