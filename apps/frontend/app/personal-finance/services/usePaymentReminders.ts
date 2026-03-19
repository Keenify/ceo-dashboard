"use client";

import { useState, useCallback } from 'react';

// Interfaces for payment reminders based on backend schema
export interface PaymentReminder {
  id: string;
  user_id: string;
  card_id: string;
  scheduled_date: string; // ISO date string
  sent_at?: string | null; // ISO datetime string
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  email: string;
  days_before_due: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentReminderCreate {
  user_id: string;
  card_id: string;
  scheduled_date: string; // ISO date string
  email: string;
  days_before_due?: number; // Default 3 in backend
}

export interface PaymentReminderUpdate {
  scheduled_date?: string;
  status?: 'pending' | 'sent' | 'failed' | 'cancelled';
  email?: string;
  days_before_due?: number;
  sent_at?: string | null;
}

// API Response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SendRemindersResponse {
  message: string;
  emails_sent: number;
  errors: number;
  details: Array<{
    user_id: string;
    email: string;
    status: string;
    error?: string;
    reminder_ids: string[];
  }>;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const PAYMENT_REMINDERS_ENDPOINT = `${backendApiDomain}/payment-reminders/`;

export function usePaymentReminders() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper function to handle API errors
  const handleApiError = async (response: Response): Promise<never> => {
    let errorDetail = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || errorDetail;
    } catch (jsonError) {
      // If response body is not JSON, use status text
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  };

  // --- Create reminder ---
  const createPaymentReminder = useCallback(
    async (payload: PaymentReminderCreate): Promise<PaymentReminder | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(PAYMENT_REMINDERS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error creating payment reminder:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating payment reminder'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch reminders by user ---
  const fetchPaymentReminders = useCallback(
    async (
      userId: string,
      skip = 0,
      limit = 100,
      status?: string,
      returnAll = false
    ): Promise<PaymentReminder[] | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      if (status) params.append('status', status);
      if (returnAll) params.append('return_all', String(returnAll));
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error fetching payment reminders:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching payment reminders'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch reminders by card ---
  const fetchRemindersByCard = useCallback(
    async (
      cardId: string,
      userId: string,
      status?: string
    ): Promise<PaymentReminder[] | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      if (status) params.append('status', status);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}card/${cardId}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error fetching reminders by card:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching reminders by card'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get reminders due today (for admin/debugging) ---
  const fetchRemindersDueToday = useCallback(
    async (targetDate?: string): Promise<PaymentReminder[] | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (targetDate) params.append('target_date', targetDate);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}due-today?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error fetching reminders due today:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching reminders due today'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get specific reminder ---
  const fetchPaymentReminder = useCallback(
    async (reminderId: string, userId: string): Promise<PaymentReminder | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}${reminderId}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error fetching payment reminder:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching payment reminder'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update reminder ---
  const updatePaymentReminder = useCallback(
    async (
      reminderId: string,
      userId: string,
      updateData: PaymentReminderUpdate
    ): Promise<PaymentReminder | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}${reminderId}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error updating payment reminder:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating payment reminder'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Mark reminder as sent ---
  const markReminderAsSent = useCallback(
    async (reminderId: string, userId: string): Promise<PaymentReminder | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}${reminderId}/mark-sent?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error marking reminder as sent:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while marking reminder as sent'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Mark reminder as failed ---
  const markReminderAsFailed = useCallback(
    async (reminderId: string, userId: string): Promise<PaymentReminder | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}${reminderId}/mark-failed?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: PaymentReminder = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error marking reminder as failed:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while marking reminder as failed'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Cancel reminders for card ---
  const cancelRemindersForCard = useCallback(
    async (cardId: string, userId: string): Promise<{ cancelled_count: number } | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}card/${cardId}/cancel?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error cancelling reminders for card:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while cancelling reminders'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete reminder ---
  const deletePaymentReminder = useCallback(
    async (reminderId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}${reminderId}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': '*/*' },
        });
        
        if (!response.ok && response.status !== 204) {
          await handleApiError(response);
        }
        
        setLoading(false);
        return true;
      } catch (err) {
        console.error('Error deleting payment reminder:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting payment reminder'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // --- Manually send due reminders (for testing) ---
  const sendDueReminders = useCallback(
    async (targetDate?: string): Promise<SendRemindersResponse | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (targetDate) params.append('target_date', targetDate);
      
      const url = `${PAYMENT_REMINDERS_ENDPOINT}send-due-reminders?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: SendRemindersResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Error sending due reminders:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while sending due reminders'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Schedule reminders for card (utility function) ---
  const scheduleRemindersForCard = useCallback(
    async (
      cardId: string,
      userId: string,
      paymentDay: number,
      email: string,
      reminderDaysBefore: number = 3
    ): Promise<PaymentReminder[] | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // Revert to system date since user confirmed it's correct
        const today = new Date();
        console.log('🔧 DEBUG scheduleRemindersForCard - Input parameters:');
        console.log('  cardId:', cardId);
        console.log('  userId:', userId);
        console.log('  paymentDay:', paymentDay);
        console.log('  email:', email);
        console.log('  reminderDaysBefore:', reminderDaysBefore);
        console.log('  today:', today);
        console.log('  today string:', today.toString());
        console.log('  today year:', today.getFullYear());
        console.log('  today month:', today.getMonth());
        console.log('  today date:', today.getDate());
        
        const reminders: PaymentReminderCreate[] = [];
        
        // Find the next upcoming payment due date
        let nextDueDate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
        console.log('🔧 DEBUG initial nextDueDate calculation:');
        console.log('  new Date(year, month, day):', `new Date(${today.getFullYear()}, ${today.getMonth()}, ${paymentDay})`);
        console.log('  nextDueDate:', nextDueDate);
        console.log('  nextDueDate string:', nextDueDate.toString());
        
        // If this month's payment day has already passed, move to next month
        console.log('🔧 DEBUG comparing dates:');
        console.log('  nextDueDate <= today?', nextDueDate <= today);
        console.log('  nextDueDate:', nextDueDate.toString());
        console.log('  today:', today.toString());
        
        if (nextDueDate <= today) {
          nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
          console.log('🔧 DEBUG updated nextDueDate (next month):');
          console.log('  new Date(year, month+1, day):', `new Date(${today.getFullYear()}, ${today.getMonth() + 1}, ${paymentDay})`);
          console.log('  nextDueDate:', nextDueDate);
          console.log('  nextDueDate string:', nextDueDate.toString());
        }
        
        // Calculate reminder date (due date - days before)
        const reminderDate = new Date(nextDueDate);
        console.log('🔧 DEBUG reminder date calculation:');
        console.log('  reminderDate before setDate:', reminderDate);
        console.log('  reminderDate string before:', reminderDate.toString());
        console.log('  nextDueDate.getDate():', nextDueDate.getDate());
        console.log('  reminderDaysBefore:', reminderDaysBefore);
        console.log('  calculation: getDate() - reminderDaysBefore =', nextDueDate.getDate() - reminderDaysBefore);
        
        reminderDate.setDate(nextDueDate.getDate() - reminderDaysBefore);
        console.log('🔧 DEBUG reminder date after setDate:');
        console.log('  reminderDate:', reminderDate);
        console.log('  reminderDate string:', reminderDate.toString());
        
        // If the reminder date is still in the past, move to next month
        if (reminderDate <= today) {
          console.log('🔧 DEBUG: Reminder date is in the past, moving to next month');
          console.log('🔧 DEBUG: Before next month calculation:');
          console.log('  today.getFullYear():', today.getFullYear());
          console.log('  today.getMonth():', today.getMonth());
          console.log('  today.getMonth() + 1:', today.getMonth() + 1);
          console.log('  paymentDay:', paymentDay);
          
          nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
          console.log('🔧 DEBUG: New nextDueDate created:', nextDueDate.toString());
          console.log('  nextDueDate.getFullYear():', nextDueDate.getFullYear());
          console.log('  nextDueDate.getMonth():', nextDueDate.getMonth());
          console.log('  nextDueDate.getDate():', nextDueDate.getDate());
          
          reminderDate.setTime(nextDueDate.getTime());
          console.log('🔧 DEBUG: After setTime to nextDueDate:', reminderDate.toString());
          
          console.log('🔧 DEBUG: About to subtract days:');
          console.log('  nextDueDate.getDate():', nextDueDate.getDate());
          console.log('  reminderDaysBefore:', reminderDaysBefore);
          console.log('  calculation: getDate() - reminderDaysBefore =', nextDueDate.getDate() - reminderDaysBefore);
          
          reminderDate.setDate(nextDueDate.getDate() - reminderDaysBefore);
          console.log('🔧 DEBUG: After setDate subtraction:', reminderDate.toString());
          console.log('  reminderDate.getFullYear():', reminderDate.getFullYear());
          console.log('  reminderDate.getMonth():', reminderDate.getMonth());
          console.log('  reminderDate.getDate():', reminderDate.getDate());
          
          console.log('🔧 DEBUG: Updated to next month:');
          console.log('  nextDueDate:', nextDueDate.toString());
          console.log('  reminderDate:', reminderDate.toString());
        }
        
        // Convert to ISO format - FIX: Use local date to avoid timezone shift
        // const isoString = reminderDate.toISOString();
        // const dateOnly = isoString.split('T')[0];
        
        // Use local date formatting to avoid timezone conversion issues
        const year = reminderDate.getFullYear();
        const month = String(reminderDate.getMonth() + 1).padStart(2, '0');
        const day = String(reminderDate.getDate()).padStart(2, '0');
        const dateOnly = `${year}-${month}-${day}`;
        
        console.log('🔧 DEBUG ISO conversion (FIXED):');
        console.log('  reminderDate.getFullYear():', year);
        console.log('  reminderDate.getMonth() + 1:', reminderDate.getMonth() + 1);
        console.log('  reminderDate.getDate():', reminderDate.getDate());
        console.log('  dateOnly (local formatting):', dateOnly);
        console.log('  OLD toISOString() would give:', reminderDate.toISOString().split('T')[0]);
        
        // Only create reminder if the reminder date is in the future
        console.log('🔧 DEBUG future check:');
        console.log('  reminderDate > today?', reminderDate > today);
        console.log('  reminderDate:', reminderDate.toString());
        console.log('  today:', today.toString());
        
        if (reminderDate > today) {
          console.log(`Creating reminder for card ${cardId}:`);
          console.log(`  Payment due: ${nextDueDate.toDateString()}`);
          console.log(`  Reminder date: ${reminderDate.toDateString()}`);
          console.log(`  Scheduled: ${dateOnly}`); // Use fixed local date formatting
          
          const reminderPayload = {
            user_id: userId,
            card_id: cardId,
            scheduled_date: dateOnly, // Use the fixed local date formatting
            email: email,
            days_before_due: reminderDaysBefore
          };
          
          console.log('🔧 DEBUG reminder payload:', reminderPayload);
          reminders.push(reminderPayload);
        } else {
          console.log(`Reminder date ${reminderDate.toDateString()} is still in the past, skipping`);
        }
        
        // Create the reminder
        const createdReminders: PaymentReminder[] = [];
        for (const reminder of reminders) {
          console.log('🔧 DEBUG creating reminder with payload:', reminder);
          const created = await createPaymentReminder(reminder);
          console.log('🔧 DEBUG createPaymentReminder result:', created);
          if (created) {
            createdReminders.push(created);
          }
        }
        
        console.log('🔧 DEBUG final result:', createdReminders);
        setLoading(false);
        return createdReminders;
      } catch (err) {
        console.error('Error scheduling reminders for card:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while scheduling reminders'));
        setLoading(false);
        return null;
      }
    },
    [createPaymentReminder]
  );

  return {
    // CRUD operations
    createPaymentReminder,
    fetchPaymentReminders,
    fetchRemindersByCard,
    fetchRemindersDueToday,
    fetchPaymentReminder,
    updatePaymentReminder,
    deletePaymentReminder,
    
    // Status management
    markReminderAsSent,
    markReminderAsFailed,
    cancelRemindersForCard,
    
    // Utility functions
    scheduleRemindersForCard,
    sendDueReminders,
    
    // State
    loading,
    error,
  };
} 