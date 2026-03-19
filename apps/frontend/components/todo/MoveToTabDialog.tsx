"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

interface MoveToTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetTabId: string) => Promise<void>;
  availableTabs: { id: string; name: string }[];
  currentListName: string;
}

export function MoveToTabDialog({
  isOpen,
  onClose,
  onConfirm,
  availableTabs,
  currentListName,
}: MoveToTabDialogProps) {
  const [selectedTabId, setSelectedTabId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedTabId) {
      toast.error('Please select a destination tab first.', {
        duration: 3000,
      });
      return;
    }
    
    const selectedTab = availableTabs.find(tab => tab.id === selectedTabId);
    const targetTabName = selectedTab?.name || 'Unknown Tab';
    
    setIsMoving(true);
    try {
      await onConfirm(selectedTabId);
      toast.success(`Successfully moved "${currentListName}" to ${targetTabName}!`, {
        duration: 4000,
      });
      onClose();
      setSelectedTabId('');
    } catch (error) {
      console.error('Failed to move list:', error);
      toast.error(`Failed to move "${currentListName}" to ${targetTabName}. Please try again.`, {
        duration: 5000,
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedTabId('');
  };

  const selectedTab = availableTabs.find(tab => tab.id === selectedTabId);

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Move List to Tab
          </DialogTitle>
          <DialogDescription>
            Choose the destination tab for your "{currentListName}" list.
          </DialogDescription>
        </DialogHeader>
        
        {/* Visual Move Preview */}
        <div className="py-4">
          <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-md shadow-sm">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{currentListName}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md">
              <Folder className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-primary">
                {selectedTab ? selectedTab.name : 'Select Tab'}
              </span>
            </div>
          </div>

          {/* Tab Selection Grid */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Available Tabs:</label>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {availableTabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setSelectedTabId(tab.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5",
                    selectedTabId === tab.id 
                      ? "border-primary bg-primary/10 shadow-sm" 
                      : "border-border"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 transition-colors",
                    selectedTabId === tab.id 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground"
                  )}>
                    {selectedTabId === tab.id && (
                      <div className="w-full h-full rounded-full bg-white scale-50" />
                    )}
                  </div>
                  <Folder className={cn(
                    "h-4 w-4",
                    selectedTabId === tab.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium",
                    selectedTabId === tab.id ? "text-primary" : "text-foreground"
                  )}>
                    {tab.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedTabId || isMoving}
            className="min-w-[100px]"
          >
            {isMoving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Moving...
              </div>
            ) : (
              'Move List'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 