import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { cn } from "@/lib/utils";

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (habitData: {
    name: string;
    description: string;
    habit_type: 'build' | 'break' | 'track';
    color_code: string;
  }) => void;
  habit?: FetchedHabit; // Optional habit for editing mode
}

export function HabitModal({ isOpen, onClose, onSubmit, habit }: HabitModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [habitType, setHabitType] = useState<'build' | 'break' | 'track'>('build');
  const [colorCode, setColorCode] = useState('#ef4444');

  // Define the 6 predefined colors
  const predefinedColors = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
  ];

  // Initialize form with habit data when editing
  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setHabitType(habit.habit_type);
      setColorCode(habit.color_code);
    } else {
      // Reset form when creating new habit
      setName('');
      setDescription('');
      setHabitType('build');
      setColorCode(predefinedColors[0]); // Default to first predefined color
    }
  }, [habit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      habit_type: habitType,
      color_code: colorCode,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{habit ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Habit Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter habit name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter habit description"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Habit Type</Label>
            <RadioGroup
              value={habitType}
              onValueChange={(value: 'build' | 'break' | 'track') => setHabitType(value)}
              className="flex space-x-4 pt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="build" id="r-build" />
                <Label htmlFor="r-build" className="cursor-pointer">Build</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="break" id="r-break" />
                <Label htmlFor="r-break" className="cursor-pointer">Break</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="track" id="r-track" />
                <Label htmlFor="r-track" className="cursor-pointer">Track</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2 pt-1">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    colorCode === color
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background border-primary"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setColorCode(color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{habit ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
