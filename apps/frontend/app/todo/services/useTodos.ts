"use client";

import { useState, useCallback } from 'react';

// Define the type for the data sent to the API to create/update a todo
export interface TodoPayload {
  title: string;
  description?: string; // Assuming description is optional
  due_date?: string | null; // YYYY-MM-DD format, now optional
  is_completed?: boolean; // Optional on create, default false
  priority?: number; // Optional on create, default 0
  color_code?: string; // Optional
  user_id: string;
  list_id?: string | null; // Optional list id
  sort_order?: number; // Optional
}

// Define the type for the data received from the API (matches response example)
interface TodoResponse {
  title: string;
  description: string | null;
  due_date: string | null; // Also make optional here to match payload
  is_completed: boolean;
  priority: number;
  color_code: string | null;
  list_id: string | null;
  sort_order: number | null;
  id: string; // UUID for the todo itself
  user_id: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Export the response type for use in components when fetching/displaying todos
export type FetchedTodo = TodoResponse;

// Options for fetching todos
interface FetchTodosOptions {
  afterDate?: string; // YYYY-MM-DD, maps to after_date
  beforeDate?: string; // YYYY-MM-DD, maps to before_date
  listId?: string | null; // Filter by list ID
  skip?: number;
  limit?: number;
  sortOrder?: string; // New: pass sort_order as a string (e.g., 'asc' or 'desc')
}

// Define type for the update payload (subset of TodoPayload, user_id not needed in body)
export interface TodoUpdatePayload {
  title?: string;
  description?: string;
  due_date?: string | null;
  is_completed?: boolean;
  priority?: number;
  color_code?: string | null;
  list_id?: string | null;
  sort_order?: number;
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const TODOS_ENDPOINT = `${backendApiDomain}/todos/`;

export function useTodos() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create Todo --- 
  const addTodo = useCallback(
    async (payload: TodoPayload): Promise<FetchedTodo | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(TODOS_ENDPOINT, {
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

        const data: FetchedTodo = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding todo'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies as endpoint is stable
  );

  // --- Fetch Todos --- 
  const fetchTodos = useCallback(
    async (userId: string, options: FetchTodosOptions = {}): Promise<FetchedTodo[] | null> => {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('user_id', userId);
      // Add list_id or date filters, assuming they are mutually exclusive
      if (options.listId) {
        params.append('list_id', options.listId);
      } else {
        if (options.afterDate) params.append('after_date', options.afterDate);
        if (options.beforeDate) params.append('before_date', options.beforeDate);
      }
      if (options.skip !== undefined) params.append('skip', String(options.skip));
      if (options.limit !== undefined) params.append('limit', String(options.limit));
      if (options.sortOrder !== undefined) params.append('sort_order', options.sortOrder);
      
      const url = `${TODOS_ENDPOINT}?${params.toString()}`;
      console.log(`Fetching todos from ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
           // Handle 404 specifically maybe? Or just let error bubble up.
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedTodo[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching todos'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies as endpoint is stable
  );
  
  // --- Update Todo --- 
  const updateTodo = useCallback(
      async (todoId: string, userId: string, updatePayload: TodoUpdatePayload): Promise<FetchedTodo | null> => {
          setLoading(true);
          setError(null);
          // Add user_id as a query parameter
          const url = `${TODOS_ENDPOINT}${todoId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Updating todo ${todoId} at ${url}`);
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
              const data: FetchedTodo = await response.json();
              setLoading(false);
              return data;
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while updating todo'));
              setLoading(false);
              return null;
          }
      },
      [] // Endpoint is stable
  );

  // --- Delete Todo --- 
  const deleteTodo = useCallback(
      async (todoId: string, userId: string): Promise<boolean> => {
          setLoading(true);
          setError(null);
          // Add user_id as a query parameter
          const url = `${TODOS_ENDPOINT}${todoId}?user_id=${encodeURIComponent(userId)}`;
          console.log(`Deleting todo ${todoId} at ${url}`);
          try {
              const response = await fetch(url, { 
                 method: 'DELETE', 
                 headers: { 'Accept': 'application/json' } // No Content-Type needed for DELETE
              });
              
              // Check for successful status codes (200 OK or 204 No Content)
              // Your API returns the deleted object on 200 OK according to the example.
              if (response.ok) { 
                  setLoading(false);
                  return true;
              } else {
                  // Attempt to parse error JSON, fallback if parsing fails or no body
                  let errorDetail = `HTTP error! status: ${response.status}`;
                  try {
                       const errorData = await response.json();
                       errorDetail = errorData.detail || errorDetail;
                  } catch (parseError) {
                      // Ignore parsing error, use default status error
                  }
                  throw new Error(errorDetail);
              }
          } catch (err) {
              setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting todo'));
              setLoading(false);
              return false;
          }
      },
      [] // Endpoint is stable
  );

  return {
    addTodo,
    fetchTodos,
    updateTodo,
    deleteTodo,
    loading,
    error,
  };
}
