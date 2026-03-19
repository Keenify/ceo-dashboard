"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HistoryListProps {
  completedDates: Date[];
  onViewDate: (date: Date) => void;
  selectedDate: Date;
}

export function HistoryList({ completedDates, onViewDate, selectedDate }: HistoryListProps) {
  const isDateSelected = (date: Date) => {
    return format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-center">History</h2>
      {completedDates.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center">No completed reviews yet.</p>
      ) : (
        <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {completedDates
            .sort((a,b) => b.getTime() - a.getTime())
            .map((date, i) => (
            <li key={i} >
              <Button
                variant={isDateSelected(date) ? "default" : "outline"}
                size="sm"
                onClick={() => onViewDate(date)}
                className={cn("w-full justify-center text-center",
                  isDateSelected(date) ? "font-semibold" : "font-normal"
                )}
              >
                {format(date, 'd MMM yyyy')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 