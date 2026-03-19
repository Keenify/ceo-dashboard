"use client";

import { useState, useCallback } from 'react';

// Interface for user settings matching backend schema
export interface UserSettings {
  id: string;
  user_id: string;
  email_reminders_enabled: boolean;
  reminder_days_before: number;
  email_address: string;
  last_reset_date?: string | null;
  created_at: string;
  updated_at: string;
}

// Update interface for partial updates
export interface UserSettingsUpdate {
  email_reminders_enabled?: boolean;
  reminder_days_before?: number;
  email_address?: string;
  last_reset_date?: string | null;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const USER_SETTINGS_ENDPOINT = `${backendApiDomain}/user-settings`;

export function useUserSettings() {
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

  // Fetch user settings
  const fetchUserSettings = useCallback(
    async (userId: string): Promise<UserSettings | null> => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${USER_SETTINGS_ENDPOINT}/${userId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: UserSettings = await response.json();
        setLoading(false);
        return data;
        
      } catch (err) {
        console.error('Error fetching user settings:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user settings'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Save user settings
  const saveUserSettings = useCallback(
    async (userId: string, updates: UserSettingsUpdate): Promise<UserSettings | null> => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${USER_SETTINGS_ENDPOINT}/${userId}`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: UserSettings = await response.json();
        setLoading(false);
        return data;
        
      } catch (err) {
        console.error('Error saving user settings:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while saving user settings'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Create initial user settings (for new users)
  const createUserSettings = useCallback(
    async (userId: string, initialSettings?: Partial<UserSettingsUpdate>): Promise<UserSettings | null> => {
      setLoading(true);
      setError(null);
      
      try {
        const payload = {
          user_id: userId,
          email_reminders_enabled: initialSettings?.email_reminders_enabled ?? true,
          reminder_days_before: initialSettings?.reminder_days_before ?? 3,
          email_address: initialSettings?.email_address ?? "",
          last_reset_date: initialSettings?.last_reset_date ?? null,
        };

        const response = await fetch(USER_SETTINGS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          // If user already exists (409), try to fetch existing instead
          if (response.status === 409) {
            console.log('User settings already exist, fetching existing...');
            return await fetchUserSettings(userId);
          }
          await handleApiError(response);
        }
        
        const data: UserSettings = await response.json();
        setLoading(false);
        return data;
        
      } catch (err) {
        console.error('Error creating user settings:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating user settings'));
        setLoading(false);
        return null;
      }
    },
    [fetchUserSettings]
  );

  // Delete user settings (admin function)
  const deleteUserSettings = useCallback(
    async (userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${USER_SETTINGS_ENDPOINT}/${userId}`, {
          method: 'DELETE',
          headers: { 'Accept': '*/*' },
        });
        
        if (!response.ok && response.status !== 204) {
          await handleApiError(response);
        }
        
        setLoading(false);
        return true;
        
      } catch (err) {
        console.error('Error deleting user settings:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting user settings'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // Get all users with reminders enabled (admin function)
  const getUsersWithRemindersEnabled = useCallback(
    async (): Promise<UserSettings[] | null> => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${USER_SETTINGS_ENDPOINT}/admin/reminder-users`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          await handleApiError(response);
        }
        
        const data: UserSettings[] = await response.json();
        setLoading(false);
        return data;
        
      } catch (err) {
        console.error('Error fetching users with reminders enabled:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching users with reminders enabled'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    fetchUserSettings,
    saveUserSettings,
    createUserSettings,
    deleteUserSettings,
    getUsersWithRemindersEnabled,
    loading,
    error,
  };
} 