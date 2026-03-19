"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { DailyColumn } from '@/components/todo/DailyColumn';
import TabbedTodoView from '@/components/todo/TabbedTodoView';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Import Hooks and Types
import { useTodos, FetchedTodo, TodoPayload, TodoUpdatePayload } from '@/app/todo/services/useTodos';
import { useTodoTabs, FetchedTodoTab, TodoTabPayload, TodoTabUpdatePayload } from '@/app/todo/services/useTodoTabs';
import { useTodoLists, FetchedTodoList, TodoListPayload, TodoListUpdatePayload } from '@/app/todo/services/useTodoLists';
import { BaseTodoItem } from '@/components/todo/BaseTodoItem';

// Import DndKit
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    UniqueIdentifier,
    pointerWithin,
    rectIntersection,
    closestCorners,
    DragMoveEvent,
    DragOverEvent,
    MeasuringStrategy,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

// Skeleton component for the loading state
function TodoPageSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Skeleton Header */}
      <header className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-4">
           <Skeleton className="h-6 w-24" /> {/* Dashboard Link */} 
        </div>
        <div className="flex items-center gap-2">
            {/* Navigation Buttons */} 
           <Skeleton className="h-8 w-8" />
           <Skeleton className="h-8 w-8" />
           <Skeleton className="h-8 w-8" />
           <Skeleton className="h-8 w-8" />
           <Skeleton className="h-8 w-8" />
        </div>
         <Skeleton className="h-9 w-20" /> {/* Sign out button */} 
      </header>

      {/* Skeleton Todo List Area */}
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col border-l border-border first:border-l-0 md:first:border-l">
              {/* Date Header Skeleton */}
              <div className="p-2 text-center border-b border-border h-[65px]"> {/* Approx height */} 
                <Skeleton className="h-4 w-20 mx-auto mb-1" />
                <Skeleton className="h-5 w-16 mx-auto" />
              </div>
              {/* Todo Area Skeleton */} 
              <div className="flex-1 p-2 space-y-2.5"> {/* Adjusted spacing */} 
                 {Array.from({ length: 8 }).map((_, j) => ( // Show a few skeleton lines
                     <Skeleton key={j} className="h-6 w-full" />
                 ))} 
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TodoPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- State lifted from children ---
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [todosByDate, setTodosByDate] = useState<Record<string, FetchedTodo[]>>({}); // dateString -> todos[]
  const [tabs, setTabs] = useState<FetchedTodoTab[]>([]);
  const [lists, setLists] = useState<Record<string, FetchedTodoList[]>>({}); // tabId -> lists[]
  const [todosByList, setTodosByList] = useState<Record<string, FetchedTodo[]>>({}); // listId -> todos[]
  const [activeTabId, setActiveTabId] = useState<string | undefined>(undefined);
  const [isTabbedViewCollapsed, setIsTabbedViewCollapsed] = useState(false);

  // --- State moved from WeeklyTodoList ---
  const [editingDateString, setEditingDateString] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null); // Can be date or list todo
  const [activeInputValue, setActiveInputValue] = useState<string>('');
  const activeInputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- DND State ---
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [draggedItem, setDraggedItem] = useState<FetchedTodo | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'date' | 'list' | null>(null); // To know origin
  const [activeDroppableId, setActiveDroppableId] = useState<UniqueIdentifier | null>(null);

  // --- Hooks ---
  const { fetchTodos, addTodo, updateTodo, deleteTodo, loading: loadingTodos, error: errorTodos } = useTodos();
  const { fetchTodoTabs, addTodoTab, updateTodoTab, deleteTodoTab, loading: loadingTabs, error: errorTabs } = useTodoTabs();
  const { fetchTodoLists, addTodoList, updateTodoList, deleteTodoList, loading: loadingLists, error: errorLists } = useTodoLists();

  const isLoading = loadingUser || loadingTodos || loadingTabs || loadingLists;

  // --- User Auth ---
  useEffect(() => {
    const getUser = async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
      setLoadingUser(false);
    };
    getUser();
  }, [router]);

  // --- Data Fetching ---

  // Calculate week dates so that currentDate is always the 4th column (index 3)
  useEffect(() => {
    // Center currentDate in the 4th column (index 3)
    const dates = Array.from({ length: 7 }).map((_, i) => addDays(currentDate, i - 3));
    setWeekDates(dates);
  }, [currentDate]);

  // Fetch Todos for the current week
  useEffect(() => {
    if (!user || weekDates.length === 0) return;
    const startDate = format(weekDates[0], 'yyyy-MM-dd');
    const endDate = format(weekDates[6], 'yyyy-MM-dd');
    console.log(`Fetching dated todos for week: ${startDate} to ${endDate}`);
    fetchTodos(user.id, { afterDate: startDate, beforeDate: endDate, limit: 500 })
      .then(fetchedData => {
        const byDate: Record<string, FetchedTodo[]> = {};
        weekDates.forEach(date => { byDate[format(date, 'yyyy-MM-dd')] = []; });
        (fetchedData || []).forEach(todo => {
          if (todo.due_date && byDate[todo.due_date]) {
            byDate[todo.due_date].push(todo);
          }
        });
        setTodosByDate(byDate);
        setTodosByDate(Object.fromEntries(Object.entries(byDate).map(([date, todos]) => [date, todos.slice().sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity))])));
      });
  }, [user, weekDates, fetchTodos]);

  // Fetch Tabs
  useEffect(() => {
    if (!user) return;
    console.log("Fetching tabs...");
    fetchTodoTabs(user.id).then(fetchedTabs => {
      if (fetchedTabs) {
        setTabs(fetchedTabs);
        if (fetchedTabs.length > 0 && !activeTabId) {
          setActiveTabId(fetchedTabs[0].id); // Set initial active tab
        }
      }
    });
  }, [user, fetchTodoTabs]);

  // Fetch Lists and their Todos for the active tab
  useEffect(() => {
    if (!user || !activeTabId) return;
    console.log(`Fetching lists for active tab: ${activeTabId}`);
    // Reset todos for the current lists being fetched to avoid stale data briefly showing
    const currentListsInTab = lists[activeTabId] || [];
    const listIdsToClear = currentListsInTab.map(l => l.id);
    setTodosByList(prev => {
        const next = {...prev};
        listIdsToClear.forEach(id => delete next[id]); // Clear out todos for lists in this tab
        return next;
    });

    fetchTodoLists(user.id, { tab_id: activeTabId, limit: 100 }).then(fetchedLists => {
      if (fetchedLists && fetchedLists.length > 0) {
        const sortedLists = fetchedLists; // Keep original order for now
        setLists(prev => ({ ...prev, [activeTabId]: sortedLists }));
        
        // Fetch todos for each list individually
        sortedLists.forEach(list => {
            console.log(`Fetching todos for list: ${list.id}`);
            fetchTodos(user.id, { listId: list.id, limit: 500 }) // Fetch per list
             .then(listTodos => {
                 if (listTodos) {
                    setTodosByList(prevTodos => ({ 
                        ...prevTodos, 
                        [list.id]: listTodos.slice().sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)) // Keep todo sort order
                    }));
                 }
             });
        });

      } else {
         // No lists found for this tab
         setLists(prev => ({ ...prev, [activeTabId]: [] }));
         // Ensure todos for any potentially stale list IDs from this tab are cleared
         setTodosByList(prev => {
            const next = {...prev};
            listIdsToClear.forEach(id => delete next[id]); 
            return next;
        });
      }
    });
  // Depend on activeTabId to refetch when tab changes
  }, [user, activeTabId, fetchTodoLists, fetchTodos]);

  // --- UI Handlers ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  const handlePrevWeek = () => setCurrentDate(prev => subDays(prev, 7));
  const handleNextWeek = () => setCurrentDate(prev => addDays(prev, 7));
  const handlePreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleToday = () => setCurrentDate(new Date());
  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
        setCurrentDate(date);
    }
  };

  // --- CRUD Operation Callbacks (used by handlers below) ---
  const onAddTodo = useCallback(async (payload: TodoPayload) => {
    if (!user) return null;
    console.log("Calling API: addTodo", payload);
    const newTodo = await addTodo({ ...payload, user_id: user.id }); // Use hook
    if (newTodo) {
        // Optimistic update OR rely on hook's potential update mechanism
        console.log("API Success: addTodo", newTodo);
        if (newTodo.due_date) {
            setTodosByDate(prev => {
                const dateTodos = [...(prev[newTodo.due_date!] || []), newTodo];
                // Append new item, assume sort order 0 or max?
                // Let drag end handle final sorting for now.
                return { ...prev, [newTodo.due_date!]: dateTodos };
            });
        } else if (newTodo.list_id) {
            setTodosByList(prev => {
                const listTodos = [...(prev[newTodo.list_id!] || []), newTodo];
                return { ...prev, [newTodo.list_id!]: listTodos };
            });
        }
    }
    return newTodo;
  }, [user, addTodo, setTodosByDate, setTodosByList]);

  const handleWeeklyCancelEdit = useCallback(() => {
    console.log("[handleWeeklyCancelEdit] Cancelling edit state");
    setEditingTodoId(null);
    setEditingDateString(null); // Also reset adding state
    setActiveInputValue('');
    // Clear potential blur timeout from add input
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, [setActiveInputValue, setEditingTodoId, setEditingDateString]);

  const onUpdateTodo = useCallback(async (todoId: string, updatePayload: TodoUpdatePayload) => {
      if (!user) return null;
      console.log(`Calling API: updateTodo ${todoId}`, updatePayload);
      const previousTodosByDate = JSON.parse(JSON.stringify(todosByDate));
      const previousTodosByList = JSON.parse(JSON.stringify(todosByList));
      let originalLocation: { type: 'date' | 'list'; id: string } | null = null;
      let newLocation: { type: 'date' | 'list'; id: string } | null = null;
      let originalIndex = -1;
      let originalItem: FetchedTodo | null = null;
      for (const [date, todos] of Object.entries(todosByDate)) {
          const idx = todos.findIndex(t => t.id === todoId);
          if (idx !== -1) {
              originalLocation = { type: 'date', id: date };
              originalIndex = idx;
              originalItem = todos[idx];
              break;
          }
      }
      if (!originalLocation) {
          for (const [listId, todos] of Object.entries(todosByList)) {
              const idx = todos.findIndex(t => t.id === todoId);
              if (idx !== -1) {
                  originalLocation = { type: 'list', id: listId };
                  originalIndex = idx;
                  originalItem = todos[idx];
                  break;
              }
          }
      }
      if (!originalLocation || !originalItem) {
          console.error("Optimistic Update Error: Original item not found for ID:", todoId);
          return null;
      }
      if (updatePayload.due_date !== undefined && updatePayload.due_date !== null) {
          newLocation = { type: 'date', id: updatePayload.due_date };
      } else if (updatePayload.list_id !== undefined && updatePayload.list_id !== null) {
          newLocation = { type: 'list', id: updatePayload.list_id };
      }
      const clearingDate = updatePayload.due_date === null;
      const clearingList = updatePayload.list_id === null;
      const isMoving = (newLocation && (newLocation.type !== originalLocation.type || newLocation.id !== originalLocation.id)) ||
                       (clearingDate && originalLocation.type === 'date') || 
                       (clearingList && originalLocation.type === 'list');
      const updatedItem = originalItem ? { ...originalItem, ...updatePayload } : null;
      if(!updatedItem) {
          console.error("Optimistic Update Error: Failed to create updatedItem");
          return null; 
      }
      if (isMoving) {
          console.log("Optimistic Update: Moving item", todoId, "from", originalLocation, "to", newLocation || "none");
          if (originalLocation.type === 'date') {
              setTodosByDate(prev => ({
                  ...prev,
                  [originalLocation!.id]: prev[originalLocation!.id]?.filter(t => t.id !== todoId) ?? []
              }));
          } else {
              setTodosByList(prev => ({
                  ...prev,
                  [originalLocation!.id]: prev[originalLocation!.id]?.filter(t => t.id !== todoId) ?? []
              }));
          }
           if (newLocation) { 
               if (newLocation.type === 'date') {
                   setTodosByDate(prev => ({
                       ...prev,
                       [newLocation!.id]: [
                         ...(prev[newLocation!.id]?.filter(t => t.id !== todoId) || []),
                         updatedItem
                       ]
                   }));
               } else {
                   setTodosByList(prev => ({
                       ...prev,
                       [newLocation!.id]: [
                         ...(prev[newLocation!.id]?.filter(t => t.id !== todoId) || []),
                         updatedItem
                       ]
                   }));
               }
           }
      } else {
          console.log("Optimistic Update: Updating item in place", todoId, "in", originalLocation);
          if (originalLocation.type === 'date') {
              setTodosByDate(prev => ({
                  ...prev,
                  [originalLocation!.id]: prev[originalLocation!.id]?.map(t => t.id === todoId ? updatedItem : t) ?? []
              }));
          } else {
              setTodosByList(prev => ({
                  ...prev,
                  [originalLocation!.id]: prev[originalLocation!.id]?.map(t => t.id === todoId ? updatedItem : t) ?? []
              }));
          }
      }
      const apiResult = await updateTodo(todoId, user.id, updatePayload);
      if (!apiResult) {
          console.error("API Failure: updateTodo, reverting.");
          setTodosByDate(previousTodosByDate);
          setTodosByList(previousTodosByList);
          return null;
      }
       console.log("API Success: updateTodo", apiResult);
       // If API successful, optimistic update is likely correct.
       // We might need a re-fetch or more precise state update if API returns
       // significantly different data (e.g., updated sort_order after move)
 
        return apiResult;
  }, [user, updateTodo, todosByDate, todosByList, editingTodoId, handleWeeklyCancelEdit, setEditingTodoId, setEditingDateString, setActiveInputValue, setTodosByDate, setTodosByList]);

  const onDeleteTodo = useCallback(async (todoId: string) => {
      if (!user) return false;
      console.log(`Calling API: deleteTodo ${todoId}`);
      // Store previous state for revert
      const previousTodosByDate = JSON.parse(JSON.stringify(todosByDate));
      const previousTodosByList = JSON.parse(JSON.stringify(todosByList));
      let foundAndRemoved = false;

      // Optimistic Delete
      setTodosByDate(prev => {
          const newState = { ...prev };
          for (const dateKey in newState) {
              const initialLength = newState[dateKey].length;
              newState[dateKey] = newState[dateKey].filter(t => t.id !== todoId);
              if (newState[dateKey].length < initialLength) { foundAndRemoved = true; break; }
          }
          return newState;
      });
      if (!foundAndRemoved) {
         setTodosByList(prev => {
              const newState = { ...prev };
              for (const listId in newState) {
                  const initialLength = newState[listId].length;
                  newState[listId] = newState[listId].filter(t => t.id !== todoId);
                   if (newState[listId].length < initialLength) { foundAndRemoved = true; break; }
              }
              return newState;
         });
      }

      // API Call
      const success = await deleteTodo(todoId, user.id);

      if (!success) {
          console.error("API Failure: deleteTodo, reverting.");
          setTodosByDate(previousTodosByDate);
          setTodosByList(previousTodosByList);
          return false;
      }
      console.log("API Success: deleteTodo", todoId);
      return true;
  }, [user, deleteTodo, todosByDate, todosByList]);

  const onToggleTodoComplete = useCallback(async (todo: FetchedTodo) => {
      console.log(`Toggling complete for todo ${todo.id}`);
      return !!(await onUpdateTodo(todo.id, { is_completed: !todo.is_completed }));
  }, [onUpdateTodo]);

  // --- List CRUD Callbacks ---
  const onAddList = useCallback(async (payload: TodoListPayload) => {
    if (!user || !activeTabId) return null;
    console.log("Calling API: addTodoList", payload);
    const newList = await addTodoList({ ...payload, user_id: user.id }); // Call the hook function
    if (newList) {
        console.log("API Success: addTodoList", newList);
        // Update state optimistically or rely on hook
        setLists(prev => {
            const currentTabLists = prev[activeTabId] || [];
             const updatedLists = [...currentTabLists, newList]; // Append new list
            return { ...prev, [activeTabId]: updatedLists };
        });
        setTodosByList(prev => ({ ...prev, [newList.id]: [] })); // Initialize todos for the new list
    }
    return newList;
  }, [user, activeTabId, addTodoList, setLists, setTodosByList]);

  const onUpdateList = useCallback(async (listId: string, payload: TodoListUpdatePayload) => {
      if (!user || !activeTabId) return null;
       console.log(`Calling API: updateTodoList ${listId}`, payload);
       const previousLists = JSON.parse(JSON.stringify(lists));
       const previousTodosByList = JSON.parse(JSON.stringify(todosByList));

       // Check if this is a move to a different tab
       const isMovingTabs = payload.tab_id && payload.tab_id !== activeTabId;

       if (isMovingTabs) {
           // Remove the list from the current tab immediately
           setLists(prev => ({
               ...prev,
               [activeTabId]: (prev[activeTabId] || []).filter(l => l.id !== listId)
           }));
           // Also remove todos for this list to clean up state
           setTodosByList(prev => {
               const newState = { ...prev };
               delete newState[listId];
               return newState;
           });
       } else {
           // Regular update within the same tab
           setLists(prev => ({
               ...prev,
               [activeTabId]: (prev[activeTabId] || []).map(l =>
                   l.id === listId ? { ...l, ...payload } : l
               )
           }));
       }

      const updatedList = await updateTodoList(listId, user.id, payload);
      if (!updatedList) {
           console.error("API Failure: updateTodoList, reverting.");
           setLists(previousLists);
           setTodosByList(previousTodosByList);
           return null;
       }
       console.log("API Success: updateTodoList", updatedList);
       
       if (isMovingTabs) {
           // For tab moves, the list will appear in the target tab when user switches to it
           // No need to update state here as the fetch logic will handle it
           console.log(`List ${listId} moved to tab ${payload.tab_id}`);
       } else {
           // For regular updates, update the list in place
           setLists(prev => ({
               ...prev,
               [activeTabId]: (prev[activeTabId] || []).map(l =>
                   l.id === listId ? updatedList : l // Use API result
               )
           }));
       }

      return updatedList;
  }, [user, activeTabId, updateTodoList, lists, todosByList, setLists, setTodosByList]);

  const onDeleteList = useCallback(async (listId: string) => {
      if (!user || !activeTabId) return false;
      console.log(`Calling API: deleteTodoList ${listId}`);
       const previousLists = JSON.parse(JSON.stringify(lists));
       const previousTodosByList = JSON.parse(JSON.stringify(todosByList));

       // Optimistic update
       setLists(prev => ({
           ...prev,
           [activeTabId]: (prev[activeTabId] || []).filter(l => l.id !== listId)
       }));
       setTodosByList(prev => {
           const newState = { ...prev };
           delete newState[listId];
           return newState;
       });

      const success = await deleteTodoList(listId, user.id);
      if (!success) {
           console.error("API Failure: deleteTodoList, reverting.");
           setLists(previousLists);
           setTodosByList(previousTodosByList);
          return false;
      }
       console.log("API Success: deleteTodoList", listId);
      return true;
  }, [user, activeTabId, deleteTodoList, lists, todosByList, setLists, setTodosByList]);

  // --- Tab CRUD Callbacks ---
  const onAddTab = useCallback(async (payload: TodoTabPayload) => {
    if (!user) return null;
    console.log("Calling API: addTodoTab", payload);
    const newTab = await addTodoTab({ ...payload, user_id: user.id });
    if (newTab) {
        console.log("API Success: addTodoTab", newTab);
        // Optimistically update tabs state
        setTabs(prev => [...prev, newTab]);
    }
    return newTab;
  }, [user, addTodoTab, setTabs]);

  const onUpdateTab = useCallback(async (tabId: string, payload: TodoTabUpdatePayload) => {
    if(!user) return;
    console.log(`Calling API: updateTodoTab ${tabId}`, payload);
    const previousTabs = JSON.parse(JSON.stringify(tabs));

    // Optimistic
    setTabs(prev => prev.map(t => t.id === tabId ? {...t, ...payload} : t));

    const updatedTab = await updateTodoTab(tabId, user.id, payload);
    if (!updatedTab) {
        console.error("API Failure: updateTodoTab, reverting.");
        setTabs(previousTabs);
        return;
    }
    console.log("API Success: updateTodoTab", updatedTab);
    // Update with API result
    setTabs(prev => prev.map(t => t.id === tabId ? updatedTab : t));

  }, [user, updateTodoTab, tabs, setTabs]);

  const onDeleteTab = useCallback(async (tabId: string) => {
      if (!user) return;
      console.log(`Calling API: deleteTodoTab ${tabId}`);
      const previousTabs = JSON.parse(JSON.stringify(tabs));
      const previousLists = JSON.parse(JSON.stringify(lists));

      // Optimistic
      const deletedTabLists = lists[tabId] || [];
      const listIdsToDelete = deletedTabLists.map(l => l.id);

      setTabs(prev => prev.filter(t => t.id !== tabId));
      setLists(prev => {
          const newState = { ...prev };
          delete newState[tabId];
          return newState;
      });
      // Assume todos associated with lists under the tab will be cascade deleted or handled by backend.
      // If not, they need explicit deletion here.

      if (activeTabId === tabId) {
          setActiveTabId(tabs.filter(t => t.id !== tabId)[0]?.id ?? undefined);
      }

      const success = await deleteTodoTab(tabId, user.id); // Assuming delete hook needs userId
      if (!success) {
           console.error("API Failure: deleteTodoTab, reverting.");
           setTabs(previousTabs);
           setLists(previousLists);
           // Need to revert activeTabId too?
           if (activeTabId === (tabs.filter(t => t.id !== tabId)[0]?.id ?? undefined)) {
               setActiveTabId(tabId); // Revert active tab if it changed due to optimistic delete
           }
          return;
      }
      console.log("API Success: deleteTodoTab", tabId);

  }, [user, deleteTodoTab, tabs, activeTabId, lists, setTabs, setLists, setActiveTabId]); // Dependencies

  // --- Helper Functions ---
  const findListIdForTodo = (todoId: UniqueIdentifier): string | null => {
      for (const listId in todosByList) {
          if (todosByList[listId]?.some(t => t.id === todoId)) {
              return listId;
          }
      }
      return null;
  };

  const findContainer = (id: UniqueIdentifier): string | null => {
      if (!id) return null;
      // Check if ID matches a date string key
      if (todosByDate.hasOwnProperty(id.toString())) {
          return id.toString();
      }
      // Check if ID matches a list ID key
      if (todosByList.hasOwnProperty(id.toString())) {
           return id.toString();
      }
      // Check if ID belongs to a todo within a date column
      for (const dateKey in todosByDate) {
          if (todosByDate[dateKey].some(t => t.id === id)) {
              return dateKey;
          }
      }
      // Check if ID belongs to a todo within a list column
      for (const listId in todosByList) {
          if (todosByList[listId].some(t => t.id === id)) {
              return listId;
          }
      }
      return null;
  };

  // --- State Management Callbacks (for inline edit in Weekly View) ---

  const handleWeeklySubmitEdit = useCallback(async () => {
    console.log("[handleWeeklySubmitEdit] Submitting edit state");
    const taskTitle = activeInputValue.trim();
    let success = false;
    let shouldResetState = true;
    if (user) {
        const currentEditingId = editingTodoId;
        const currentAddingDate = editingDateString;
        if (currentEditingId && !findListIdForTodo(currentEditingId)) {
            // Weekly (date-based) todo
            if (!taskTitle) {
                await onDeleteTodo(currentEditingId);
                success = true;
                shouldResetState = true;
            } else {
                const updated = await onUpdateTodo(currentEditingId, { title: taskTitle });
                success = !!updated;
                shouldResetState = true;
            }
        } else if (currentEditingId && findListIdForTodo(currentEditingId)) {
            // Section/list-based todo
            if (!taskTitle) {
                await onDeleteTodo(currentEditingId);
                success = true;
                shouldResetState = true;
            } else {
                const updated = await onUpdateTodo(currentEditingId, { title: taskTitle });
                success = !!updated;
                shouldResetState = true;
            }
        } else if (currentAddingDate && taskTitle) {
            const payload: TodoPayload = { title: taskTitle, due_date: currentAddingDate, list_id: null, user_id: user.id };
            const added = await onAddTodo(payload);
            success = !!added;
            console.log("[handleWeeklySubmitEdit] Add success:", success);
             if (success) {
                 setActiveInputValue('');
                 shouldResetState = false;
             } else {
                 shouldResetState = true;
             }
        } else {
            console.log("[handleWeeklySubmitEdit] No valid edit/add state, or empty title for add.");
            success = true;
            shouldResetState = true;
        }
    } else {
        console.log("[handleWeeklySubmitEdit] No user found.");
        shouldResetState = true;
    }
    if (shouldResetState) {
        console.log("[handleWeeklySubmitEdit] Resetting edit/add state.");
        setEditingTodoId(null);
        setEditingDateString(null);
        setActiveInputValue('');
    } else {
        console.log("[handleWeeklySubmitEdit] Keeping add mode active, not resetting state.");
    }
    return success;
  }, [activeInputValue, user, editingTodoId, editingDateString, findListIdForTodo, onUpdateTodo, onAddTodo, onDeleteTodo, setActiveInputValue, setEditingTodoId, setEditingDateString]);

  const activateWeeklyEditState = useCallback(async (dateString: string | null, todoToEdit: FetchedTodo | null) => {
      console.log('[activateWeeklyEditState] Setting edit state directly');

      // Auto-save current field before switching if there's an active edit
      if ((editingTodoId || editingDateString) && activeInputValue.trim()) {
          console.log('[activateWeeklyEditState] Auto-saving current field before switching');
          await handleWeeklySubmitEdit();
      } else if (editingTodoId || editingDateString) {
          // Cancel current edit if no content
          console.log('[activateWeeklyEditState] Canceling current empty field before switching');
          handleWeeklyCancelEdit();
      }

      if (todoToEdit) { // Edit existing dated todo
          console.log('[activateWeeklyEditState] Setting state for todo:', todoToEdit.id);
          setEditingTodoId(todoToEdit.id);
          setActiveInputValue(todoToEdit.title);
          setEditingDateString(null);
          requestAnimationFrame(() => activeInputRef.current?.focus()); // Focus input

      } else if (dateString) { // Add new dated todo
          console.log('[activateWeeklyEditState] Setting state for date:', dateString);
          setEditingDateString(dateString);
          setEditingTodoId(null);
          setActiveInputValue('');
           requestAnimationFrame(() => activeInputRef.current?.focus()); // Focus add input
      }
  }, [editingTodoId, editingDateString, activeInputValue, handleWeeklySubmitEdit, handleWeeklyCancelEdit, setActiveInputValue, setEditingDateString, setEditingTodoId]);

  // This now ONLY handles the page-level input state (e.g., for adding new items)
  const handleWeeklyActiveInputChange = (value: string) => {
    setActiveInputValue(value);
  };

  // These handlers are now PRIMARILY for the "Add New" input scenario for DailyColumn
  const handleWeeklyAddInputKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log("[handleWeeklyAddInputKeyDown] Key pressed:", event.key);
    if (event.key === 'Enter') {
      event.preventDefault();
      if (editingDateString) { // Only submit if in add mode
          console.log("[handleWeeklyAddInputKeyDown] Enter pressed in add mode, submitting.");
          await handleWeeklySubmitEdit(); // Will add the item and maybe clear input
      } else {
          console.log("[handleWeeklyAddInputKeyDown] Enter pressed but not in add mode.");
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      console.log("[handleWeeklyAddInputKeyDown] Escape pressed, cancelling edit/add state.");
      handleWeeklyCancelEdit(); // Cancel add mode or any lingering edit state
    }
  };

  const handleWeeklyAddInputBlur = () => {
      // This blur is ONLY for the explicit "Add new todo..." input field in DailyColumn
      console.log("[handleWeeklyAddInputBlur] Add input blurred.");
      // Use a short timeout to allow clicks on other elements (like save button if existed)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(async () => {
          // Check state *inside* the timeout callback, as it might have changed
          const currentAddingDate = editingDateString;

          console.log(`[handleWeeklyAddInputBlur] Timeout triggered. Adding Date: ${currentAddingDate}, Input: "${activeInputValue}"`);

          if (currentAddingDate && activeInputValue.trim()) { // If adding and have text
              console.log("[handleWeeklyAddInputBlur] Submitting add via blur.");
              await handleWeeklySubmitEdit();
          } else if (currentAddingDate) { // If adding but no text, cancel add mode
              console.log("[handleWeeklyAddInputBlur] No text in add input, cancelling add mode.");
              handleWeeklyCancelEdit();
          } else {
              console.log("[handleWeeklyAddInputBlur] Not in add mode, blur ignored.");
          }
          blurTimeoutRef.current = null;
      }, 150);
  };


  // --- DND Setup ---
  const sensors = useSensors(
      useSensor(PointerSensor, {
        // Make drag activation much easier - reduce constraints
        activationConstraint: {
          distance: 1, // Much smaller distance to start drag
          tolerance: 10, // Higher tolerance for better detection
          delay: 0, // No delay
        }
      }), 
      useSensor(KeyboardSensor)
  );

  // Find dragged item data for overlay
  useEffect(() => {
      if (!activeId) { setDraggedItem(null); setDraggedItemType(null); return; }
      let foundItem: FetchedTodo | null = null;
      let foundType: 'date' | 'list' | null = null;
      // Check dated todos
      Object.values(todosByDate).flat().forEach(todo => {
          if (todo.id === activeId) { foundItem = todo; foundType = 'date'; }
      });
      // Check listed todos if not found yet
      if (!foundItem) {
          Object.values(todosByList).flat().forEach(todo => {
              if (todo.id === activeId) { foundItem = todo; foundType = 'list'; }
          });
      }
      setDraggedItem(foundItem);
      setDraggedItemType(foundType);
      console.log(`Dragged Item Found: ID=${activeId}, Type=${foundType}`);
  }, [activeId, todosByDate, todosByList]);

  // --- DND Handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    console.log("Global Drag Start:", event.active.id);
    
    // Find the todo item being dragged to set in the state
    let foundTodo: FetchedTodo | undefined;
    
    // Check in date-based todos
    for (const dateKey in todosByDate) {
      foundTodo = todosByDate[dateKey].find(todo => todo.id === event.active.id);
      if (foundTodo) {
        setDraggedItemType('date');
        break;
      }
    }
    
    // If not found, check in list-based todos
    if (!foundTodo) {
      for (const listId in todosByList) {
        foundTodo = todosByList[listId].find(todo => todo.id === event.active.id);
        if (foundTodo) {
          setDraggedItemType('list');
          break;
        }
      }
    }
    
    // Set the active ID and dragged item
    setActiveId(event.active.id);
    if (foundTodo) {
      setDraggedItem(foundTodo);
    }
    setActiveDroppableId(null);
  };

  // Add drag over handler to update visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveDroppableId(null);
      return;
    }
    
    setActiveDroppableId(over.id);
    
    // Create a clear visualization of where the item will be dropped
    if (active.id !== over.id) {
      // Find what container we're in
      const overContainer = findContainer(over.id);
      
      // If the over item is in a date container, update UI accordingly
      if (overContainer && todosByDate[overContainer]) {
        // Logic for date-based dragging visualization
      }
      
      // If the over item is in a list container, update UI accordingly
      if (overContainer && todosByList[overContainer]) {
        // Logic for list-based dragging visualization
      }
    }
  };

  // Add drag move handler to track which droppable is active
  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event;
    if (over) {
      setActiveDroppableId(over.id);
    } else {
      setActiveDroppableId(null);
    }
  };

  // Use a custom collision detection strategy that prioritizes containers
  const customCollisionDetection = useCallback((args: any) => {
    // First check for droppable containers using rectIntersection (most accurate for column detection)
    const rectCollisions = rectIntersection(args);

    // If we found containers with rectIntersection, use those
    if (rectCollisions.length > 0) {
      // Filter for container droppables first
      const containerCollisions = rectCollisions.filter(
        collision => 
          collision.data?.droppableContainer?.data?.current?.type === 'column' || 
          collision.data?.droppableContainer?.data?.current?.type === 'list-column'
      );
      
      return containerCollisions.length > 0 ? containerCollisions : rectCollisions;
    }
    
    // If no rect collisions, try closestCorners which is better for empty spaces
    return closestCorners(args);
  }, []);

  // Simplified Reorder Todos within a container (Date or List)
  const reorderTodos = (containerId: string, oldIndex: number, newIndex: number) => {
      const isDateContainer = todosByDate.hasOwnProperty(containerId);
      const items = isDateContainer ? todosByDate[containerId] : todosByList[containerId];
      
      if (!items) return; // Should not happen if containerId is valid

      // Get the item being moved
      const itemToMove = items[oldIndex];
      
      // Create a new array with the item moved to the new position
      const reorderedItems = arrayMove(items, oldIndex, newIndex);
      
      // Update state
      if (isDateContainer) {
          setTodosByDate(prev => ({ ...prev, [containerId]: reorderedItems }));
      } else {
          setTodosByList(prev => ({ ...prev, [containerId]: reorderedItems }));
      }

      // Update only the dragged item's sort_order
      console.log(`Updating sort order for ${itemToMove.id} to ${newIndex}`);
      onUpdateTodo(itemToMove.id, { sort_order: newIndex });
  };

  // Improved move todo between containers
  const moveTodo = (sourceContainerId: string, targetContainerId: string, draggedItemId: UniqueIdentifier, targetIndex: number) => {
      const isSourceDate = todosByDate.hasOwnProperty(sourceContainerId);
      const isTargetDate = todosByDate.hasOwnProperty(targetContainerId);
      
      // Make defensive copies of source and target items
      const sourceItems = isSourceDate 
          ? [...todosByDate[sourceContainerId]] 
          : [...todosByList[sourceContainerId]];
          
      const targetItems = isTargetDate 
          ? [...todosByDate[targetContainerId]] 
          : [...todosByList[targetContainerId]];

      // Find the dragged item in the source container
      const draggedItemIndex = sourceItems.findIndex(t => t.id === draggedItemId);
      if (draggedItemIndex === -1) return;

      // Remove the item from the source
      const [draggedItemData] = sourceItems.splice(draggedItemIndex, 1);

      // Create a copy of the item with updated container info
      const movedItem = { ...draggedItemData };
      
      // Update the item with the new container info and sort order
      if (isTargetDate) {
          movedItem.due_date = targetContainerId;
          movedItem.list_id = null;
          movedItem.sort_order = targetIndex;
      } else {
          movedItem.list_id = targetContainerId;
          movedItem.due_date = null;
          movedItem.sort_order = targetIndex;
      }

      // Insert the item at the target position
      targetItems.splice(targetIndex, 0, movedItem);

      // Update the sort_order of all items in the target container
      const updatedTargetItems = targetItems.map((item, index) => ({
          ...item,
          sort_order: index
      }));

      // Update state optimistically
      if (isSourceDate) {
          setTodosByDate(prev => ({ ...prev, [sourceContainerId]: sourceItems }));
      } else {
          setTodosByList(prev => ({ ...prev, [sourceContainerId]: sourceItems }));
      }

      if (isTargetDate) {
          setTodosByDate(prev => ({ ...prev, [targetContainerId]: updatedTargetItems }));
      } else {
          // Ensure no duplicates in the target list
          const uniqueTargetItems = updatedTargetItems.filter((item, index, self) => 
              index === self.findIndex(t => t.id === item.id)
          );
          setTodosByList(prev => ({ ...prev, [targetContainerId]: uniqueTargetItems }));
      }

      // Create API payload with the new container info and sort order
      const apiUpdatePayload = isTargetDate
          ? { due_date: targetContainerId, list_id: null, sort_order: targetIndex }
          : { list_id: targetContainerId, due_date: null, sort_order: targetIndex };

      // Update the item in the API
      console.log(`API Update for moved todo ${draggedItemId}: ${JSON.stringify(apiUpdatePayload)}`);
      onUpdateTodo(draggedItemId as string, apiUpdatePayload);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // If no valid drop target or missing context, just return
    if (!over || !user || !active.id) { 
        console.log("Drag cancelled or invalid context"); 
        // Clear drag state after validation
        setActiveId(null);
        setDraggedItem(null);
        setDraggedItemType(null);
        setActiveDroppableId(null);
        return; 
    }
    
    // Continue with existing drag end logic
    // Use event properties instead of state variables
    const sourceContainerId = findContainer(active.id); 
    let targetContainerId = null;
    let overIsContainer = false;
    
    // Determine target container more accurately
    if (over.data.current?.type === 'column' && typeof over.data.current.date === 'string') {
        // Dropped on a date column
        targetContainerId = over.data.current.date;
        overIsContainer = true;
    } else if (over.data.current?.type === 'list-column' && typeof over.data.current.listId === 'string') {
        // Dropped on a list column
        targetContainerId = over.data.current.listId;
        overIsContainer = true;
    } else {
        // Dropped on an item - find its container
        targetContainerId = findContainer(over.id);
        overIsContainer = over.id === targetContainerId;
    }

    if (!sourceContainerId || !targetContainerId) {
        console.error("DND Error: Could not resolve source or target container.");
        return;
    }

    if (active.id === over.id) {
        console.log("Dropped onto self, no action");
        return;
    }

    const isSourceDate = todosByDate.hasOwnProperty(sourceContainerId);
    const sourceItems = isSourceDate ? todosByDate[sourceContainerId] : todosByList[sourceContainerId];
    const activeIndex = sourceItems.findIndex(t => t.id === active.id);

    if (activeIndex === -1) {
        console.error("Active item not found in source container");
        return;
    }

    // Process the drag operation
    if (sourceContainerId === targetContainerId) {
        // Reordering within the same container
        const isTargetDate = todosByDate.hasOwnProperty(targetContainerId);
        const targetItems = isTargetDate ? todosByDate[targetContainerId] : todosByList[targetContainerId];
        
        let overIndex: number;
        
        // If dropped on another item, find its index
        if (!overIsContainer) {
            overIndex = targetItems.findIndex(t => t.id === over.id);
            if (overIndex === -1) {
                console.log("Target item not found in container, appending to end");
                overIndex = targetItems.length;
            }
        } else {
            // If dropped on the container itself, append to end
            overIndex = targetItems.length;
        }

        // Only reorder if the position actually changed
        if (activeIndex !== overIndex) {
            console.log(`Reordering item ${active.id} in container ${sourceContainerId} from ${activeIndex} to ${overIndex}`);
            reorderTodos(sourceContainerId, activeIndex, overIndex);
        }
    } else {
        // Moving between different containers
        const isTargetDate = todosByDate.hasOwnProperty(targetContainerId);
        const targetItems = isTargetDate ? todosByDate[targetContainerId] : todosByList[targetContainerId];
        
        let targetIndex: number;
        
        // If dropped on an item, place before/after it based on position
        if (!overIsContainer) {
            targetIndex = targetItems.findIndex(t => t.id === over.id);
            if (targetIndex === -1) {
                console.log("Target item not found in container, appending to end");
                targetIndex = targetItems.length;
            }
        } else {
            // If dropped on the container itself, append to end
            targetIndex = targetItems.length;
        }

        console.log(`Moving item ${active.id} from ${sourceContainerId} to ${targetContainerId} at position ${targetIndex}`);
        moveTodo(sourceContainerId, targetContainerId, active.id, targetIndex);
    }
    
    // Clear drag state after processing
    setActiveId(null);
    setDraggedItem(null);
    setDraggedItemType(null);
    setActiveDroppableId(null);
  };


  if (loadingUser) {
    return <TodoPageSkeleton />;
  }

  return (
    <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
    >
        <div className="flex h-screen flex-col bg-background">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-border p-4 gap-4 flex-shrink-0">
            {/* Left: Title (now empty, can add page title later if needed) */} 
            <div className="flex-1">
                {/* Placeholder for potential title */}
            </div>

            {/* Center: Date Navigation Controls */} 
            <div className="flex items-center justify-center gap-1 md:gap-2 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek} aria-label="Previous week">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePreviousDay} aria-label="Previous day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover>
                    <PopoverTrigger asChild>
                       <Button variant="outline" size="icon" aria-label="Select date">
                           <CalendarDays className="h-4 w-4" />
                       </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={currentDate}
                            onSelect={handleCalendarSelect}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" onClick={handleToday} aria-label="Today" className="mx-1">
                    Today
                </Button>

                <Button variant="ghost" size="icon" onClick={handleNextDay} aria-label="Next day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNextWeek} aria-label="Next week">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Right: Actions (Back link and Sign Out) */} 
            <div className="flex items-center gap-4 flex-1 justify-end">
               {/* <Link href="/dashboard" passHref>
                    <Button variant="outline">Back to Dashboard</Button>
                </Link> */} 
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden relative"> 
              {/* Weekly Todo List Area (Render DailyColumn directly) */}
              <div className={`${isTabbedViewCollapsed ? 'flex-1 min-h-0' : 'flex-1'} overflow-y-auto transition-all duration-300 ease-in-out bg-background z-10`}>
                 <div className="grid h-full grid-cols-1 md:grid-cols-7">
                     {weekDates.map((date, index) => {
                         const dateString = format(date, 'yyyy-MM-dd');
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
                                 apiLoading={isLoading}
                                 apiError={errorTodos || errorLists || errorTabs}
                                 handleActiveInputChange={handleWeeklyActiveInputChange}
                                 onSubmitEdit={handleWeeklySubmitEdit}
                                 onCancelEdit={handleWeeklyCancelEdit}
                                 handleAddInputKeyDown={handleWeeklyAddInputKeyDown}
                                 handleAddInputBlur={handleWeeklyAddInputBlur}
                                 activateEditState={activateWeeklyEditState}
                                 handleToggleComplete={onToggleTodoComplete}
                                 handleDeleteClick={onDeleteTodo}
                                 onUpdateColor={(todo, color) => onUpdateTodo(todo.id, { color_code: color })}
                                 onToggleHighlight={() => {}}
                             />
                         );
                     })}
                 </div>
              </div>

              {/* Tabbed List View (Lower Part) */}
              {!isTabbedViewCollapsed && (
                <div className="flex-1 min-h-0 border-t border-border transition-all duration-300 ease-in-out overflow-y-auto">
                   <TabbedTodoView
                      user={user}
                      tabs={tabs}
                      listsByTab={lists}
                      todosByList={todosByList}
                      activeTabId={activeTabId}
                      setActiveTabId={setActiveTabId}
                      isLoading={isLoading}
                      isCollapsed={isTabbedViewCollapsed}
                      setIsCollapsed={setIsTabbedViewCollapsed}
                      onAddTab={onAddTab}
                      onAddList={onAddList}
                      onAddTodo={onAddTodo}
                      onUpdateTodo={onUpdateTodo}
                      onDeleteTodo={onDeleteTodo}
                      onToggleComplete={onToggleTodoComplete}
                      onUpdateList={onUpdateList}
                      onDeleteList={onDeleteList}
                      onUpdateTab={onUpdateTab}
                      onDeleteTab={onDeleteTab}
                      sensors={sensors} 
                      handleDragStart={handleDragStart} 
                      handleDragEnd={handleDragEnd}
                      activeId={activeId}
                      draggedTodo={draggedItem}
                   />
                </div>
              )}

              {/* Expand Lists Button (when collapsed) */}
              {isTabbedViewCollapsed && (
                <button
                  className="fixed left-4 bottom-4 z-50 px-4 py-2 bg-white dark:bg-gray-900 border border-border rounded shadow text-sm text-muted-foreground hover:bg-muted transition"
                  onClick={() => setIsTabbedViewCollapsed(false)}
                >
                  ↑ Expand Lists
                </button>
              )}
          </div>
        </div>

        {/* Improved Drag Overlay for better visibility */}
        <DragOverlay dropAnimation={{
          duration: 150,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
            {activeId && draggedItem ? (
                <div className="opacity-100 shadow-xl border-2 border-primary rounded bg-background z-50">
                    <BaseTodoItem
                        todo={draggedItem}
                        isEditing={false}
                        editingValue={draggedItem.title}
                        onEditingValueChange={() => {}}
                        onToggleComplete={() => {}}
                        onDeleteClick={() => {}}
                        onTextClick={() => {}}
                        onSaveEdit={() => {}}
                        onCancelEdit={() => {}}
                        onUpdateColor={() => {}}
                        onToggleHighlight={() => {}}
                    />
                </div>
            ) : null}
        </DragOverlay>
    </DndContext>
  );
}
