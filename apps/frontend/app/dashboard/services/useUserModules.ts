"use client";

import { useState, useCallback } from 'react';

// --- Types for User Modules ---
export interface UserModulesBase {
  stripe_customer_id: string;
  stripe_subscription_item_id: string;
  product_id: string;
  price_id: string;
  status: string;
  start_date: string;
  end_date?: string | null;
}

export interface UserModulesCreate extends UserModulesBase {
  user_id: string;
}

export interface UserModulesUpdate {
  stripe_customer_id?: string;
  stripe_subscription_item_id?: string;
  product_id?: string;
  price_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string | null;
}

export interface UserModulesResponse extends UserModulesBase {
  id: string;
  user_id: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const USER_MODULES_ENDPOINT = `${backendApiDomain}/user-modules`;

export function useUserModules() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create user module ---
  const createUserModule = useCallback(
    async (userModule: UserModulesCreate): Promise<UserModulesResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${USER_MODULES_ENDPOINT}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(userModule),
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error creating user module:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating user module'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get user module by ID ---
  const getUserModule = useCallback(
    async (userModuleId: string, userId: string): Promise<UserModulesResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/${userModuleId}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error fetching user module:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user module'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get all user modules by user ID ---
  const getUserModulesByUser = useCallback(
    async (userId: string): Promise<UserModulesResponse[] | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/user/${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error fetching user modules by user:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user modules'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get active user modules by user ID ---
  const getActiveUserModules = useCallback(
    async (userId: string): Promise<UserModulesResponse[] | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/user/${encodeURIComponent(userId)}/active`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error fetching active user modules:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching active user modules'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get user modules by Stripe customer ID ---
  const getUserModulesByStripeCustomer = useCallback(
    async (stripeCustomerId: string): Promise<UserModulesResponse[] | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/stripe/${encodeURIComponent(stripeCustomerId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error fetching user modules by Stripe customer:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user modules by Stripe customer'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update user module ---
  const updateUserModule = useCallback(
    async (userModuleId: string, userId: string, userModule: UserModulesUpdate): Promise<UserModulesResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/${userModuleId}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(userModule),
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error updating user module:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating user module'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update user module status ---
  const updateUserModuleStatus = useCallback(
    async (userModuleId: string, userId: string, subscriptionStatus: 'active' | 'cancelled' | 'paused'): Promise<UserModulesResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/${userModuleId}/status?subscription_status=${encodeURIComponent(subscriptionStatus)}&user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error updating user module status:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating user module status'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete user module ---
  const deleteUserModule = useCallback(
    async (userModuleId: string, userId: string): Promise<UserModulesResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${USER_MODULES_ENDPOINT}/${userModuleId}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: UserModulesResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error deleting user module:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting user module'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    createUserModule,
    getUserModule,
    getUserModulesByUser,
    getActiveUserModules,
    getUserModulesByStripeCustomer,
    updateUserModule,
    updateUserModuleStatus,
    deleteUserModule,
    loading,
    error,
  };
}
