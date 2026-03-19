"use client";

import { useState, useCallback } from 'react';
import type { Database } from '@/lib/database.types'; // Import the main DB type

// Use types from database.types.ts
export type CreditCardInstructionDBRow = Database['public']['Tables']['credit_card_instructions']['Row'];
export type CreditCardInstructionDBInsert = Database['public']['Tables']['credit_card_instructions']['Insert'];
export type CreditCardInstructionDBUpdate = Database['public']['Tables']['credit_card_instructions']['Update'];

// Interface for the raw API response
interface ApiCreditCardInstructionResponse {
  id: string;
  user_id: string;
  card_name: string;
  payment_day: number;
  description: string | null;
  instruction: string | null;
  is_paid: boolean;
  last_reset_date: string | null;
  created_at: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const CREDIT_CARD_INSTRUCTION_ENDPOINT = `${backendApiDomain}/credit-card-instructions/`;

// Helper to transform API response to our DBRow type (ensures nulls)
const transformApiToDbRow = (apiRow: ApiCreditCardInstructionResponse): CreditCardInstructionDBRow => {
  return {
    ...apiRow,
    description: apiRow.description === undefined ? null : apiRow.description,
    instruction: apiRow.instruction === undefined ? null : apiRow.instruction,
    is_paid: apiRow.is_paid === undefined ? false : apiRow.is_paid,
    last_reset_date: apiRow.last_reset_date === undefined ? null : apiRow.last_reset_date,
  };
};

export function useCreditCardInstruction() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addCreditCardInstruction = useCallback(
    async (payload: CreditCardInstructionDBInsert): Promise<CreditCardInstructionDBRow | null> => {
      setLoading(true);
      setError(null);
      try {
        // Ensure optional fields default to null if undefined, as per DB schema expectations
        const bodyPayload: CreditCardInstructionDBInsert = {
          ...payload,
          description: payload.description === undefined ? null : payload.description,
          instruction: payload.instruction === undefined ? null : payload.instruction,
          is_paid: payload.is_paid === undefined ? false : payload.is_paid,
        };

        const response = await fetch(CREDIT_CARD_INSTRUCTION_ENDPOINT, {
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
        const data: ApiCreditCardInstructionResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding credit card instruction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch list with filters ---
  const fetchCreditCardInstructions = useCallback(
    async (
      userId: string,
      skip = 0,
      limit = 100,
      returnAll = false
    ): Promise<CreditCardInstructionDBRow[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      if (returnAll) params.append('return_all', String(returnAll));
      
      const url = `${CREDIT_CARD_INSTRUCTION_ENDPOINT}?${params.toString()}`;
      console.log("Fetching credit card instructions from URL:", url);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCreditCardInstructionResponse[] = await response.json();
        setLoading(false);
        return data.map(transformApiToDbRow);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching credit card instructions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchCreditCardInstructionById = useCallback(
    async (id: string, userId: string): Promise<CreditCardInstructionDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${CREDIT_CARD_INSTRUCTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiCreditCardInstructionResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching credit card instruction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update --- 
  const updateCreditCardInstruction = useCallback(
    async (
      id: string,
      userId: string,
      updatePayload: CreditCardInstructionDBUpdate 
    ): Promise<CreditCardInstructionDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${CREDIT_CARD_INSTRUCTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const bodyPayload: CreditCardInstructionDBUpdate = { ...updatePayload };
        
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
        const data: ApiCreditCardInstructionResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating credit card instruction'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteCreditCardInstruction = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${CREDIT_CARD_INSTRUCTION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
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
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting credit card instruction'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // --- Bulk reset all payments for a user ---
  const resetAllPayments = useCallback(
    async (userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${CREDIT_CARD_INSTRUCTION_ENDPOINT}reset-payments?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setLoading(false);
        return true;
      } catch (err) {
        console.warn('Backend not available for reset, using local fallback');
        
        // For development: simulate reset by updating local state
        // In a real implementation, this would be handled by the backend
        try {
          // Fetch current instructions and reset them locally
          const currentInstructions = await fetchCreditCardInstructions(userId, 0, 100, true);
          if (currentInstructions) {
            // Update each instruction to set is_paid to false
            for (const instruction of currentInstructions) {
              await updateCreditCardInstruction(instruction.id, userId, { is_paid: false });
            }
          }
          setLoading(false);
          return true;
        } catch (localErr) {
          setError(localErr instanceof Error ? localErr : new Error('An unknown error occurred while resetting payments'));
          setLoading(false);
          return false;
        }
      }
    },
    [fetchCreditCardInstructions, updateCreditCardInstruction]
  );

  return {
    addCreditCardInstruction,
    fetchCreditCardInstructions,
    fetchCreditCardInstructionById,
    updateCreditCardInstruction,
    deleteCreditCardInstruction,
    resetAllPayments,
    loading,
    error,
  };
}
