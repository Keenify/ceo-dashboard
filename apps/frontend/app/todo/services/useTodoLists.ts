"use client";

import { useState, useCallback } from 'react';

// Define the type for the data sent to the API to create a todo list
export interface TodoListPayload {
  name: string;
  user_id: string;
  tab_id: string; // Assuming lists belong to tabs
}

// Define the type for the data received from the API
interface TodoListResponse {
  name: string;
  id: string; // UUID for the todo list
  user_id: string;
  tab_id: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Export the response type for use in components
export type FetchedTodoList = TodoListResponse;

// Options for fetching todo lists (potentially by tab)
interface FetchTodoListsOptions {
  tab_id?: string; // Filter by tab ID
  skip?: number;
  limit?: number;
}

// Define type for the update payload
export interface TodoListUpdatePayload {
  name?: string; // Allow updating only the name for now
  tab_id?: string; // Potentially allow moving list between tabs
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const TODO_LISTS_ENDPOINT = `${backendApiDomain}/todo-lists/`;

export function useTodoLists() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create Todo List ---
  const addTodoList = useCallback(
    async (payload: TodoListPayload): Promise<FetchedTodoList | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(TODO_LISTS_ENDPOINT, {
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

        const data: FetchedTodoList = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding todo list'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch Todo Lists (by User and optionally Tab) ---
  const fetchTodoLists = useCallback(
    async (userId: string, options: FetchTodoListsOptions = {}): Promise<FetchedTodoList[] | null> => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('user_id', userId);
      if (options.tab_id) params.append('tab_id', options.tab_id);
      if (options.skip !== undefined) params.append('skip', String(options.skip));
      if (options.limit !== undefined) params.append('limit', String(options.limit));

      const url = `${TODO_LISTS_ENDPOINT}?${params.toString()}`;
      console.log(`Fetching todo lists from ${url}`);

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

        const data: FetchedTodoList[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching todo lists'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch Todo List by ID ---
  const fetchTodoListById = useCallback(
    async (listId: string, userId: string): Promise<FetchedTodoList | null> => {
      setLoading(true);
      setError(null);
      const url = `${TODO_LISTS_ENDPOINT}${listId}?user_id=${encodeURIComponent(userId)}`;
      console.log(`Fetching todo list ${listId} from ${url}`);

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

        const data: FetchedTodoList = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching todo list by ID'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update Todo List ---
  const updateTodoList = useCallback(
      async (listId: string, userId: string, updatePayload: TodoListUpdatePayload): Promise<FetchedTodoList | null> => {
          setLoading(true);
          setError(null);
          const url = `${TODO_LISTS_ENDPOINT}${listId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Updating todo list ${listId} at ${url}`);
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
              const data: FetchedTodoList = await response.json();
              setLoading(false);
              return data;
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while updating todo list'));
              setLoading(false);
              return null;
          }
      },
      []
  );

  // --- Delete Todo List ---
  const deleteTodoList = useCallback(
      async (listId: string, userId: string): Promise<boolean> => {
          setLoading(true);
          setError(null);
          const url = `${TODO_LISTS_ENDPOINT}${listId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Deleting todo list ${listId} at ${url}`);
          try {
              const response = await fetch(url, {
                 method: 'DELETE',
                 headers: { 'Accept': 'application/json' }
              });

              if (response.ok) { 
                  setLoading(false);
                  return true;
              } else {
                  let errorDetail = `HTTP error! status: ${response.status}`;
                  try {
                       const errorData = await response.json();
                       errorDetail = errorData.detail || errorDetail;
                  } catch (parseError) { /* Ignore */ }
                  throw new Error(errorDetail);
              }
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting todo list'));
              setLoading(false);
              return false;
          }
      },
      []
  );

  return {
    addTodoList,
    fetchTodoLists,
    fetchTodoListById,
    updateTodoList,
    deleteTodoList,
    loading,
    error,
  };
}
