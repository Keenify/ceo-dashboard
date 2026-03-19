import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnualCalendarPlan } from '../../app/annual_calendar_plans/types';
import { isWithinInterval, parseISO } from 'date-fns';

interface StatsComponentProps {
  plans: AnnualCalendarPlan[];
}

const StatsComponent: React.FC<StatsComponentProps> = ({ plans }) => {
  const now = new Date();

  const stats = plans.reduce(
    (acc, plan) => {
      const startDate = parseISO(plan.start_date);
      const endDate = parseISO(plan.end_date);

      if (isWithinInterval(now, { start: startDate, end: endDate })) {
        acc.active++;
      } else if (startDate > now) {
        acc.upcoming++;
      } else if (endDate < now) {
        acc.completed++;
      }

      return acc;
    },
    { active: 0, upcoming: 0, completed: 0 }
  );

  const totalPlans = plans.length;
  const completionRate = totalPlans > 0 ? (stats.completed / totalPlans) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.active}</div>
          <p className="text-xs text-muted-foreground">
            Currently in progress
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.upcoming}</div>
          <p className="text-xs text-muted-foreground">
            Scheduled for the future
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {completionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.completed} plans completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsComponent; 