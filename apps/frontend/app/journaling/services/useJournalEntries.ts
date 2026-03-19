import { useState, useCallback } from 'react';

// Define the type for the data sent to the API
interface JournalEntryPayload {
  question_id: number;
  entry_date: string; // Assuming date is sent as YYYY-MM-DD string
  answer: string;
  user_id: string;
  template_id: string; // Added template_id support
}

// Define the type for the data received from the API
interface JournalEntryResponse extends JournalEntryPayload {
  id: number;
  created_at: string; // Assuming ISO date string
}

// Re-using the response type for fetched entries as structure is the same
// Export the type for use in other components
export type FetchedJournalEntry = JournalEntryResponse;

// New interface for bulk upsert - matches backend schema
interface JournalEntryBulkUpsert {
  user_id: string;
  template_id: string;
  entry_date: string;
  answers: { [key: number]: string }; // Dictionary mapping question_id to answer
}

// Read the backend API domain from environment variables
// Note: NEXT_BACKEND_API_DOMAIN might not be available client-side by default.
// Consider using NEXT_PUBLIC_BACKEND_API_DOMAIN if this runs in the browser.
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const JOURNAL_ENTRIES_ENDPOINT = `${backendApiDomain}/journal-entries/`;

export function useJournalEntries() {
  // Separate loading/error states for different actions if needed,
  // or a generic one if actions are typically sequential.
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const upsertJournalEntry = useCallback(
    async (payload: JournalEntryPayload): Promise<JournalEntryResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(JOURNAL_ENTRIES_ENDPOINT, {
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

        const data: JournalEntryResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during upsert'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // New bulk upsert function for better performance
  const bulkUpsertJournalEntries = useCallback(
    async (payload: JournalEntryBulkUpsert): Promise<JournalEntryResponse[] | null> => {
      setLoading(true);
      setError(null);
      try {
        console.log('Making bulk upsert request to:', `${JOURNAL_ENTRIES_ENDPOINT}bulk`);
        console.log('Request payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${JOURNAL_ENTRIES_ENDPOINT}bulk`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            console.log('Error response data:', JSON.stringify(errorData, null, 2));
          } catch (parseError) {
            console.log('Could not parse error response as JSON:', parseError);
            errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
          }
          
          // Enhanced error message extraction for 422 validation errors
          let errorMessage = `HTTP error! status: ${response.status}`;
          
          if (errorData) {
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (errorData.detail) {
              if (Array.isArray(errorData.detail)) {
                // Handle FastAPI validation errors
                const validationErrors = errorData.detail.map((err: any) => {
                  if (err.loc && err.msg) {
                    return `${err.loc.join('.')}: ${err.msg}`;
                  }
                  return JSON.stringify(err);
                }).join(', ');
                errorMessage = `Validation errors: ${validationErrors}`;
              } else {
                errorMessage = errorData.detail;
              }
            } else if (errorData.message) {
              errorMessage = errorData.message;
            } else {
              errorMessage = `${errorMessage} - ${JSON.stringify(errorData)}`;
            }
          }
          
          throw new Error(errorMessage);
        }

        const data: JournalEntryResponse[] = await response.json();
        console.log('Success response data:', data);
        setLoading(false);
        return data;
      } catch (err) {
        console.error('Bulk upsert error:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred during bulk upsert'));
        setLoading(false);
        throw err; // Re-throw so the calling function can handle it
      }
    },
    []
  );

  const fetchUserJournalEntries = useCallback(
    async (userId: string, limit: number = 500, skip: number = 0): Promise<FetchedJournalEntry[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}?skip=${skip}&limit=${limit}`;
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

        const data: FetchedJournalEntry[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entries'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies, JOURNAL_ENTRIES_ENDPOINT is stable within the hook's scope
  );

  const fetchUserJournalEntriesByDate = useCallback(
    async (userId: string, date: string): Promise<FetchedJournalEntry[] | null> => {
        // Ensure date is in YYYY-MM-DD format if not already
        // const formattedDate = format(new Date(date), 'yyyy-MM-dd'); // Or use a date library
        setLoading(true);
        setError(null);
        try {
            const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}/date/${date}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                // Handle case where no entries are found (e.g., 404 Not Found)
                if (response.status === 404) {
                    setLoading(false);
                    return []; // Return empty array if no entries found for the date
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: FetchedJournalEntry[] = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entries by date'));
            setLoading(false);
            return null;
        }
    },
    [] // No dependencies
  );

  // New function to fetch entries by user and template
  const fetchUserJournalEntriesByTemplate = useCallback(
    async (userId: string, templateId: string, limit: number = 100, skip: number = 0): Promise<FetchedJournalEntry[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}/template/${templateId}?skip=${skip}&limit=${limit}`;
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

        const data: FetchedJournalEntry[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entries by template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // New function to fetch entries by user, template, and date
  const fetchUserJournalEntriesByTemplateAndDate = useCallback(
    async (userId: string, templateId: string, date: string): Promise<FetchedJournalEntry[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}/template/${templateId}/date/${date}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLoading(false);
            return []; // Return empty array if no entries found
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FetchedJournalEntry[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entries by template and date'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // New function to get entry dates for a user
  const fetchUserEntryDates = useCallback(
    async (userId: string): Promise<string[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}/dates`;
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

        const data: string[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entry dates'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // New function to get entry dates for a user and template
  const fetchUserEntryDatesByTemplate = useCallback(
    async (userId: string, templateId: string): Promise<string[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${JOURNAL_ENTRIES_ENDPOINT}user/${userId}/template/${templateId}/dates`;
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

        const data: string[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching entry dates by template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Delete a specific entry
  const deleteJournalEntry = useCallback(
    async (entryId: number): Promise<JournalEntryResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${JOURNAL_ENTRIES_ENDPOINT}${entryId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalEntryResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    upsertJournalEntry,
    bulkUpsertJournalEntries,
    fetchUserJournalEntries,
    fetchUserJournalEntriesByDate,
    fetchUserJournalEntriesByTemplate,
    fetchUserJournalEntriesByTemplateAndDate,
    fetchUserEntryDates,
    fetchUserEntryDatesByTemplate,
    deleteJournalEntry,
    loading,
    error,
  };
}
