import { useState, useCallback } from 'react';
import { Database } from '@/lib/database.types';

// Define the individual bucket list item type
interface BucketItem {
  text: string;
  completed: boolean;
}

// Define the type for the data sent to the API
interface BucketListItemPayload {
  category: string;
  items: BucketItem[];
  sort_order?: number; // Add optional sort_order for new buckets
}

// Define the type for the data received from the API
interface BucketListItemResponse extends BucketListItemPayload {
  id: string;
  sort_order: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Re-using the response type for fetched entries as structure is the same
// Export the type for use in other components
export type FetchedBucketListItem = BucketListItemResponse;

// Define the type for bucket reorder request
interface BucketPositionUpdate {
  bucket_id: string;
  sort_order: number;
}

interface BucketReorderRequest {
  bucket_positions: BucketPositionUpdate[];
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const BUCKET_LIST_ITEMS_ENDPOINT = `${backendApiDomain}/bucket-list-items/`;

export function useBucketListItems() {
  // Separate loading/error states for different actions if needed,
  // or a generic one if actions are typically sequential.
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createBucketListItem = useCallback(
    async (payload: BucketListItemPayload, userId: string): Promise<BucketListItemResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${BUCKET_LIST_ITEMS_ENDPOINT}?user_id=${userId}`, {
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

        const data: BucketListItemResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during bucket list item creation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchUserBucketListItems = useCallback(
    async (userId: string, limit: number = 100, skip: number = 0): Promise<FetchedBucketListItem[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${BUCKET_LIST_ITEMS_ENDPOINT}?user_id=${userId}&skip=${skip}&limit=${limit}`;
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

        const data: FetchedBucketListItem[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching bucket list items'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies, BUCKET_LIST_ITEMS_ENDPOINT is stable within the hook's scope
  );

  const fetchBucketListItemByCategory = useCallback(
    async (userId: string, category: string): Promise<FetchedBucketListItem | null> => {
        setLoading(true);
        setError(null);
        try {
            const url = `${BUCKET_LIST_ITEMS_ENDPOINT}by-category/${encodeURIComponent(category)}?user_id=${userId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                // Handle case where no item is found (e.g., 404 Not Found)
                if (response.status === 404) {
                    setLoading(false);
                    return null; // Return null if no item found for the category
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: FetchedBucketListItem = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching bucket list item by category'));
            setLoading(false);
            return null;
        }
    },
    [] // No dependencies
  );

  const updateBucketListItem = useCallback(
    async (itemId: string, userId: string, updatePayload: Partial<BucketListItemPayload>): Promise<FetchedBucketListItem | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${BUCKET_LIST_ITEMS_ENDPOINT}${itemId}?user_id=${encodeURIComponent(userId)}`;
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

        const data: FetchedBucketListItem = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating bucket list item'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteBucketListItem = useCallback(
    async (itemId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${BUCKET_LIST_ITEMS_ENDPOINT}${itemId}?user_id=${encodeURIComponent(userId)}`;
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
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting bucket list item'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  const reorderBucketListItems = useCallback(
    async (userId: string, bucketPositions: BucketPositionUpdate[]): Promise<FetchedBucketListItem[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${BUCKET_LIST_ITEMS_ENDPOINT}drag-drop-reorder?user_id=${encodeURIComponent(userId)}`;
        const payload: BucketReorderRequest = { bucket_positions: bucketPositions };
        
        console.log('🔗 Making reorder API call:', {
          url,
          method: 'PUT',
          payload: JSON.stringify(payload, null, 2)
        });
        
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('📡 API Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
          } catch (parseError) {
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
          }
        }

        const responseText = await response.text();
        console.log('📄 Raw API Response:', responseText);
        
        const data: FetchedBucketListItem[] = JSON.parse(responseText);
        console.log('✅ Parsed API Response:', data);
        
        setLoading(false);
        return data;
      } catch (err) {
        console.error('❌ Service error:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while reordering bucket list items'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    createBucketListItem,
    fetchUserBucketListItems,
    fetchBucketListItemByCategory, // Expose the new function
    updateBucketListItem,
    deleteBucketListItem,
    reorderBucketListItems,
    loading,
    error,
  };
} 