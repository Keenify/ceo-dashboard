"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { DatePicker } from '@/components/ui/date-picker'; // Assuming you have a DatePicker
// import { NetworthDBInsert } from '@/app/personal-finance/services/useNetworth'; // Placeholder

// Placeholder for the type that will be passed to onAddEntry callback
export interface NewNetworthEntryData {
    user_id: string;
    type: "personal" | "business";
    category: "asset" | "liability";
    snapshot_date: string; // YYYY-MM-DD
    section: string;
    name: string; // Required field
    value: number; // Required field
}

// Type for existing section-item combinations
export interface ExistingSectionItemCombinations {
    [sectionName: string]: string[]; // section name -> array of item names in that section
}

// Type for existing entries with date information
export interface ExistingEntryWithDate {
    section: string;
    name: string;
    snapshot_date: string; // YYYY-MM-DD format
}

interface AddNetworthEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    entryType: "personal" | "business";
    entryCategory: "asset" | "liability";
    // onAddEntry: (payload: NetworthDBInsert) => Promise<boolean>; // Placeholder for actual API call
    onAddEntry: (payload: NewNetworthEntryData) => Promise<boolean>; // Using placeholder type for now
    loading: boolean; // Parent can pass loading state if API call is made in parent
    inputClass?: string;
    existingSections: string[]; // Added
    existingItemNames: string[]; // Added (can be all item names, or filtered by section in parent if needed)
    existingSectionItemCombinations: ExistingSectionItemCombinations; // Added to check for duplicates
    existingEntriesWithDates?: ExistingEntryWithDate[]; // Added for date-specific duplicate checking
}

export const AddNetworthEntryDialog: React.FC<AddNetworthEntryDialogProps> = ({
    open,
    onOpenChange,
    userId,
    entryType,
    entryCategory,
    onAddEntry,
    loading,
    inputClass = "h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100",
    existingSections,
    existingItemNames,
    existingSectionItemCombinations,
    existingEntriesWithDates = [],
}) => {
    const [section, setSection] = useState('');
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [snapshotDate, setSnapshotDate] = useState<Date | undefined>(new Date());
    const [error, setError] = useState<string | null>(null);

    // Get available item names for the selected section (items that don't already exist)
    const availableItemNamesForSection = section.trim() ? 
        existingItemNames.filter(itemName => 
            !existingSectionItemCombinations[section.trim()]?.includes(itemName)
        ) : existingItemNames;
    
    // Get existing item names in current section for warning display
    const existingItemsInSection = section.trim() ? 
        existingSectionItemCombinations[section.trim()] || [] : [];
    
    // Check if current combination would be an exact duplicate (same section + name + date)
    const isDuplicateCombination = useMemo(() => {
        if (!section.trim() || !name.trim() || !snapshotDate) {
            return false;
        }
        
        // Fix timezone issue - format date properly to avoid off-by-one errors
        const year = snapshotDate.getFullYear();
        const month = String(snapshotDate.getMonth() + 1).padStart(2, '0');
        const day = String(snapshotDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        const trimmedSection = section.trim();
        const trimmedName = name.trim();
        
        return existingEntriesWithDates.some(entry => 
            entry.section === trimmedSection && 
            entry.name === trimmedName && 
            entry.snapshot_date === dateString
        );
    }, [section, name, snapshotDate, existingEntriesWithDates]);
    
    // Check if all required fields are filled
    const isFormValid = section.trim() && name.trim() && value.trim() && snapshotDate;

    useEffect(() => {
        if (open) {
            // Reset form when dialog opens
            setSection('');
            setName('');
            setValue('');
            setSnapshotDate(new Date());
            setError(null);
        }
    }, [open]);

    // Clear error when form state changes (especially for duplicate validation)
    useEffect(() => {
        if (error && !isDuplicateCombination) {
            setError(null);
        }
    }, [isDuplicateCombination, error]);

    const handleSubmit = async () => {
        // Validate Section
        if (!section.trim()) {
            setError("Section is required.");
            return;
        }
        
        // Validate Item Name
        if (!name.trim()) {
            setError("Item name is required.");
            return;
        }
        
        // Validate Value
        if (!value.trim()) {
            setError("Value is required.");
            return;
        }
        
        // Validate Snapshot Date
        if (!snapshotDate) {
            setError("Snapshot date is required.");
            return;
        }
        
        // Check for exact duplicate: same section + item name + same date
        const trimmedSection = section.trim();
        const trimmedName = name.trim();
        
        // Fix timezone issue - format date properly to avoid off-by-one errors
        const year = snapshotDate.getFullYear();
        const month = String(snapshotDate.getMonth() + 1).padStart(2, '0');
        const day = String(snapshotDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // Check if this exact combination already exists - fresh check at submission
        const exactDuplicate = existingEntriesWithDates.some(entry => 
            entry.section === trimmedSection && 
            entry.name === trimmedName && 
            entry.snapshot_date === dateString
        );
        
        if (exactDuplicate) {
            setError(`An entry with the same section "${trimmedSection}", item name "${trimmedName}", and date "${dateString}" already exists. Please use a different date or modify the name.`);
            return;
        }
        
        // Validate numeric value
        const numericValue = parseFloat(value.trim());
        if (isNaN(numericValue)) {
            setError("Value must be a valid number.");
            return;
        }
        
        setError(null);

        // Use the same timezone-safe date formatting for consistency
        const payloadYear = snapshotDate.getFullYear();
        const payloadMonth = String(snapshotDate.getMonth() + 1).padStart(2, '0');
        const payloadDay = String(snapshotDate.getDate()).padStart(2, '0');
        const payloadDateString = `${payloadYear}-${payloadMonth}-${payloadDay}`;

        const payload: NewNetworthEntryData = {
            user_id: userId,
            type: entryType,
            category: entryCategory,
            snapshot_date: payloadDateString, // Use timezone-safe formatting
            section: section.trim(),
            name: name.trim(),
            value: numericValue,
        };

        const success = await onAddEntry(payload);
        if (success) {
            onOpenChange(false); // Close dialog on successful add
        }
        // If not successful, error should be handled by parent or displayed in dialog via prop
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle>Add New {entryCategory === 'asset' ? 'Asset' : 'Liability'}</DialogTitle>
                    <DialogDescription>
                        Enter details for the new {entryType} {entryCategory === 'asset' ? 'asset' : 'liability'}. All fields marked with * are required.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="section" className="text-left dark:text-gray-300">
                            Section <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="section"
                            list="existing-sections-list"
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            className={`col-span-3 ${inputClass}`}
                            placeholder="e.g., Bank Accounts (Required)"
                            required
                        />
                        <datalist id="existing-sections-list">
                            {existingSections.map((s, i) => <option key={`section-${i}`} value={s} />)}
                        </datalist>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-left dark:text-gray-300">
                            Item Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="col-span-3">
                            <Input
                                id="name"
                                list="existing-items-list"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`${inputClass} ${isDuplicateCombination ? 'border-red-500 dark:border-red-400' : ''}`}
                                placeholder="e.g., Savings Account (Required)"
                                required
                            />
                            <datalist id="existing-items-list">
                                {availableItemNamesForSection.map((n, i) => <option key={`item-${i}`} value={n} />)}
                            </datalist>
                            {isDuplicateCombination && (
                                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                                    ⚠️ This exact combination (section + name + date) already exists
                                </p>
                            )}
                            {existingItemsInSection.length > 0 && section.trim() && !isDuplicateCombination && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Existing items in "{section}": {existingItemsInSection.join(', ')} (Same name with different dates allowed)
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="value" className="text-left dark:text-gray-300">
                            Value <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="value"
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className={`col-span-3 ${inputClass}`}
                            placeholder="e.g., 1500.00 (Required)"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="snapshot_date" className="text-left dark:text-gray-300">
                            Snapshot Date <span className="text-red-500">*</span>
                        </Label>
                        <DatePicker date={snapshotDate} setDate={setSnapshotDate} className={`col-span-3 ${inputClass}`} /> 
                    </div>
                </div>
                {error && (
                    <div className="px-6 pb-4">
                        <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                            {error}
                        </p>
                    </div>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSubmit} disabled={loading || isDuplicateCombination || !isFormValid}>
                        {loading ? 'Adding...' : 'Add Entry'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 