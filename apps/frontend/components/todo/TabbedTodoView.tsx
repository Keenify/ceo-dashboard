"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTodoTabs, FetchedTodoTab, TodoTabPayload, TodoTabUpdatePayload } from '@/app/todo/services/useTodoTabs';
import { useTodoLists, FetchedTodoList, TodoListPayload, TodoListUpdatePayload } from '@/app/todo/services/useTodoLists';
import { useTodos, FetchedTodo, TodoPayload, TodoUpdatePayload } from '@/app/todo/services/useTodos';
import { Skeleton } from '@/components/ui/skeleton';
import TodoListSection from './TodoListSection';
import { BaseTodoItem } from './BaseTodoItem';
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
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { RenameDialog } from './RenameDialog';

interface TabbedTodoViewProps {
  user: any;
  tabs: FetchedTodoTab[];
  listsByTab: Record<string, FetchedTodoList[]>;
  todosByList: Record<string, FetchedTodo[]>;
  activeTabId: string | undefined;
  setActiveTabId: (tabId: string | undefined) => void;
  isLoading: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  onAddTab: (payload: TodoTabPayload) => Promise<FetchedTodoTab | null>;
  onAddList: (payload: TodoListPayload) => Promise<FetchedTodoList | null>;
  onAddTodo: (payload: TodoPayload) => Promise<FetchedTodo | null>;
  onUpdateTodo: (todoId: string, payload: TodoUpdatePayload) => Promise<FetchedTodo | null>;
  onDeleteTodo: (todoId: string) => Promise<boolean>;
  onToggleComplete: (todo: FetchedTodo) => Promise<boolean>;
  onUpdateList: (listId: string, payload: TodoListUpdatePayload) => Promise<FetchedTodoList | null>;
  onDeleteList: (listId: string) => Promise<boolean>;
  sensors?: ReturnType<typeof useSensors>;
  handleDragStart?: (event: DragStartEvent) => void;
  handleDragEnd?: (event: DragEndEvent) => void;
  activeId?: UniqueIdentifier | null;
  draggedTodo?: FetchedTodo | null;
  onUpdateTab: (tabId: string, payload: TodoTabUpdatePayload) => Promise<void>;
  onDeleteTab: (tabId: string) => Promise<void>;
}

function TabbedViewSkeleton() {
    // Simplified skeleton for horizontal layout
    return (
        <div className="border-t border-border p-4">
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-20" /> {/* Collapse button */} 
                <Skeleton className="h-9 w-24" /> {/* Add List button */} 
            </div>
            {/* Tabs Skeleton */} 
            <div className="flex items-center border-b border-border mb-4">
                <Skeleton className="h-10 w-24 mr-2" />
                <Skeleton className="h-10 w-24 mr-2" />
                <Skeleton className="h-10 w-24 mr-2" />
                <Skeleton className="h-6 w-6" /> {/* Add Tab button */} 
            </div>
            {/* Horizontal List Area Skeleton */} 
            <div className="flex space-x-4 overflow-x-auto pb-4">
                {/* Skeleton for a few list columns */} 
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-64 border border-border rounded p-2 space-y-2 bg-muted/40">
                         <Skeleton className="h-5 w-1/2 mb-2" /> {/* List title */} 
                         <Skeleton className="h-6 w-full" />
                         <Skeleton className="h-6 w-full" />
                         <Skeleton className="h-6 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function TabbedTodoView({
    user,
    tabs,
    listsByTab,
    todosByList,
    activeTabId,
    setActiveTabId,
    isLoading,
    isCollapsed,
    setIsCollapsed,
    onAddTab,
    onAddList,
    onAddTodo,
    onUpdateTodo,
    onDeleteTodo,
    onToggleComplete,
    onUpdateList,
    onDeleteList,
    sensors,
    handleDragStart,
    handleDragEnd,
    activeId,
    draggedTodo,
    onUpdateTab,
    onDeleteTab,
 }: TabbedTodoViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Dialog states
  const [showAddTabDialog, setShowAddTabDialog] = useState(false);
  const [showAddListDialog, setShowAddListDialog] = useState(false);
  const [showRenameTabDialog, setShowRenameTabDialog] = useState(false);
  const [currentTabForRename, setCurrentTabForRename] = useState<{ id: string; name: string } | null>(null);

  const handleAddTabClick = () => {
    setShowAddTabDialog(true);
  };

  const handleAddTabConfirm = async (tabName: string) => {
    if (user) {
      const payload: TodoTabPayload = { name: tabName, user_id: user.id };
      const addedTab = await onAddTab(payload);
      if (addedTab) {
        setActiveTabId(addedTab.id);
      }
    }
  };

  const handleAddListClick = () => {
    if (!activeTabId) return;
    setShowAddListDialog(true);
  };

  const handleAddListConfirm = async (listName: string) => {
    if (activeTabId && user) {
      const payload: TodoListPayload = { name: listName, user_id: user.id, tab_id: activeTabId };
      await onAddList(payload);
    }
  };

  const handleAddTodoToList = useCallback(async (payload: Omit<TodoPayload, 'user_id'>) => {
    if (!user) return null;
    return onAddTodo({ ...payload, user_id: user.id });
  }, [user, onAddTodo]);

  // --- Tab Action Handlers --- 
  const handleRenameTab = (tabId: string, currentName: string) => {
    setCurrentTabForRename({ id: tabId, name: currentName });
    setShowRenameTabDialog(true);
  };

  const handleRenameTabConfirm = async (newName: string) => {
    if (currentTabForRename) {
      await onUpdateTab(currentTabForRename.id, { name: newName });
    }
  };

  const handleDeleteTab = (tabId: string, tabName: string) => {
       if (confirm(`Are you sure you want to delete the tab "${tabName}" and all its lists/tasks? This cannot be undone.`)) {
          onDeleteTab(tabId);
      }
  };

  // Scroll handlers
  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8; // Scroll by 80% of visible width
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (isLoading && tabs.length === 0) {
      return <TabbedViewSkeleton />;
  }

  const currentLists = activeTabId ? listsByTab[activeTabId] || [] : [];

  return (
    <div className={`border-t border-border transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-16 overflow-hidden' : ''}`}>
        <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(!isCollapsed)} className="text-muted-foreground">
              {isCollapsed ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isCollapsed ? 'Expand Lists' : 'Collapse Lists'}
            </Button>
        </div>

        {!isCollapsed && (
            <Tabs value={activeTabId} onValueChange={setActiveTabId} className="p-4 pt-0 flex flex-col h-full">
                {/* Tab List and Scroll Controls */}
                <div className="flex items-center mb-4 flex-shrink-0">
                   <TabsList className="flex-grow overflow-x-hidden">
                       {/* Map tabs with dropdown */} 
                       {tabs.map(tab => (
                          <div key={tab.id} className="relative group">
                             <TabsTrigger value={tab.id} className="pr-8 truncate min-w-0 flex-1 overflow-x-auto text-ellipsis text-xs md:text-sm break-all" title={tab.name}>{tab.name}</TabsTrigger>
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                         <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                         </Button>
                                     </DropdownMenuTrigger>
                                     <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleRenameTab(tab.id, tab.name)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            <span>Rename Tab</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteTab(tab.id, tab.name)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash className="mr-2 h-4 w-4" />
                                            <span>Delete Tab</span>
                                        </DropdownMenuItem>
                                     </DropdownMenuContent>
                                 </DropdownMenu>
                             </div>
                          </div>
                       ))}
                       {/* Add Tab Button */} 
                      <Button variant="ghost" size="icon" onClick={handleAddTabClick} className="ml-2 h-8 w-8 flex-shrink-0" disabled={isLoading}>
                          <Plus className="h-4 w-4" />
                      </Button>

                      {/* Scroll Buttons */}
                       <div className="flex items-center ml-auto pl-2">
                         <Button variant="ghost" size="icon" onClick={() => handleScroll('left')} className="h-8 w-8">
                           <ChevronLeft className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleScroll('right')} className="h-8 w-8">
                           <ChevronRight className="h-4 w-4" />
                         </Button>
                       </div>

                   </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                     {activeTabId && (
                        <TabsContent 
                            value={activeTabId} 
                            className="mt-0 outline-none h-full"
                            data-orientation="horizontal"
                        > 
                           {/* Conditionally apply overflow-x-auto based on list presence */}
                           <div 
                               className={`h-full pb-4 ${currentLists.length > 0 ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
                               ref={scrollContainerRef}
                           >
                                {/* Use grid layout for horizontal scrolling lists, matching weekly view */}
                               <div className="grid grid-flow-col auto-cols-[300px]"> 
                                     {currentLists.map((list, index) => (
                                         <TodoListSection 
                                             key={list.id}
                                             user={user}
                                             list={list}
                                             todos={todosByList[list.id] || []}
                                             availableTabs={tabs.filter(tab => tab.id !== activeTabId).map(tab => ({ id: tab.id, name: tab.name }))}
                                             onAddTodo={handleAddTodoToList}
                                             onUpdateTodo={onUpdateTodo}
                                             onDeleteTodo={onDeleteTodo}
                                             onToggleComplete={onToggleComplete}
                                             onUpdateList={onUpdateList}
                                             onDeleteList={onDeleteList}
                                             onUpdateColor={(todo, color) => onUpdateTodo(todo.id, { color_code: color })}
                                             columnIndex={index}
                                         />
                                     ))}
                                     
                                     {/* Add New List Placeholder Column - It will naturally take grid column width */} 
                                     <div 
                                         className="flex flex-col border-l border-border first:border-l-0 h-full p-2 group hover:bg-muted/50 transition-colors min-h-[200px]"
                                     >
                                         {/* Button positioned near top, subtle styling */}
                                         <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={handleAddListClick} 
                                            className="w-auto justify-start text-muted-foreground group-hover:text-primary p-1 h-auto self-start" 
                                         >
                                             <Plus className="h-4 w-4 mr-1" /> New List
                                         </Button>
                                         {/* Rest of the column is implicitly empty */} 
                                      </div>

                                     {isLoading && currentLists.length === 0 && (
                                         <div className="text-muted-foreground text-center p-4 col-span-7">Loading lists...</div> 
                                     )} 
                                     {!isLoading && currentLists.length === 0 && (
                                         <div className="text-muted-foreground text-center p-4 col-span-7">No lists in this tab. Add one!</div>
                                     )}
                                 </div>
                           </div>
                        </TabsContent>
                    )}
                     {!activeTabId && tabs.length > 0 && (
                        <p className="text-muted-foreground text-center py-4">Select a tab.</p>
                    )}
                     {!activeTabId && tabs.length === 0 && !isLoading && (
                        <p className="text-muted-foreground text-center py-4">No tabs found. Add one to get started!</p>
                    )}
                </div>
            </Tabs>
        )}
        
        {/* Rename Dialogs */}
        <RenameDialog
          isOpen={showAddTabDialog}
          onClose={() => setShowAddTabDialog(false)}
          onConfirm={handleAddTabConfirm}
          title="Add New Tab"
          label="Tab Name"
          placeholder="Enter tab name"
        />
        
        <RenameDialog
          isOpen={showAddListDialog}
          onClose={() => setShowAddListDialog(false)}
          onConfirm={handleAddListConfirm}
          title="Add New List"
          label="List Name"
          placeholder="Enter list name"
        />
        
        <RenameDialog
          isOpen={showRenameTabDialog}
          onClose={() => {
            setShowRenameTabDialog(false);
            setCurrentTabForRename(null);
          }}
          onConfirm={handleRenameTabConfirm}
          title="Rename Tab"
          label="Tab Name"
          currentValue={currentTabForRename?.name}
          placeholder="Enter new tab name"
        />
    </div>
  );
} 