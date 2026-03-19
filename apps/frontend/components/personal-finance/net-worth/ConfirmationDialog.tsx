"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    variant = "destructive"
}) => {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md dark:bg-gray-800">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${variant === 'destructive' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                            <AlertTriangle className={`h-5 w-5 ${variant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
                        </div>
                        <DialogTitle className="text-left dark:text-gray-100">{title}</DialogTitle>
                    </div>
                    <DialogDescription className="text-left mt-2 dark:text-gray-300">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row justify-end gap-2 mt-6">
                    <DialogClose asChild>
                        <Button variant="outline" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                            {cancelText}
                        </Button>
                    </DialogClose>
                    <Button 
                        variant={variant} 
                        onClick={handleConfirm}
                        className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700' : ''}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 