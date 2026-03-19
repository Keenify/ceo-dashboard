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

export interface EditNetWorthItemData {
    originalSectionName: string;
    originalItemName: string;
    newItemName: string;
    // newSectionName?: string; // Future: To allow moving item to different section
}

interface EditNetWorthItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemDetails: {
        sectionName: string;
        itemName: string;
        entryType: "personal" | "business";
        entryCategory: "asset" | "liability";
    } | null;
    onSaveItem: (data: EditNetWorthItemData) => Promise<boolean>; 
    loading: boolean; 
    inputClass?: string;
    existingItemNamesInSection: string[]; // To check for name conflicts within the same section
}

export const EditNetWorthItemDialog: React.FC<EditNetWorthItemDialogProps> = ({
    open,
    onOpenChange,
    itemDetails,
    onSaveItem,
    loading,
    inputClass = "h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100",
    existingItemNamesInSection,
}) => {
    const [itemName, setItemName] = useState('');
    // const [sectionName, setSectionName] = useState(''); // For future section editing
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && itemDetails) {
            setItemName(itemDetails.itemName === 'Unnamed Item' ? '' : itemDetails.itemName);
            // setSectionName(itemDetails.sectionName);
            setError(null);
        } else if (!open) {
            setItemName('');
            // setSectionName('');
            setError(null);
        }
    }, [open, itemDetails]);

    const handleSubmit = async () => {
        if (!itemDetails) return;

        const newItemNameTrimmed = itemName.trim();

        if (!newItemNameTrimmed) {
            setError("Item name cannot be empty.");
            return;
        }
        // Check for conflict only if name changed and it's not the original name (case-insensitive for new name)
        if (newItemNameTrimmed.toLowerCase() !== itemDetails.itemName.toLowerCase() && 
            existingItemNamesInSection.map(name => name.toLowerCase()).includes(newItemNameTrimmed.toLowerCase())) {
            setError(`An item named "${newItemNameTrimmed}" already exists in this section.`);
            return;
        }
        
        setError(null);

        const payload: EditNetWorthItemData = {
            originalSectionName: itemDetails.sectionName,
            originalItemName: itemDetails.itemName,
            newItemName: newItemNameTrimmed,
        };

        const success = await onSaveItem(payload);
        if (success) {
            onOpenChange(false);
        }
    };

    if (!itemDetails) return null; // Don't render if no item details

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                    <DialogDescription>
                        Editing item "{itemDetails.itemName}" in section "{itemDetails.sectionName}".
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* For future section editing 
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-section" className="text-right dark:text-gray-300">
                            Section
                        </Label>
                        <Input
                            id="edit-section"
                            value={sectionName}
                            onChange={(e) => setSectionName(e.target.value)}
                            className={`col-span-3 ${inputClass}`}
                        />
                    </div>
                    */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-item-name" className="text-right dark:text-gray-300">
                            Item Name
                        </Label>
                        <Input
                            id="edit-item-name"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            className={`col-span-3 ${inputClass}`}
                            placeholder="Enter item name"
                        />
                    </div>
                    {error && <p className="text-red-500 dark:text-red-400 text-sm col-span-4 text-center">{error}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 