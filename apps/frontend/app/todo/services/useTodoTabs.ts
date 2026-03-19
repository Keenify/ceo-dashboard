"use client";

import { useState, useCallback } from 'react';

// Define the type for the data sent to the API to create a todo tab
export interface TodoTabPayload {
  name: string;
  user_id: string;
}

// Define the type for the data received from the API (matches response examples)
interface TodoTabResponse {
  name: string;
  id: string; // UUID for the todo tab
  user_id: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Export the response type for use in components
export type FetchedTodoTab = TodoTabResponse;

// Options for fetching todo tabs (similar to useTodos)
interface FetchTodoTabsOptions {
  skip?: number;
  limit?: number;
}

// Define type for the update payload
export interface TodoTabUpdatePayload {
  name: string;
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const TODO_TABS_ENDPOINT = `${backendApiDomain}/todo-tabs/`;

export function useTodoTabs() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create Todo Tab ---
  const addTodoTab = useCallback(
    async (payload: TodoTabPayload): Promise<FetchedTodoTab | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(TODO_TABS_ENDPOINT, {
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

        const data: FetchedTodoTab = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding todo tab'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies as endpoint is stable
  );

  // --- Fetch Todo Tabs by User ---
  const fetchTodoTabs = useCallback(
    async (userId: string, options: FetchTodoTabsOptions = {}): Promise<FetchedTodoTab[] | null> => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('user_id', userId);
      if (options.skip !== undefined) params.append('skip', String(options.skip));
      if (options.limit !== undefined) params.append('limit', String(options.limit));

      const url = `${TODO_TABS_ENDPOINT}?${params.toString()}`;
      console.log(`Fetching todo tabs from ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedTodoTab[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching todo tabs'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies as endpoint is stable
  );

  // --- Fetch Todo Tab by ID and User ---
  const fetchTodoTabById = useCallback(
    async (tabId: string, userId: string): Promise<FetchedTodoTab | null> => {
      setLoading(true);
      setError(null);
      const url = `${TODO_TABS_ENDPOINT}${tabId}?user_id=${encodeURIComponent(userId)}`;
      console.log(`Fetching todo tab ${tabId} from ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedTodoTab = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching todo tab by ID'));
        setLoading(false);
        return null;
      }
    },
    [] // Endpoint is stable
  );

  // --- Update Todo Tab ---
  const updateTodoTab = useCallback(
      async (tabId: string, userId: string, updatePayload: TodoTabUpdatePayload): Promise<FetchedTodoTab | null> => {
          setLoading(true);
          setError(null);
          const url = `${TODO_TABS_ENDPOINT}${tabId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Updating todo tab ${tabId} at ${url}`);
          try {
              const response = await fetch(url, {
                  method: 'PUT',
                  headers: {
                     'Accept': 'application/json',
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(updatePayload)
              });
              if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
              }
              const data: FetchedTodoTab = await response.json();
              setLoading(false);
              return data;
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while updating todo tab'));
              setLoading(false);
              return null;
          }
      },
      [] // Endpoint is stable
  );

  // --- Delete Todo Tab ---
  const deleteTodoTab = useCallback(
      async (tabId: string, userId: string): Promise<boolean> => {
          setLoading(true);
          setError(null);
          const url = `${TODO_TABS_ENDPOINT}${tabId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Deleting todo tab ${tabId} at ${url}`);
          try {
              const response = await fetch(url, {
                 method: 'DELETE',
                 headers: { 'Accept': 'application/json' }
              });

              if (response.ok) { // API returns the deleted object on 200 OK
                  setLoading(false);
                  return true;
              } else {
                  let errorDetail = `HTTP error! status: ${response.status}`;
                  try {
                       const errorData = await response.json();
                       errorDetail = errorData.detail || errorDetail;
                  } catch (parseError) {
                      // Ignore parsing error
                  }
                  throw new Error(errorDetail);
              }
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting todo tab'));
              setLoading(false);
              return false;
          }
      },
      [] // Endpoint is stable
  );

  return {
    addTodoTab,
    fetchTodoTabs,
    fetchTodoTabById,
    updateTodoTab,
    deleteTodoTab,
    loading,
    error,
  };
}
