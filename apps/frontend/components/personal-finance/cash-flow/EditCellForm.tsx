"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PREDEFINED_COLOR_PALETTES, ColorPalette, findPaletteByCodes, DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_COLOR } from '@/app/personal-finance/constants/colorPalettes';
import { Palette, Save, XCircle } from 'lucide-react';

export interface EditCellFormData {
    value: string;
    backgroundColor: string;
    fontColor: string;
}

interface EditCellFormProps {
    initialData: EditCellFormData; // Made non-null as form is only rendered when there's data
    onSave: (updatedData: EditCellFormData) => void;
    onCancel: () => void; // To close the popover
    inputClass?: string;
    // title prop is removed as it's specific to a dialog header
}

export const EditCellForm: React.FC<EditCellFormProps> = ({
    initialData,
    onSave,
    onCancel,
    inputClass = "h-9 text-sm", // Slightly smaller for popover context
}) => {
    const [amount, setAmount] = useState("");
    const [selectedBgColor, setSelectedBgColor] = useState(DEFAULT_BACKGROUND_COLOR);
    const [selectedFontColor, setSelectedFontColor] = useState(DEFAULT_FONT_COLOR);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Populate state when initialData changes (e.g., when popover opens for a new cell)
        const isPlaceholderOrZero = initialData.value === "-" || parseFloat(initialData.value) === 0;
        setAmount(isPlaceholderOrZero ? "" : initialData.value); // Simplified: if placeholder or zero, start empty
        setSelectedBgColor(initialData.backgroundColor);
        setSelectedFontColor(initialData.fontColor);
        setError(null); // Clear error when new data is loaded
    }, [initialData]);

    const handleAttemptSave = () => {
        let newAmountStr = amount.trim();
        if (newAmountStr === "") {
            newAmountStr = "0.00"; // Treat empty as 0.00
        }
        
        const newAmountNum = parseFloat(newAmountStr);

        if (isNaN(newAmountNum)) {
            setError("Invalid amount. Please enter a valid number.");
            return;
        }
        setError(null);
        onSave({
            value: newAmountNum.toFixed(2),
            backgroundColor: selectedBgColor,
            fontColor: selectedFontColor,
        });
        // onCancel(); // Parent (popover) should close after successful save if desired
    };

    const handlePaletteChange = (paletteName: string) => {
        const selectedPalette = PREDEFINED_COLOR_PALETTES.find(p => p.name === paletteName);
        if (selectedPalette) {
            setSelectedBgColor(selectedPalette.backgroundColor);
            setSelectedFontColor(selectedPalette.fontColor);
        }
    };
    
    const currentSelectedPalette = findPaletteByCodes(selectedBgColor, selectedFontColor);

    return (
        <div className="p-4 space-y-4 w-64"> {/* Added padding and fixed width for popover content */}
            <div>
                <Label htmlFor="popover-amount" className="text-xs text-muted-foreground">
                    Amount
                </Label>
                <Input
                    id="popover-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`${inputClass} mt-1`}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAttemptSave();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancel();
                        }
                    }}
                />
            </div>
            <div>
                <Label htmlFor="popover-color-palette" className="text-xs text-muted-foreground">
                    Color
                </Label>
                <Select
                    value={currentSelectedPalette.name}
                    onValueChange={handlePaletteChange}
                >
                    <SelectTrigger className={`${inputClass} mt-1`}>
                        <div className="flex items-center justify-between w-full">
                            <span className="truncate mr-2 text-sm">{currentSelectedPalette.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <Palette size={14} style={{ color: selectedFontColor }} />
                                <div className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: selectedBgColor }}></div>
                            </div>
                        </div>
                    </SelectTrigger>
                    <SelectContent className="z-[100]"> {/* Ensure dropdown is on top */}
                        {PREDEFINED_COLOR_PALETTES.map(palette => (
                            <SelectItem key={palette.name} value={palette.name}>
                                <div className="flex items-center">
                                    <span
                                        className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                                        style={{ backgroundColor: palette.backgroundColor }}
                                    ></span>
                                    <span className="text-sm">{palette.name}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
                    <XCircle size={14} className="mr-1" /> Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleAttemptSave} className="text-xs">
                    <Save size={14} className="mr-1" /> Save
                </Button>
            </div>
        </div>
    );
}; 