import React from 'react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { Edit, Trash2, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AnnualCalendarPlan } from '../../app/annual_calendar_plans/types';

interface PlanCardProps {
  plan: AnnualCalendarPlan;
  onEdit?: (plan: AnnualCalendarPlan) => void;
  onDelete?: (id: string) => void;
  isActive?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onEdit, onDelete, isActive = false }) => {
  const startDate = parseISO(plan.start_date);
  const endDate = parseISO(plan.end_date);
  const now = new Date();
  const isActivePlan = isWithinInterval(now, { start: startDate, end: endDate });
  const isUpcoming = startDate > now;
  const isCompleted = endDate < now;

  const getStatusColor = () => {
    if (isActivePlan) return 'bg-green-100 text-green-800 border-green-200';
    if (isUpcoming) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (isCompleted) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getStatusText = () => {
    if (isActivePlan) return 'Active';
    if (isUpcoming) return 'Upcoming';
    if (isCompleted) return 'Completed';
    return 'Unknown';
  };

  return (
    <Card className={`w-full ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="flex flex-row justify-between items-center">
        <h3 className="text-lg font-semibold">{plan.title}</h3>
        <div className="space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(plan)}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Edit plan"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(plan.id)}
              className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
              title="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {plan.description && (
          <p className="text-muted-foreground text-sm mb-3">{plan.description}</p>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          <span>
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>

        <div className="mt-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanCard; 