import React, { useState } from 'react';
import { AnnualCalendarPlan, AllowedColor } from '@/app/annual_calendar_plans/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ColorSelector from './ColorSelector';

interface ColorUpdateModalProps {
  plan: AnnualCalendarPlan;
  isOpen: boolean;
  onClose: () => void;
  onUpdateColor: (planId: string, color: AllowedColor) => Promise<void>;
}

const ColorUpdateModal: React.FC<ColorUpdateModalProps> = ({
  plan,
  isOpen,
  onClose,
  onUpdateColor,
}) => {
  const [selectedColor, setSelectedColor] = useState<AllowedColor>(plan.color as AllowedColor);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    if (selectedColor === plan.color) {
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateColor(plan.id, selectedColor);
      onClose();
    } catch (error) {
      console.error('Failed to update color:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectedColor(plan.color as AllowedColor); // Reset to original color
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update Plan Color</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Plan: <span className="font-medium">{plan.title}</span></p>
            <p className="text-xs text-gray-500">
              {plan.start_date} to {plan.end_date}
            </p>
          </div>

          <ColorSelector
            selectedColor={selectedColor}
            onColorSelect={setSelectedColor}
            label="Choose New Color"
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={isUpdating || selectedColor === plan.color}
              className="bg-black hover:bg-black/90 text-white"
            >
              {isUpdating ? 'Updating...' : 'Update Color'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColorUpdateModal;