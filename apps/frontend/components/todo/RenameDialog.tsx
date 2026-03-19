"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  title: string;
  label: string;
  currentValue?: string;
  placeholder?: string;
}

export function RenameDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  label,
  currentValue = '',
  placeholder = ''
}: RenameDialogProps) {
  const [value, setValue] = useState(currentValue);

  // Reset value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(currentValue);
    }
  }, [isOpen, currentValue]);

  const handleConfirm = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && trimmedValue !== currentValue) {
      onConfirm(trimmedValue);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {label}
            </Label>
            <Input
              id="name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="col-span-3"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!value.trim() || value.trim() === currentValue}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 