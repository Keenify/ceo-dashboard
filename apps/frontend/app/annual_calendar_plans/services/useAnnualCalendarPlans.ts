import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  AnnualCalendarPlan,
  AnnualCalendarPlanCreate,
  AnnualCalendarPlanUpdate,
  AnnualCalendarPlanFilter,
  AllowedColor,
  isValidColor,
  ALLOWED_COLORS
} from '../types';

// Backend API configuration
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const ANNUAL_CALENDAR_PLANS_ENDPOINT = `${backendApiDomain}/annual-calendar-plans/`;

// Helper function to handle network errors
const handleNetworkError = (error: any) => {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new Error('Network error: Unable to connect to the server. Please check your internet connection.');
  }
  return error;
};

export const useAnnualCalendarPlans = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<AnnualCalendarPlan[]>([]);

  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = error?.message || `Failed to ${operation}`;
    setError(errorMessage);
    toast.error(errorMessage);
    console.error(`Annual Calendar Plans ${operation} error:`, error);
  }, []);

  const getPlans = useCallback(async (userId: string, filter?: AnnualCalendarPlanFilter) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams({ user_id: userId });
      
      if (filter) {
        if (filter.start_date_from) queryParams.append('start_date_from', filter.start_date_from);
        if (filter.start_date_to) queryParams.append('start_date_to', filter.start_date_to);
        if (filter.end_date_from) queryParams.append('end_date_from', filter.end_date_from);
        if (filter.end_date_to) queryParams.append('end_date_to', filter.end_date_to);
        if (filter.title_contains) queryParams.append('title_contains', filter.title_contains);
      }

      const response = await fetch(`${ANNUAL_CALENDAR_PLANS_ENDPOINT}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // If we can't parse error JSON, use the default message
        }
        throw new Error(errorMessage);
      }

      const plansData: AnnualCalendarPlan[] = await response.json();
      setPlans(plansData);
      return plansData;
    } catch (error) {
      handleError(handleNetworkError(error), 'fetch plans');
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const createPlan = useCallback(async (plan: AnnualCalendarPlanCreate) => {
    setLoading(true);
    setError(null);
    
    try {
      // Frontend validation for color
      if (!isValidColor(plan.color)) {
        throw new Error(`Invalid color. Allowed colors are: ${ALLOWED_COLORS.join(', ')}`);
      }

      // Get current user to include user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const planWithUserId = {
        ...plan,
        user_id: user.id
      };

      const response = await fetch(ANNUAL_CALENDAR_PLANS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planWithUserId),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const newPlan: AnnualCalendarPlan = await response.json();
      setPlans(prev => {
        // Remove any existing plan with the same ID and add the new one
        const filtered = prev.filter(p => p.id !== newPlan.id);
        return [...filtered, newPlan];
      });
      toast.success('Plan created successfully');
      return newPlan;
    } catch (error) {
      handleError(handleNetworkError(error), 'create plan');
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const updatePlan = useCallback(async (id: string, plan: AnnualCalendarPlanUpdate) => {
    setLoading(true);
    setError(null);
    
    try {
      // Frontend validation for color if it's being updated
      if (plan.color && !isValidColor(plan.color)) {
        throw new Error(`Invalid color. Allowed colors are: ${ALLOWED_COLORS.join(', ')}`);
      }

      // Get current user to include user_id  
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${ANNUAL_CALENDAR_PLANS_ENDPOINT}${id}?user_id=${user.id}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(plan),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const updatedPlan: AnnualCalendarPlan = await response.json();
      setPlans(prev => prev.map(p => p.id === id ? updatedPlan : p));
      toast.success('Plan updated successfully');
      return updatedPlan;
    } catch (error) {
      handleError(handleNetworkError(error), 'update plan');
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const deletePlan = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user to include user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${ANNUAL_CALENDAR_PLANS_ENDPOINT}${id}?user_id=${user.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      setPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plan deleted successfully');
      return true;
    } catch (error) {
      handleError(handleNetworkError(error), 'delete plan');
      return false;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getPlansByDateRange = useCallback(async (userId: string, startDate: string, endDate: string) => {
    return getPlans(userId, {
      start_date_from: startDate,
      end_date_to: endDate
    });
  }, [getPlans]);

  const updateColor = useCallback(async (id: string, color: AllowedColor) => {
    setLoading(true);
    setError(null);
    
    try {
      // Frontend validation for color
      if (!isValidColor(color)) {
        throw new Error(`Invalid color. Allowed colors are: ${ALLOWED_COLORS.join(', ')}`);
      }

      // Get current user to include user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`${ANNUAL_CALENDAR_PLANS_ENDPOINT}${id}/color?user_id=${user.id}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ color }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const updatedPlan: AnnualCalendarPlan = await response.json();
      setPlans(prev => prev.map(p => p.id === id ? updatedPlan : p));
      toast.success('Plan color updated successfully');
      return updatedPlan;
    } catch (error) {
      handleError(handleNetworkError(error), 'update plan color');
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  return {
    loading,
    error,
    plans,
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getPlansByDateRange,
    updateColor
  };
}; 