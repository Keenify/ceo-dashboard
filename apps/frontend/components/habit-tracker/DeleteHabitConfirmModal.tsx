import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteHabitConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  habitName?: string;
}

export function DeleteHabitConfirmModal({ open, onConfirm, onCancel, habitName }: DeleteHabitConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete Habit</DialogTitle>
        </DialogHeader>
        <div className="py-2 text-sm text-muted-foreground">
          Are you sure you want to <span className="text-destructive font-semibold">permanently delete</span>{' '}
          <span className="font-semibold">{habitName ? `"${habitName}"` : 'this habit'}</span>?<br />
          <span className="text-xs text-muted-foreground">This action cannot be undone.</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} type="button">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
