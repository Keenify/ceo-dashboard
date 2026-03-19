"use client";

import { useState, useCallback } from 'react';
import type { Database } from '@/lib/database.types'; // Import Database type

// --- Types for Travel Transaction ---
// Use types from database.types.ts for consistency
export type TravelTransactionPayload = Database['public']['Tables']['travel_transactions']['Insert'];
export type TravelTransactionResponse = Database['public']['Tables']['travel_transactions']['Row'];

// Types for bulk rename operation
export interface TravelTransactionBulkRenameRequest {
  user_id: string;
  old_trip_name: string;
  old_city: string;
  old_country: string;
  new_trip_name: string;
  new_city: string;
  new_country: string;
}

export interface TravelTransactionBulkRenameResponse {
  updated_count: number;
  updated_transaction_ids: string[];
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const TRAVEL_TRANSACTION_ENDPOINT = `${backendApiDomain}/travel-transactions/`;

export function useTravelTransaction() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addTravelTransaction = useCallback(
    async (payload: TravelTransactionPayload): Promise<TravelTransactionResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(TRAVEL_TRANSACTION_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const rawData = await response.json();
        // Robustly parse amounts to numbers or null, handling if API sends string or number
        const parseAmount = (value: string | number | null): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return isNaN(value) ? null : value;
          // If it's a string, parse it
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        };
        const parsedData: TravelTransactionResponse = {
          ...rawData,
          amount_sgd: parseAmount(rawData.amount_sgd),
          amount_local_currency: parseAmount(rawData.amount_local_currency),
          exchange_rate_to_sgd: parseAmount(rawData.exchange_rate_to_sgd),
        };
        setLoading(false);
        return parsedData;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding travel transaction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch all by user with optional filters ---
  const fetchTravelTransactions = useCallback(
    async (
      userId: string,
      skip = 0,
      limit = 100,
      startDate?: string,
      endDate?: string,
      city?: string,
      country?: string
    ): Promise<TravelTransactionResponse[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (city) params.append('city', city);
      if (country) params.append('country', country);
      const url = `${TRAVEL_TRANSACTION_ENDPOINT}?${params.toString()}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const rawDataArray = await response.json();
        const parseAmount = (value: string | number | null): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return isNaN(value) ? null : value;
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        };
        // Parse string amounts to numbers for each transaction
        const parsedDataArray: TravelTransactionResponse[] = rawDataArray.map((tx: any) => ({
          ...tx,
          amount_sgd: parseAmount(tx.amount_sgd),
          amount_local_currency: parseAmount(tx.amount_local_currency),
          exchange_rate_to_sgd: parseAmount(tx.exchange_rate_to_sgd),
        }));
        setLoading(false);
        return parsedDataArray;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching travel transactions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchTravelTransactionById = useCallback(
    async (id: string, userId: string): Promise<TravelTransactionResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${TRAVEL_TRANSACTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const rawData = await response.json();
        const parseAmount = (value: string | number | null): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return isNaN(value) ? null : value;
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        };
        // Parse string amounts to numbers
        const parsedData: TravelTransactionResponse = {
          ...rawData,
          amount_sgd: parseAmount(rawData.amount_sgd),
          amount_local_currency: parseAmount(rawData.amount_local_currency),
          exchange_rate_to_sgd: parseAmount(rawData.exchange_rate_to_sgd),
        };
        setLoading(false);
        return parsedData;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching travel transaction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update ---
  const updateTravelTransaction = useCallback(
    async (
      id: string,
      userId: string,
      updatePayload: Partial<TravelTransactionPayload>
    ): Promise<TravelTransactionResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${TRAVEL_TRANSACTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const rawData = await response.json();
        const parseAmount = (value: string | number | null): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return isNaN(value) ? null : value;
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        };
        // Parse string amounts to numbers
        const parsedData: TravelTransactionResponse = {
          ...rawData,
          amount_sgd: parseAmount(rawData.amount_sgd),
          amount_local_currency: parseAmount(rawData.amount_local_currency),
          exchange_rate_to_sgd: parseAmount(rawData.exchange_rate_to_sgd),
        };
        setLoading(false);
        return parsedData;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating travel transaction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteTravelTransaction = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${TRAVEL_TRANSACTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': '*/*' },
        });
        if (!response.ok && response.status !== 204) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        setLoading(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting travel transaction'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // --- Bulk Rename Trip ---
  const bulkRenameTravelTransactionTrip = useCallback(
    async (renameData: TravelTransactionBulkRenameRequest): Promise<TravelTransactionBulkRenameResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${TRAVEL_TRANSACTION_ENDPOINT}bulk-rename-trip`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(renameData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setLoading(false);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while bulk renaming trip'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    addTravelTransaction,
    fetchTravelTransactions,
    fetchTravelTransactionById,
    updateTravelTransaction,
    deleteTravelTransaction,
    bulkRenameTravelTransactionTrip,
    loading,
    error,
  };
} 