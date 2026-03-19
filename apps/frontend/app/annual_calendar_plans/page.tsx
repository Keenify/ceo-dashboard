'use client';

import React, { useEffect, useState } from 'react';
import { useAnnualCalendarPlans } from './services/useAnnualCalendarPlans';
import { AnnualCalendarPlan, AnnualCalendarPlanCreate } from './types';
import { AnnualCalendar, PlanForm } from '@/components/annual_calendar_plans';
import { useUser } from '@/lib/hooks/useUser';
import { startOfYear, endOfYear, format } from 'date-fns';

export default function AnnualCalendarPlansPage() {
  const { user } = useUser();
  const { loading, plans, createPlan, updatePlan, deletePlan, getPlans, updateColor } = useAnnualCalendarPlans();
  const [showForm, setShowForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AnnualCalendarPlan | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draggedDateRange, setDraggedDateRange] = useState<{start: string, end: string} | null>(null);

  useEffect(() => {
    if (user?.id) {
      // Get plans for the entire year
      const startDate = format(startOfYear(new Date(selectedYear, 0)), 'yyyy-MM-dd'); 
      const endDate = format(endOfYear(new Date(selectedYear, 0)), 'yyyy-MM-dd');
      getPlans(user.id, {
        start_date_from: startDate,
        end_date_to: endDate
      });
    }
  }, [user?.id, getPlans, selectedYear]);

  const handleCreatePlan = async (plan: AnnualCalendarPlanCreate) => {
    if (user?.id) {
      await createPlan(plan);
      setShowForm(false);
      setSelectedDate(null);
    }
  };

  const handleUpdatePlan = async (plan: AnnualCalendarPlanCreate) => {
    if (user?.id && selectedPlan?.id) {
      const result = await updatePlan(selectedPlan.id, plan);
      if (result) {
        setShowForm(false);
        setSelectedPlan(null);
      }
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (user?.id) {
      const result = await deletePlan(id);
      if (result) {
        setShowForm(false);
        setSelectedPlan(null);
      }
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedPlan(null);
    setDraggedDateRange(null);
    setSelectedDate(date);
    setShowForm(true);
  };

  const handlePlanClick = (plan: AnnualCalendarPlan) => {
    setSelectedDate(null);
    setDraggedDateRange(null);
    setSelectedPlan(plan);
    setShowForm(true);
  };

  const handleDragCreatePlan = (startDate: string, endDate: string) => {
    setSelectedPlan(null);
    setSelectedDate(null);
    setDraggedDateRange({ start: startDate, end: endDate });
    setShowForm(true);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const handleUpdateColor = async (planId: string, color: any) => {
    if (user?.id) {
      await updateColor(planId, color);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="bg-white shadow-sm rounded-lg p-2">
        <AnnualCalendar 
          year={selectedYear} 
          plans={plans}
          onDateClick={handleDateClick}
          onYearChange={handleYearChange}
          onPlanClick={handlePlanClick}
          onDragCreatePlan={handleDragCreatePlan}
          onUpdateColor={handleUpdateColor}
        />
      </div>

      {showForm && ( 
        <PlanForm
          plan={selectedPlan || undefined}
          onSubmit={selectedPlan ? handleUpdatePlan : handleCreatePlan}
          onCancel={() => {
            setShowForm(false);
            setSelectedPlan(null);
            setSelectedDate(null);
            setDraggedDateRange(null); 
          }}
          onDelete={handleDeletePlan} 
          isEditing={!!selectedPlan}
          defaultDate={selectedDate || undefined}
          draggedDateRange={draggedDateRange || undefined} 
        />
      )}

    </div>
  );
}