import { useState, useCallback } from 'react';
import { Database } from '@/lib/database.types';

// Define the type for individual ikigai sections
interface IkigaiSection {
  title: string;
  description: string;
}

// Define the type for the ikigai data structure (extended version with all 9 regions)
interface IkigaiData {
  // Original 4 intersections
  mission: IkigaiSection;    // What the world needs & what you're good at
  passion: IkigaiSection;    // What you love & what you're good at  
  profession: IkigaiSection; // What you're good at & what you can be paid for
  vocation: IkigaiSection;   // What you love & what the world needs
  
  // 4 core circles
  love?: IkigaiSection;      // What You Love
  good_at?: IkigaiSection;   // What You're Good At
  world_needs?: IkigaiSection; // What the World Needs
  paid_for?: IkigaiSection;  // What You Can Be Paid For
  
  // Center intersection
  ikigai?: IkigaiSection;    // Your Ikigai (center)
}

// Define the type for the data sent to the API
interface IkigaiPayload {
  user_id: string;
  ikigai_data: IkigaiData;
}

// Define the type for the data received from the API
interface IkigaiResponse extends IkigaiPayload {
  id: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Export the types for use in other components
export type { IkigaiData, IkigaiSection };
export type FetchedIkigai = IkigaiResponse;

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const IKIGAI_ENDPOINT = `${backendApiDomain}/ikigai/`;

export function useIkigai() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createIkigai = useCallback(
    async (payload: IkigaiPayload): Promise<IkigaiResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(IKIGAI_ENDPOINT, {
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

        const data: IkigaiResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during ikigai creation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchUserIkigai = useCallback(
    async (userId: string): Promise<FetchedIkigai | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${IKIGAI_ENDPOINT}user/${userId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          // Handle case where no ikigai is found (e.g., 404 Not Found)
          if (response.status === 404) {
            setLoading(false);
            return null; // Return null if no ikigai found for the user
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedIkigai = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching ikigai'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchIkigaiById = useCallback(
    async (ikigaiId: string, userId: string): Promise<FetchedIkigai | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${IKIGAI_ENDPOINT}${ikigaiId}?user_id=${userId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLoading(false);
            return null;
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedIkigai = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching ikigai by ID'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const updateIkigai = useCallback(
    async (ikigaiId: string, userId: string, updatePayload: Partial<IkigaiData>): Promise<FetchedIkigai | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${IKIGAI_ENDPOINT}${ikigaiId}?user_id=${encodeURIComponent(userId)}`;
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ikigai_data: updatePayload }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedIkigai = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating ikigai'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteIkigai = useCallback(
    async (ikigaiId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${IKIGAI_ENDPOINT}${ikigaiId}?user_id=${encodeURIComponent(userId)}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          setLoading(false);
          return true;
        } else {
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
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting ikigai'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  const upsertIkigai = useCallback(
    async (userId: string, ikigaiData: IkigaiData): Promise<FetchedIkigai | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${IKIGAI_ENDPOINT}upsert/${userId}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ikigaiData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedIkigai = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while upserting ikigai'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    createIkigai,
    fetchUserIkigai,
    fetchIkigaiById,
    updateIkigai,
    deleteIkigai,
    upsertIkigai,
    loading,
    error,
  };
}
