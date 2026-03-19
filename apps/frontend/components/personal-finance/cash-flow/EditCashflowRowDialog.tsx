"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CashflowDBUpdate } from '@/app/personal-finance/services/useCashflow';

// Matches EditingRowData from CashflowMatrixTable.tsx
export interface EditDialogRowData extends Partial<CashflowDBUpdate> {
  originalDescription: string;
  originalDay: string;
  description: string; // Current description for editing
  day: string;         // Current day for editing
  note?: string | null; // Current note for editing
  currentNote?: string | null; // Retained for consistency if needed elsewhere
}

interface EditCashflowRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowData: EditDialogRowData | null;
  onSave: (updatedData: EditDialogRowData) => Promise<void>;
  inputClass?: string; // Optional styling
  loading?: boolean;   // Optional loading state for the save button
}

export const EditCashflowRowDialog: React.FC<EditCashflowRowDialogProps> = ({
  open,
  onOpenChange,
  rowData,
  onSave,
  inputClass = "",
  loading = false,
}) => {
  const [description, setDescription] = useState('');
  const [day, setDay] = useState('');
  const [note, setNote] = useState<string>(''); // Note will be empty string if null/undefined
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rowData) {
      setDescription(rowData.description || '');
      setDay(rowData.day || '');
      setNote(rowData.note || ''); // Ensure note is a string
      setError(null); // Reset error when new row data is loaded
    }
  }, [rowData]);

  const handleSave = async () => {
    if (!rowData) return;
    setError(null);

    const dayNum = parseInt(day);
    if (!description.trim()) {
      setError("Description cannot be empty.");
      return;
    }
    if (!day.trim()) {
      setError("Day cannot be empty.");
      return;
    }
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setError("Invalid Day (must be between 1 and 31).");
      return;
    }

    const updatedData: EditDialogRowData = {
      ...rowData,
      description: description.trim(),
      day: String(dayNum), // Ensure day is a string
      note: note.trim() === '' ? null : note.trim(), // Convert empty string note to null
    };
    await onSave(updatedData);
    // onOpenChange(false); // Parent will control closing on successful save via its state
  };
  
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);


  if (!rowData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
          <DialogDescription>
            Edit the details for '{rowData.originalDescription}' (Day {rowData.originalDay}). 
            Changes will apply to all occurrences of this entry across different months.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right dark:text-gray-300">
              Description
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`col-span-3 ${inputClass} dark:bg-gray-700 dark:text-white dark:border-gray-600`}
              maxLength={100} // Example max length
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="day" className="text-right dark:text-gray-300">
              Day
            </Label>
            <Input
              id="day"
              type="number"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              min={1}
              max={31}
              className={`col-span-3 ${inputClass} dark:bg-gray-700 dark:text-white dark:border-gray-600`}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="note" className="text-right dark:text-gray-300">
              Note
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes for this entry..."
              className={`col-span-3 ${inputClass} dark:bg-gray-700 dark:text-white dark:border-gray-600`}
              rows={3}
              maxLength={255} // Example max length
            />
          </div>
          {error && (
            <p className="col-span-4 text-sm text-red-500 dark:text-red-400 px-1 py-1 rounded-md text-center">{error}</p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
             <Button type="button" variant="outline" onClick={handleClose} className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                Cancel
             </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={loading} className="dark:bg-blue-600 dark:hover:bg-blue-700">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 