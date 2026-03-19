import { useState, useCallback } from 'react';

// Types for emotion statistics
export interface EmotionSession {
  session_id: string;
  emotion: string;
  summary: string;
  created_at: string;
}

export interface EmotionStat {
  user_id: string;
  emotion: string;
  session_count: number;
  summary_all: string;
  created_at: string;
}

export interface EmotionBubbleData {
  emotion: string;
  entryCount: number;
  sessions: EmotionSession[];
}

export interface EmotionStatsResponse {
  emotions: EmotionBubbleData[];
  totalSessions: number;
}

// Time filter types
export type TimeFilter = 'weekly' | 'monthly' | 'yearly';

// API configuration
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

export function useEmotionStats() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Get user emotion statistics with time filtering
  const getEmotionStats = useCallback(
    async (userId: string, timeFilter: TimeFilter = 'monthly'): Promise<EmotionStatsResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        // Get aggregated emotion stats
        const statsUrl = `${backendApiDomain}/ai-journal-user-emotion-stats/user/${userId}`;
        const statsResponse = await fetch(statsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!statsResponse.ok) {
          const errorData = await statsResponse.json();
          throw new Error(errorData.detail || `HTTP error! status: ${statsResponse.status}`);
        }

        const emotionStats: EmotionStat[] = await statsResponse.json();

        // Get individual emotion sessions for detailed data
        const sessionsUrl = `${backendApiDomain}/ai-journal-emotions/user/${userId}`;
        const sessionsResponse = await fetch(sessionsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!sessionsResponse.ok) {
          const errorData = await sessionsResponse.json();
          throw new Error(errorData.detail || `HTTP error! status: ${sessionsResponse.status}`);
        }

        const emotionSessions: EmotionSession[] = await sessionsResponse.json();

        // Filter sessions by time range
        const now = new Date();
        const filteredSessions = emotionSessions.filter(session => {
          const sessionDate = new Date(session.created_at);
          const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          switch (timeFilter) {
            case 'weekly':
              return daysDiff <= 7;
            case 'monthly':
              return daysDiff <= 30;
            case 'yearly':
              return daysDiff <= 365;
            default:
              return true;
          }
        });

        // Group sessions by emotion and count them
        const emotionGroups: Record<string, EmotionSession[]> = {};
        filteredSessions.forEach(session => {
          if (!emotionGroups[session.emotion]) {
            emotionGroups[session.emotion] = [];
          }
          emotionGroups[session.emotion].push(session);
        });

        // Convert to bubble data format
        const emotions: EmotionBubbleData[] = Object.entries(emotionGroups).map(([emotion, sessions]) => ({
          emotion,
          entryCount: sessions.length,
          sessions: sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }));

        // Sort by entry count (descending) and limit to top 10 emotions
        const sortedEmotions = emotions.sort((a, b) => b.entryCount - a.entryCount);
        const top10Emotions = sortedEmotions.slice(0, 10);

        const result: EmotionStatsResponse = {
          emotions: top10Emotions,
          totalSessions: filteredSessions.length
        };

        setLoading(false);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching emotion stats'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get aggregated emotion summary analysis
  const getEmotionSummary = useCallback(
    async (userId: string, emotion: string): Promise<EmotionStat | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendApiDomain}/ai-journal-user-emotion-stats/user/${userId}/emotion/${emotion}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const emotionStat: EmotionStat = await response.json();
        setLoading(false);
        return emotionStat;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching emotion summary'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get individual emotion sessions for a specific emotion
  const getEmotionSessions = useCallback(
    async (userId: string, emotion: string, timeFilter: TimeFilter = 'monthly'): Promise<EmotionSession[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendApiDomain}/ai-journal-emotions/user/${userId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const allSessions: EmotionSession[] = await response.json();
        
        // Filter by emotion and time range
        const now = new Date();
        const filteredSessions = allSessions.filter(session => {
          const sessionDate = new Date(session.created_at);
          const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Filter by emotion
          if (session.emotion !== emotion) {
            return false;
          }

          // Filter by time
          switch (timeFilter) {
            case 'weekly':
              return daysDiff <= 7;
            case 'monthly':
              return daysDiff <= 30;
            case 'yearly':
              return daysDiff <= 365;
            default:
              return true;
          }
        });

        // Sort by date (most recent first)
        const sortedSessions = filteredSessions.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setLoading(false);
        return sortedSessions;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching emotion sessions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    getEmotionStats,
    getEmotionSummary,
    getEmotionSessions,
    loading,
    error,
  };
}