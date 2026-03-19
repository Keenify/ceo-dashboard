"use client";

import { useState, useCallback } from 'react';
import type { Database } from '@/lib/database.types'; // Import the main DB type

// Use types from database.types.ts
export type CashflowDBRow = Database['public']['Tables']['cashflow']['Row'];
export type CashflowDBInsert = Database['public']['Tables']['cashflow']['Insert'];
export type CashflowDBUpdate = Database['public']['Tables']['cashflow']['Update'];

// Interface for the raw API response, where amount is a string
interface ApiCashflowResponse {
  flow_type: 'inflow' | 'outflow';
  amount: string; // Backend raw response from Decimal
  description: string | null;
  flow_date: string;
  category: string | null;
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  background_color_code: string | null;
  font_color_code: string | null;
  note: string | null;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const CASHFLOW_ENDPOINT = `${backendApiDomain}/cashflows/`;

// Helper to transform API response to our DBRow type (parses amount and ensures nulls)
const transformApiToDbRow = (apiRow: ApiCashflowResponse): CashflowDBRow => {
  return {
    ...apiRow,
    amount: parseFloat(apiRow.amount), // Parse string amount to number
    description: apiRow.description === undefined ? null : apiRow.description,
    category: apiRow.category === undefined ? null : apiRow.category,
    background_color_code: apiRow.background_color_code === undefined ? null : apiRow.background_color_code,
    font_color_code: apiRow.font_color_code === undefined ? null : apiRow.font_color_code,
    note: apiRow.note === undefined ? null : apiRow.note,
  };
};

export function useCashflow() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addCashflow = useCallback(
    async (payload: CashflowDBInsert): Promise<CashflowDBRow | null> => {
      setLoading(true);
      setError(null);
      try {
        // Ensure optional fields default to null if undefined, as per DB schema expectations
        const bodyPayload: CashflowDBInsert = {
          ...payload,
          description: payload.description === undefined ? null : payload.description,
          category: payload.category === undefined ? null : payload.category,
          background_color_code: payload.background_color_code === undefined ? null : payload.background_color_code,
          font_color_code: payload.font_color_code === undefined ? null : payload.font_color_code,
          note: payload.note === undefined ? null : payload.note,
        };

        const response = await fetch(CASHFLOW_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCashflowResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding cashflow'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch list with filters ---
  const fetchCashflows = useCallback(
    async (
      userId: string,
      skip = 0,
      limit = 500,
      flowType?: 'inflow' | 'outflow',
      returnAll?: boolean
    ): Promise<CashflowDBRow[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      if (flowType) params.append('flow_type', flowType);
      if (returnAll) params.append('return_all', String(returnAll));
      
      const url = `${CASHFLOW_ENDPOINT}?${params.toString()}`;
      console.log("Fetching cashflows from URL:", url);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCashflowResponse[] = await response.json();
        setLoading(false);
        return data.map(transformApiToDbRow);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching cashflows'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchCashflowById = useCallback(
    async (id: string, userId: string): Promise<CashflowDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${CASHFLOW_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCashflowResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching cashflow'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update --- 
  const updateCashflow = useCallback(
    async (
      id: string,
      userId: string,
      updatePayload: CashflowDBUpdate 
    ): Promise<CashflowDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${CASHFLOW_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        // Pydantic on backend with CashflowUpdate(BaseModel) means all fields are optional.
        // We send only the fields that are present in updatePayload.
        // If a field is explicitly null in updatePayload, it will be sent as null.
        const bodyPayload: CashflowDBUpdate = { ...updatePayload };
        // Explicitly set undefined optional fields to null if that's the desired backend behavior for missing optional fields
        // For Pydantic, sending undefined fields means they are not included, which is usually correct for PATCH-like behavior.
        // If DB expects null for clearing, ensure payload reflects that.
        // The CashflowDBUpdate type already allows fields to be optional or null.

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCashflowResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating cashflow'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteCashflow = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${CASHFLOW_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': '*/*' }, 
        });
        if (!response.ok && response.status !== 204) { 
          let errorDetail = `HTTP error! status: ${response.status}`;
           try {
               const errorData = await response.json();
               errorDetail = errorData.detail || errorDetail;
           } catch (jsonError) {
               // Ignore if response body is not JSON or empty
           }
          throw new Error(errorDetail);
        }
        setLoading(false);
        return true; 
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting cashflow'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    addCashflow,
    fetchCashflows,
    fetchCashflowById,
    updateCashflow,
    deleteCashflow,
    loading,
    error,
  };
}
