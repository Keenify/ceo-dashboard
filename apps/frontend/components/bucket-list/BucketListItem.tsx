"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import { FetchedBucketListItem } from '@/app/bucket-list/services/useBucketListItems';

interface BucketListItemProps {
  bucketListItem: FetchedBucketListItem;
  onUpdate: (itemId: string, updates: { category?: string; items?: { text: string; completed: boolean }[] }) => void;
  onDelete: (itemId: string) => void;
}

interface BucketItem {
  id: string;
  text: string;
  completed: boolean;
}

export function BucketListItem({ bucketListItem, onUpdate, onDelete }: BucketListItemProps) {
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryValue, setCategoryValue] = useState(bucketListItem.category);
  const [items, setItems] = useState<BucketItem[]>(() => {
    // Convert the backend items to our internal format with IDs
    return bucketListItem.items.map((item: any, index: number) => ({
      id: `item-${index}`,
      text: item.text,
      completed: item.completed
    }));
  });
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  
  const categoryInputRef = useRef<HTMLTextAreaElement>(null);
  const newItemInputRef = useRef<HTMLTextAreaElement>(null);
  const editingItemRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea function
  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  useEffect(() => {
    if (isEditingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
      autoResizeTextarea(categoryInputRef.current);
    }
  }, [isEditingCategory]);

  // Auto-resize editing textarea when entering edit mode
  useEffect(() => {
    if (editingItemId && editingItemRef.current) {
      // Small delay to ensure textarea is rendered with content
      setTimeout(() => {
        if (editingItemRef.current) {
          autoResizeTextarea(editingItemRef.current);
        }
      }, 10);
    }
  }, [editingItemId, editingItemText]);

  const handleCategoryEdit = () => {
    setIsEditingCategory(true);
  };

  const handleCategorySave = () => {
    if (categoryValue.trim() && categoryValue !== bucketListItem.category) {
      onUpdate(bucketListItem.id, { category: categoryValue.trim() });
    }
    setIsEditingCategory(false);
  };

  const handleCategoryCancel = () => {
    setCategoryValue(bucketListItem.category);
    setIsEditingCategory(false);
  };

  const updateItemsInBackend = (updatedItems: BucketItem[]) => {
    // Convert to new backend format: array of {text, completed} objects
    const backendItems = updatedItems.map(item => ({
      text: item.text,
      completed: item.completed
    }));
    
    onUpdate(bucketListItem.id, {
      items: backendItems
    });
  };

  const handleItemToggle = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setItems(updatedItems);
    updateItemsInBackend(updatedItems);
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      const newItem: BucketItem = {
        id: `item-${Date.now()}`,
        text: newItemText.trim(),
        completed: false
      };
      const updatedItems = [...items, newItem];
      setItems(updatedItems);
      setNewItemText('');
      updateItemsInBackend(updatedItems);
      
      // Reset textarea height to original size
      if (newItemInputRef.current) {
        newItemInputRef.current.style.height = 'auto';
        newItemInputRef.current.rows = 1;
      }
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    updateItemsInBackend(updatedItems);
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find(item => item.id === itemId);
    if (item) {
      setEditingItemId(itemId);
      setEditingItemText(item.text);
    }
  };

  const handleSaveItemEdit = () => {
    if (editingItemText.trim() && editingItemId) {
      const updatedItems = items.map(item =>
        item.id === editingItemId ? { ...item, text: editingItemText.trim() } : item
      );
      setItems(updatedItems);
      updateItemsInBackend(updatedItems);
      setEditingItemId(null);
      setEditingItemText('');
    }
  };

  const handleCancelItemEdit = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  return (
    <Card className="w-full max-w-md group border border-gray-200 shadow-sm">
      <CardHeader className="pb-2 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {isEditingCategory ? (
            <div className="flex items-center gap-2 flex-1">
              <Textarea
                ref={categoryInputRef}
                value={categoryValue}
                onChange={(e) => {
                  setCategoryValue(e.target.value);
                  autoResizeTextarea(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCategorySave();
                  }
                  if (e.key === 'Escape') handleCategoryCancel();
                }}
                onBlur={handleCategorySave}
                className="text-lg font-semibold resize-none overflow-hidden flex-1"
                style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                rows={1}
              />
              <Button size="sm" variant="ghost" onClick={handleCategorySave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCategoryCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h3 
              className="text-lg font-semibold cursor-pointer hover:text-primary flex-1"
              onClick={handleCategoryEdit}
            >
              {bucketListItem.category}
            </h3>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" onClick={handleCategoryEdit} className="p-1">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDelete(bucketListItem.id)}
              className="text-destructive hover:text-destructive p-1"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Fixed height scrollable container for bucket list items */}
        <div 
          className="h-[400px] overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db #f3f4f6'
          }}
        >
          <div className="p-3 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 group">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleItemToggle(item.id)}
                  className="shrink-0 mt-1"
                />
                {editingItemId === item.id ? (
                  <div className="flex items-start gap-2 flex-1">
                    <Textarea
                      ref={editingItemRef}
                      value={editingItemText}
                      onChange={(e) => {
                        setEditingItemText(e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveItemEdit();
                        }
                        if (e.key === 'Escape') handleCancelItemEdit();
                      }}
                      onBlur={handleSaveItemEdit}
                      className="text-sm resize-none overflow-hidden flex-1"
                      style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                      rows={1}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveItemEdit}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelItemEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span 
                      className={`flex-1 cursor-pointer text-sm break-words ${
                        item.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                      style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                      onClick={() => handleEditItem(item.id)}
                    >
                      {item.text}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleEditItem(item.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Add new item section - stays at bottom outside scrollable area */}
        <div className="p-3 border-t border-gray-200 bg-gray-100">
          <div className="flex items-start gap-2">
            <Textarea
              ref={newItemInputRef}
              placeholder="Add new item..."
              value={newItemText}
              onChange={(e) => {
                setNewItemText(e.target.value);
                autoResizeTextarea(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              className="text-sm resize-none overflow-hidden flex-1"
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              rows={1}
            />
            <Button 
              size="sm" 
              onClick={handleAddItem}
              disabled={!newItemText.trim()}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 