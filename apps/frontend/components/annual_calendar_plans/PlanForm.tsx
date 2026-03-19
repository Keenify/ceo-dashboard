import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnnualCalendarPlan, AnnualCalendarPlanCreate, ALLOWED_COLORS, AllowedColor } from '@/app/annual_calendar_plans/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import ColorSelector from './ColorSelector';

const planSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  color: z.enum(ALLOWED_COLORS, { required_error: 'Color is required' }) as z.ZodType<AllowedColor>,
});

interface PlanFormProps {
  plan?: AnnualCalendarPlan;
  onSubmit: (data: AnnualCalendarPlanCreate) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string) => Promise<void>;
  isEditing?: boolean;
  defaultDate?: string;
  draggedDateRange?: { start: string; end: string };
}

const PlanForm: React.FC<PlanFormProps> = ({
  plan,
  onSubmit,
  onCancel,
  onDelete,
  isEditing = false,
  defaultDate,
  draggedDateRange,
}) => {
  const [selectedColor, setSelectedColor] = useState<AllowedColor>(plan?.color as AllowedColor || 'blue');
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<AnnualCalendarPlanCreate>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: plan?.title || '',
      description: plan?.description || '',
      start_date: plan?.start_date || draggedDateRange?.start || defaultDate || format(new Date(), 'yyyy-MM-dd'),
      end_date: plan?.end_date || draggedDateRange?.end || defaultDate || format(new Date(), 'yyyy-MM-dd'),
      color: plan?.color as AllowedColor || 'blue',
    },
  });

  const handleColorChange = (color: AllowedColor) => {
    setSelectedColor(color);
    setValue('color', color);
  };

  const handleDelete = async () => {
    if (onDelete && plan?.id) {
      await onDelete(plan.id);
      onCancel();
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Enter plan title"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Enter plan description"
              rows={3}
            />
          </div>

          <ColorSelector
            selectedColor={selectedColor}
            onColorSelect={handleColorChange}
            label="Plan Color"
          />
          <input type="hidden" {...register('color')} value={selectedColor} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
                className={errors.start_date ? 'border-red-500' : ''}
              />
              {errors.start_date && (
                <p className="text-red-500 text-sm mt-1">{errors.start_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
                className={errors.end_date ? 'border-red-500' : ''}
              />
              {errors.end_date && (
                <p className="text-red-500 text-sm mt-1">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center gap-2">
            {isEditing && onDelete && (
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-black hover:bg-black/90 text-white"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanForm; 