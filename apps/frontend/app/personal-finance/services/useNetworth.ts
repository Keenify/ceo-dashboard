"use client";

import { useState, useCallback } from 'react';
import type { Database } from '@/lib/database.types'; // Import the main DB type

// Use types from database.types.ts
export type NetworthDBRow = Database['public']['Tables']['networth_entries']['Row'];
export type NetworthDBInsert = Database['public']['Tables']['networth_entries']['Insert'];
export type NetworthDBUpdate = Database['public']['Tables']['networth_entries']['Update'];

// Interface for the raw API response, where value is a string
interface ApiNetworthResponse {
  id: string;
  user_id: string;
  type: "personal" | "business";
  category: "asset" | "liability";
  snapshot_date: string;
  section: string;
  name: string | null;
  value: string | null; // Backend raw response from Decimal
  created_at: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const NETWORTH_ENDPOINT = `${backendApiDomain}/networth-entries/`;

// Helper to transform API response to our DBRow type (parses value and ensures nulls)
const transformApiToDbRow = (apiRow: ApiNetworthResponse): NetworthDBRow => {
  return {
    ...apiRow,
    value: apiRow.value === null || apiRow.value === undefined ? null : parseFloat(apiRow.value),
    name: apiRow.name === undefined ? null : apiRow.name,
    // Ensure other potentially missing optional fields from API are null if expected by NetworthDBRow
    // (though current ApiNetworthResponse and NetworthDBRow are quite aligned for other fields)
  };
};

export function useNetworth() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addNetworthEntry = useCallback(
    async (payload: NetworthDBInsert): Promise<NetworthDBRow | null> => {
      setLoading(true);
      setError(null);
      try {
        // Ensure optional fields default to null if undefined, as per DB schema expectations
        // For 'value', the payload already expects number | null, so direct stringify is fine.
        const bodyPayload: NetworthDBInsert = {
          ...payload,
          name: payload.name === undefined ? null : payload.name,
          value: payload.value === undefined ? null : payload.value,
        };

        const response = await fetch(NETWORTH_ENDPOINT, {
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
        const data: ApiNetworthResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding net worth entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch list with filters ---
  const fetchNetworthEntries = useCallback(
    async (
      userId: string,
      skip = 0,
      limit = 100,
      entryType?: "personal" | "business",
      category?: "asset" | "liability",
      section?: string,
      startDate?: string, // Expects YYYY-MM-DD
      endDate?: string,   // Expects YYYY-MM-DD
      returnAll?: boolean
    ): Promise<NetworthDBRow[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      if (entryType) params.append('type', entryType); // API uses 'type' alias
      if (category) params.append('category', category);
      if (section) params.append('section', section);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (returnAll) params.append('return_all', String(returnAll));
      
      const url = `${NETWORTH_ENDPOINT}?${params.toString()}`;
      console.log("Fetching net worth entries from URL:", url);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiNetworthResponse[] = await response.json();
        setLoading(false);
        return data.map(transformApiToDbRow);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching net worth entries'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchNetworthEntryById = useCallback(
    async (id: string, userId: string): Promise<NetworthDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${NETWORTH_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ApiNetworthResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching net worth entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update --- 
  const updateNetworthEntry = useCallback(
    async (
      id: string,
      userId: string,
      updatePayload: NetworthDBUpdate 
    ): Promise<NetworthDBRow | null> => {
      setLoading(true);
      setError(null);
      const url = `${NETWORTH_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        // NetworthDBUpdate allows fields to be optional or null.
        // Backend Pydantic schema NetworthEntryUpdate handles partial updates correctly.
        const bodyPayload: NetworthDBUpdate = { ...updatePayload };

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
        const data: ApiNetworthResponse = await response.json();
        setLoading(false);
        return transformApiToDbRow(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating net worth entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteNetworthEntry = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${NETWORTH_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
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
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting net worth entry'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // --- Bulk Delete by Name and Section ---
  const deleteNetworthEntriesByNameAndSection = useCallback(
    async (userId: string, name: string, section: string): Promise<number | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('name', name);
      params.append('section', section);
      const url = `${NETWORTH_ENDPOINT}bulk-delete-by-name-section?${params.toString()}`;
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
          } catch (jsonError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data = await response.json();
        setLoading(false);
        return typeof data.deleted_count === 'number' ? data.deleted_count : null;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while bulk deleting net worth entries'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Bulk Delete All Entries in Section ---
  const deleteNetworthEntriesBySection = useCallback(
    async (userId: string, section: string, entryType: "personal" | "business", entryCategory: "asset" | "liability"): Promise<number | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('section', section);
      params.append('entry_type', entryType);
      params.append('entry_category', entryCategory);
      const url = `${NETWORTH_ENDPOINT}bulk-delete-by-section?${params.toString()}`;
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
          } catch (jsonError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data = await response.json();
        setLoading(false);
        return typeof data.deleted_count === 'number' ? data.deleted_count : null;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while bulk deleting section entries'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Rename Section ---
  const renameSectionEntries = useCallback(
    async (
      userId: string, 
      oldSectionName: string, 
      newSectionName: string, 
      entryType: "personal" | "business", 
      entryCategory: "asset" | "liability"
    ): Promise<number | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      const url = `${NETWORTH_ENDPOINT}rename-section?${params.toString()}`;
      
      const bodyPayload = {
        old_section_name: oldSectionName,
        new_section_name: newSectionName,
        entry_type: entryType,
        entry_category: entryCategory,
      };

      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (jsonError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data = await response.json();
        setLoading(false);
        return typeof data.updated_count === 'number' ? data.updated_count : null;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while renaming section'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    addNetworthEntry,
    fetchNetworthEntries,
    fetchNetworthEntryById,
    updateNetworthEntry,
    deleteNetworthEntry,
    deleteNetworthEntriesByNameAndSection,
    deleteNetworthEntriesBySection,
    renameSectionEntries,
    loading,
    error,
  };
}
