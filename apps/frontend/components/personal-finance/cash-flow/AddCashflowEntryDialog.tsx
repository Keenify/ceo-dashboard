"use client";

import React, { useState, useEffect } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    PREDEFINED_COLOR_PALETTES,
    ColorPalette,
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_FONT_COLOR,
    getDefaultPalette
} from '@/app/personal-finance/constants/colorPalettes';

// Helper function needed here too
const parseMonthYear = (monthYear: string): { year: number; month: number } | null => {
    try {
        const [monthStr, yearStr] = monthYear.split('-');
        const monthMap: { [key: string]: number } = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
        const month = monthMap[monthStr];
        const year = parseInt(yearStr);
        if (month && !isNaN(year)) {
            return { year, month };
        }
    } catch (e) { console.error("Error parsing monthYear:", monthYear, e); }
    return null;
};

// --- Types & Interfaces ---
interface NewRowState {
    description: string;
    day: string;
    backgroundColor: string;
    fontColor: string;
}

const initialNewRowState: NewRowState = {
    description: '',
    day: String(new Date().getDate()),
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    fontColor: DEFAULT_FONT_COLOR,
};

interface AddCashflowEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    flowType: 'inflow' | 'outflow';
    displayedMonthColumns: string[];
    processedRows: { description: string; day: string }[];
    onAddEntry: (newRowData: NewRowState) => Promise<boolean>;
    loading: boolean;
    inputClass?: string;
}

export const AddCashflowEntryDialog: React.FC<AddCashflowEntryDialogProps> = ({
    open,
    onOpenChange,
    userId,
    flowType,
    displayedMonthColumns,
    processedRows,
    onAddEntry,
    loading,
    inputClass = "h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100",
}) => {
    const [newRowData, setNewRowData] = useState<NewRowState>(initialNewRowState);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            const defaultPalette = getDefaultPalette();
            setNewRowData({
                description: '',
                day: String(new Date().getDate()),
                backgroundColor: defaultPalette.backgroundColor,
                fontColor: defaultPalette.fontColor,
            });
            setError(null);
        }
    }, [open]);

    const handleNewInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'day') {
             const dayNum = parseInt(value);
             if (value === '' || (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31)) {
                setNewRowData(prev => ({ ...prev, [name]: value }));
             }
         } else {
             setNewRowData(prev => ({ ...prev, [name]: value }));
         }
    };

    const handleColorPaletteChange = (paletteName: string) => {
        const selectedPalette = PREDEFINED_COLOR_PALETTES.find(p => p.name === paletteName);
        if (selectedPalette) {
            setNewRowData(prev => ({
                ...prev,
                backgroundColor: selectedPalette.backgroundColor,
                fontColor: selectedPalette.fontColor,
            }));
        }
    };

    const handleAddRow = async () => {
        if (!newRowData.description || !newRowData.day) {
            setError("Description and Day are required.");
            return;
        }
         const dayNum = parseInt(newRowData.day);
         if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
              setError("Invalid day.");
              return;
         }
         const exists = processedRows.some(r => r.description === newRowData.description && r.day === newRowData.day);
         if (exists) {
             setError("Description and Day combination already exists.");
             return;
         }
         const firstMonthYear = displayedMonthColumns[0];
         if (!firstMonthYear) {
             setError("Add a month column first.");
             return;
         }
         const parsedDateInfo = parseMonthYear(firstMonthYear);
         if (!parsedDateInfo) {
              setError("Error parsing month column.");
              return;
         }
         const targetDate = `${parsedDateInfo.year}-${String(parsedDateInfo.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        setError(null);

        setIsSaving(true);
        try {
            const success = await onAddEntry(newRowData);
            if (success) {
                onOpenChange(false);
            } else {
                 setError("Failed to add row. Check details.");
            }
        } catch (e) {
             console.error("Error during onAddEntry callback:", e);
             setError("An unexpected error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle dialog close/open changes to reset form
    useEffect(() => {
        if (!open) {
            // Reset state when dialog closes, keep day, set default colors
            const defaultPalette = getDefaultPalette();
            setNewRowData(prev => ({
                description: '',
                day: prev.day,
                backgroundColor: defaultPalette.backgroundColor,
                fontColor: defaultPalette.fontColor,
            }));
            setError(null);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             {/* Trigger is now handled by the parent component */}
             <DialogContent className="sm:max-w-[425px] dark:bg-gray-800">
                 <DialogHeader>
                     <DialogTitle>Add New {flowType === 'inflow' ? 'Inflow' : 'Outflow'} Entry</DialogTitle>
                     <DialogDescription>
                         Enter the description and day. Amounts can be added later in the table.
                     </DialogDescription>
                 </DialogHeader>
                 <div className="grid gap-4 py-4">
                     <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="new-description" className="text-right dark:text-gray-300">
                             Description
                         </Label>
                         <Input
                              id="new-description"
                             name="description"
                             value={newRowData.description}
                             onChange={handleNewInputChange}
                             className={`col-span-3 ${inputClass}`}
                              placeholder="e.g., Salary, Rent"
                         />
                     </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="new-day" className="text-right dark:text-gray-300">
                             Day of Month
                         </Label>
                         <Input
                              id="new-day"
                             type="number"
                             name="day"
                             value={newRowData.day}
                             onChange={handleNewInputChange}
                             min={1}
                             max={31}
                             className={`col-span-3 ${inputClass}`}
                             onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRow(); } }}
                         />
                     </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="color-palette" className="text-right dark:text-gray-300">
                            Color
                        </Label>
                        <Select
                            value={PREDEFINED_COLOR_PALETTES.find(p => p.backgroundColor === newRowData.backgroundColor && p.fontColor === newRowData.fontColor)?.name || "Default"}
                            onValueChange={handleColorPaletteChange}
                        >
                            <SelectTrigger className={`col-span-3 ${inputClass}`}>
                                <SelectValue placeholder="Select color scheme" />
                            </SelectTrigger>
                            <SelectContent>
                                {PREDEFINED_COLOR_PALETTES.map(palette => (
                                    <SelectItem key={palette.name} value={palette.name}>
                                        <div className="flex items-center">
                                            <span
                                                className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                                                style={{ backgroundColor: palette.backgroundColor, color: palette.fontColor }}
                                            ></span>
                                            {palette.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                      {error && <p className="text-red-500 dark:text-red-400 text-sm col-span-4 text-center">{error}</p>}
                 </div>
                 <DialogFooter>
                     <DialogClose asChild>
                          <Button type="button" variant="secondary">Cancel</Button>
                     </DialogClose>
                     <Button type="button" onClick={handleAddRow} disabled={loading || isSaving}>{isSaving ? 'Adding...' : 'Add Entry'}</Button>
                 </DialogFooter>
             </DialogContent>
         </Dialog>
    );
}; 