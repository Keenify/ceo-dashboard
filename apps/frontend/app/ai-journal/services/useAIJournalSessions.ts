import { useState, useCallback } from 'react';

// Define types for AI journal data structures
export interface AIJournalSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  messages?: AIJournalMessage[];
  analysis?: AIJournalAnalysis;
  artworks?: AIJournalArtwork[];
}

export interface AIJournalMessage {
  id: string;
  session_id: string;
  sender: 'user' | 'ai';
  content: string;
  seq: number;
  created_at: string;
}

export interface AIJournalAnalysis {
  session_id: string;
  summary_md: string;
  emotions: Record<string, number>;
  model: string;
  created_at: string;
}

export interface AIJournalArtwork {
  id: string;
  session_id: string;
  image_path: string;
  style: string;
  created_at: string;
}

export interface AIJournalSessionSummary {
  id: string;
  started_at: string;
  ended_at?: string;
  message_count: number;
  has_analysis: boolean;
  has_artworks: boolean;
}

export interface AIJournalDashboardData {
  total_sessions: number;
  sessions_this_week: number;
  sessions_this_month: number;
  recent_sessions: AIJournalSessionSummary[];
  common_emotions: Record<string, number>;
}

// API configuration
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const AI_JOURNAL_ENDPOINT = `${backendApiDomain}/ai-journaling`;

export function useAIJournalSessions() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [endSessionInProgress, setEndSessionInProgress] = useState<Set<string>>(new Set());

  // Create a new session
  const createSession = useCallback(
    async (userId: string): Promise<AIJournalSession | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalSession = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during session creation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get today's session or create one if it doesn't exist
  const getTodaySession = useCallback(
    async (userId: string): Promise<AIJournalSession | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/today?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalSession = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching today\'s session'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Start a new session (ends previous session if exists)
  const startNewSession = useCallback(
    async (userId: string): Promise<AIJournalSession | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/start-new`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalSession = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while starting new session'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get a specific session
  const getSession = useCallback(
    async (sessionId: string, userId: string): Promise<AIJournalSession | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalSession = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching session'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get user sessions
  const getUserSessions = useCallback(
    async (userId: string, limit: number = 20, skip: number = 0): Promise<AIJournalSessionSummary[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${AI_JOURNAL_ENDPOINT}/sessions?user_id=${userId}&skip=${skip}&limit=${limit}`;
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

        const data: AIJournalSessionSummary[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching sessions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // End a session
  const endSession = useCallback(
    async (sessionId: string, userId: string): Promise<AIJournalSession | null> => {
      // Check if this session is already being ended
      const sessionKey = `${sessionId}_${userId}`;
      if (endSessionInProgress.has(sessionKey)) {
        console.log(`⚠️ End session already in progress for ${sessionKey}, skipping duplicate call`);
        return null;
      }

      setLoading(true);
      setError(null);
      
      // Mark this session as being ended
      setEndSessionInProgress(prev => new Set([...Array.from(prev), sessionKey]));
      
      try {
        console.log(`🔚 Calling endSession API for session ${sessionId}`);
        
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}/end?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        console.log(`📡 EndSession API response status: ${response.status}`);

        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
          }
          
          console.error(`❌ EndSession API failed: ${errorDetail}`);
          throw new Error(errorDetail);
        }

        const data: AIJournalSession = await response.json();
        console.log(`✅ EndSession API successful, session ended: ${data.id}`);
        setLoading(false);
        
        // Remove from in-progress set
        setEndSessionInProgress(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(sessionKey);
          return newSet;
        });
        
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while ending session';
        console.error(`❌ EndSession error: ${errorMessage}`);
        setError(new Error(errorMessage));
        setLoading(false);
        
        // Remove from in-progress set even on error
        setEndSessionInProgress(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(sessionKey);
          return newSet;
        });
        
        return null;
      }
    },
    [endSessionInProgress]
  );

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}?user_id=${userId}`, {
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
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting session'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // Get dashboard data
  const getDashboard = useCallback(
    async (userId: string): Promise<AIJournalDashboardData | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/dashboard?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalDashboardData = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching dashboard'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    createSession,
    getTodaySession,
    startNewSession,
    getSession,
    getUserSessions,
    endSession,
    deleteSession,
    getDashboard,
    loading,
    error,
  };
} 