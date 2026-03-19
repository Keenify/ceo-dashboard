"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import { BucketListItem } from './BucketListItem';
import { useBucketListItems, FetchedBucketListItem } from '@/app/bucket-list/services/useBucketListItems';
import { toast } from 'sonner';

interface BucketListManagerProps {
  userId: string;
}

const DEFAULT_BUCKETS = [
  'Possessions To Obtain',
  'Objectives To Achieve',
  'Skills To Learn',
  'Things To Do',
  'Places To Go',
  'Contributions To Society'
];

export function BucketListManager({ userId }: BucketListManagerProps) {
  const [bucketListItems, setBucketListItems] = useState<FetchedBucketListItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false);
  const defaultsCreatedRef = useRef(false);
  
  const {
    createBucketListItem,
    fetchUserBucketListItems,
    updateBucketListItem,
    deleteBucketListItem,
    reorderBucketListItems,
    loading,
    error
  } = useBucketListItems();

  const createDefaultBuckets = useCallback(async () => {
    if (isCreatingDefaults || defaultsCreatedRef.current) {
      return;
    }
    
    defaultsCreatedRef.current = true;
    setIsCreatingDefaults(true);
    
    try {
      const createdBuckets: FetchedBucketListItem[] = [];
      const failedBuckets: string[] = [];
      
      console.log(`Creating ${DEFAULT_BUCKETS.length} default buckets...`);
      
      for (let i = 0; i < DEFAULT_BUCKETS.length; i++) {
        const bucketName = DEFAULT_BUCKETS[i];
        try {
          console.log(`Creating bucket: "${bucketName}" with sort_order: ${i}`);
          const newItem = await createBucketListItem({
            category: bucketName,
            items: [],
            sort_order: i // Sequential: 0, 1, 2, 3, 4, 5
          }, userId);
          
          if (newItem) {
            createdBuckets.push(newItem);
            console.log(`✅ Successfully created: "${bucketName}"`);
          } else {
            failedBuckets.push(bucketName);
            console.error(`❌ Failed to create (no response): "${bucketName}"`);
          }
        } catch (bucketError) {
          failedBuckets.push(bucketName);
          console.error(`❌ Failed to create: "${bucketName}"`, bucketError);
        }
      }
      
      console.log(`Created ${createdBuckets.length}/${DEFAULT_BUCKETS.length} buckets`);
      if (failedBuckets.length > 0) {
        console.error('Failed buckets:', failedBuckets);
      }
      
      if (createdBuckets.length > 0) {
        setBucketListItems(createdBuckets);
        const message = failedBuckets.length > 0 
          ? `Created ${createdBuckets.length}/${DEFAULT_BUCKETS.length} default buckets. Some failed to create.`
          : `Welcome! Created all ${createdBuckets.length} default buckets for you.`;
        toast.success(message);
        
        if (failedBuckets.length > 0) {
          toast.error(`Failed to create: ${failedBuckets.join(', ')}`);
        }
      }
    } catch (err) {
      console.error('Error creating default buckets:', err);
      toast.error('Failed to create default buckets');
      defaultsCreatedRef.current = false; // Reset on error
    } finally {
      setIsCreatingDefaults(false);
    }
  }, [userId, createBucketListItem, isCreatingDefaults]);

  const loadBucketListItems = useCallback(async () => {
    const items = await fetchUserBucketListItems(userId);
    
    if (items) {
      // Sort by sort_order instead of alphabetically
      const sortedItems = items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setBucketListItems(sortedItems);
      
      // If user has no buckets, create default ones
      if (items.length === 0 && !defaultsCreatedRef.current) {
        await createDefaultBuckets();
      }
    } else if (error) {
      toast.error('Failed to load bucket list items');
    }
  }, [userId, fetchUserBucketListItems, error, createDefaultBuckets]);

  // Load bucket list items on component mount
  useEffect(() => {
    if (userId) {
      loadBucketListItems();
    }
  }, [userId, loadBucketListItems]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    // Calculate the next sort_order (append to end: max + 1)
    const nextSortOrder = bucketListItems.length > 0 
      ? Math.max(...bucketListItems.map(item => item.sort_order ?? 0)) + 1
      : 0;

    console.log('🔢 Creating new bucket with sort_order:', nextSortOrder);
    console.log('📊 Current buckets sort_orders:', bucketListItems.map(item => ({ id: item.id, sort_order: item.sort_order })));

    const newItem = await createBucketListItem({
      category: newCategoryName.trim(),
      items: [],
      sort_order: nextSortOrder
    }, userId);

    if (newItem) {
      // Add the new item to the end (it has the highest sort_order)
      setBucketListItems(prev => {
        const updated = [...prev, newItem];
        return updated.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
      setNewCategoryName('');
      setIsAddingCategory(false);
      toast.success(`New bucket added at position ${nextSortOrder + 1}!`);
      console.log('✅ New bucket created successfully with sort_order:', newItem.sort_order);
    } else {
      toast.error('Failed to add bucket');
    }
  };

  const handleUpdateItem = async (itemId: string, updates: { category?: string; items?: { text: string; completed: boolean }[] }) => {
    const updatedItem = await updateBucketListItem(itemId, userId, updates);
    
    if (updatedItem) {
      setBucketListItems(prev => {
        const updated = prev.map(item => item.id === itemId ? updatedItem : item);
        return updated.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
      toast.success('Updated successfully!');
    } else {
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const success = await deleteBucketListItem(itemId, userId);
    
    if (success) {
      setBucketListItems(prev => prev.filter(item => item.id !== itemId));
      toast.success('Bucket deleted!');
    } else {
      toast.error('Failed to delete bucket');
    }
  };

  const handleCancelAddCategory = () => {
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    // Don't allow reordering if the position hasn't changed
    if (result.source.index === result.destination.index) return;

    // Store original items for potential revert
    const originalItems = [...bucketListItems];

    // Create a copy of the current items
    const reorderedItems = Array.from(bucketListItems);
    
    // Remove the dragged item from its original position
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    
    // Insert it at the new position
    reorderedItems.splice(result.destination.index, 0, movedItem);
    
    // Update the local state optimistically
    setBucketListItems(reorderedItems);
    
    try {
      // Prepare the bucket positions for the API (complete resequencing: 0,1,2,3...)
      const bucketPositions = reorderedItems.map((item, index) => ({
        bucket_id: item.id,
        sort_order: index // Complete resequencing: 0, 1, 2, 3...
      }));
      
      console.log('🔄 Attempting to reorder buckets with complete resequencing:');
      console.log('📊 Before drag:', originalItems.map((item, index) => ({ 
        visual_index: index, 
        category: item.category, 
        sort_order: item.sort_order 
      })));
      console.log('📊 After drag:', bucketPositions.map((pos, index) => ({ 
        visual_index: index, 
        bucket_id: pos.bucket_id, 
        new_sort_order: pos.sort_order 
      })));
      console.log('🔗 API payload:', { userId, bucketPositions, totalBuckets: bucketPositions.length });
      
      // Call the reorder API
      const updatedItems = await reorderBucketListItems(userId, bucketPositions);
      
      console.log('📦 Reorder API response:', updatedItems);
      
      if (updatedItems) {
        // Sort the returned items by sort_order and update state
        const sortedUpdatedItems = updatedItems.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setBucketListItems(sortedUpdatedItems);
        console.log('✅ Reorder successful - new sort_orders:', sortedUpdatedItems.map(item => ({ 
          category: item.category, 
          sort_order: item.sort_order 
        })));
        toast.success('Buckets reordered successfully! New sequence applied.');
      } else {
        // Revert the optimistic update if the API call failed
        console.error('❌ Reorder API returned null/undefined');
        setBucketListItems(originalItems);
        toast.error('Failed to reorder buckets - API returned no data');
      }
    } catch (error) {
      // Revert the optimistic update if there was an error
      console.error('❌ Error reordering buckets:', error);
      setBucketListItems(originalItems);
      toast.error(`Failed to reorder buckets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Auto-resize textarea function
  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  if ((loading && bucketListItems.length === 0) || isCreatingDefaults) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">
          {isCreatingDefaults ? 'Setting up your buckets...' : 'Loading bucket list...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Bucket List</h1>
        {!isAddingCategory && (
          <Button onClick={() => setIsAddingCategory(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bucket
          </Button>
        )}
      </div>

      {/* Add new category form */}
      {isAddingCategory && (
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Enter bucket name..."
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  autoResizeTextarea(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddCategory();
                  }
                  if (e.key === 'Escape') handleCancelAddCategory();
                }}
                className="resize-none overflow-hidden flex-1"
                style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                rows={1}
                autoFocus
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim() || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Bucket
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancelAddCategory}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bucket list items grid with drag and drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="bucket-grid" direction="horizontal">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${
                snapshot.isDraggingOver ? 'bg-muted/20 rounded-lg' : ''
              }`}
            >
              {bucketListItems.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.8 : 1,
                        transform: snapshot.isDragging 
                          ? `${provided.draggableProps.style?.transform} rotate(5deg)` 
                          : provided.draggableProps.style?.transform,
                      }}
                      className={`transition-all duration-200 ${
                        snapshot.isDragging ? 'shadow-xl z-50' : ''
                      }`}
                    >
                      <BucketListItem
                        bucketListItem={item}
                        onUpdate={handleUpdateItem}
                        onDelete={handleDeleteItem}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Empty state */}
      {bucketListItems.length === 0 && !isAddingCategory && !isCreatingDefaults && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <p className="text-lg">No bucket list buckets yet!</p>
            <p>Start by adding your first bucket.</p>
          </div>
          <Button onClick={() => setIsAddingCategory(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Bucket
          </Button>
        </div>
      )}
    </div>
  );
} 