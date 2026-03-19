"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, XCircle } from 'lucide-react';

export interface EditNetWorthValueFormData {
    value: number | null;
}

interface EditNetWorthValueFormProps {
    initialValue: number | null;
    onSave: (updatedData: EditNetWorthValueFormData) => void;
    onCancel: () => void;
    inputClass?: string;
}

export const EditNetWorthValueForm: React.FC<EditNetWorthValueFormProps> = ({
    initialValue,
    onSave,
    onCancel,
    inputClass = "h-9 text-sm",
}) => {
    const [currentValue, setCurrentValue] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setCurrentValue(initialValue === null || initialValue === undefined ? "" : String(initialValue));
        setError(null);
    }, [initialValue]);

    const handleAttemptSave = () => {
        const trimmedValue = currentValue.trim();
        const numericValue = trimmedValue === '' ? null : parseFloat(trimmedValue);

        if (trimmedValue !== '' && (numericValue === null || isNaN(numericValue))) {
            setError("Invalid value. Must be a number or empty.");
            return;
        }
        setError(null);
        onSave({ value: numericValue });
    };

    return (
        <div className="p-3 space-y-3 w-48"> 
            <div>
                <Label htmlFor="networth-value" className="text-xs text-muted-foreground">
                    Value
                </Label>
                <Input
                    id="networth-value"
                    type="text" // Use text to allow empty string, then parse
                    inputMode="decimal"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
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
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs px-2 py-1 h-auto">
                    <XCircle size={14} className="mr-1" /> Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleAttemptSave} className="text-xs px-2 py-1 h-auto">
                    <Save size={14} className="mr-1" /> Save
                </Button>
            </div>
        </div>
    );
}; 