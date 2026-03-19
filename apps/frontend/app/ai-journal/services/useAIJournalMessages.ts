import { useState, useCallback, useRef, useEffect } from 'react';
import { AIJournalMessage } from './useAIJournalSessions';

// API configuration
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const AI_JOURNAL_ENDPOINT = `${backendApiDomain}/ai-journaling`;

// WebSocket message types
export interface WebSocketMessage {
  type: 'user_message' | 'ai_response_chunk' | 'ai_response_complete' | 'error' | 'ping' | 'pong' | 'user_message_received' | 'system';
  content?: string;
  full_content?: string;
  is_complete?: boolean;
  error?: string;
  message?: string;
  timestamp?: string;
  message_id?: string;
}

export function useAIJournalMessages() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  
  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get messages for a session
  const getSessionMessages = useCallback(
    async (sessionId: string, limit: number = 100, skip: number = 0): Promise<AIJournalMessage[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}/messages?skip=${skip}&limit=${limit}`;
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

        const data: AIJournalMessage[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching messages'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Create a message
  const createMessage = useCallback(
    async (sessionId: string, sender: 'user' | 'ai', content: string, seq?: number): Promise<AIJournalMessage | null> => {
      setLoading(true);
      setError(null);
      try {
        const payload: any = { sender, content };
        if (seq !== undefined) payload.seq = seq;

        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}/messages`, {
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

        const data: AIJournalMessage = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating message'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Generate AI response (non-streaming)
  const generateAIResponse = useCallback(
    async (sessionId: string, userMessage: string): Promise<AIJournalMessage | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AI_JOURNAL_ENDPOINT}/sessions/${sessionId}/ai-response?user_message=${encodeURIComponent(userMessage)}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AIJournalMessage = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while generating AI response'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // WebSocket connection management
  const connectWebSocket = useCallback((sessionId: string, userId: string, onMessage?: (message: AIJournalMessage) => void, onStreamChunk?: (chunk: string, fullContent: string, isComplete: boolean, realMessageId?: string) => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clear any existing timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    try {
      const wsUrl = `${AI_JOURNAL_ENDPOINT.replace('http', 'ws')}/sessions/${sessionId}/chat?user_id=${userId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('🔥 Frontend received WebSocket message:', message);
          
          switch (message.type) {
            case 'ai_response_chunk':
              console.log('📱 Processing AI response chunk:', message);
              if (onStreamChunk) {
                setIsStreaming(!message.is_complete);
                if (message.is_complete) {
                  setStreamingContent('');
                } else {
                  setStreamingContent(message.full_content || '');
                }
                console.log('🎬 Calling onStreamChunk with:', {
                  content: message.content,
                  fullContent: message.full_content,
                  isComplete: message.is_complete
                });
                onStreamChunk(message.content || '', message.full_content || '', message.is_complete || false);
              } else {
                console.log('⚠️ onStreamChunk callback not provided');
              }
              break;
            case 'user_message_received':
              console.log('✅ User message acknowledged by server:', message);
              break;
            case 'ai_response_complete':
              console.log('🎯 AI response completed:', message);
              // Pass the real message ID to update streaming messages
              if (onStreamChunk && message.message_id) {
                console.log('🆔 Updating streaming message with real ID:', message.message_id);
                onStreamChunk('', '', true, message.message_id);
              }
              break;
            case 'system':
              console.log('🔧 System message:', message);
              break;
            case 'user_message':
            case 'ai_response_complete':
              if (onMessage && message.content) {
                // Create a mock message object for the callback
                const mockMessage: AIJournalMessage = {
                  id: Date.now().toString(),
                  session_id: sessionId,
                  sender: message.type === 'user_message' ? 'user' : 'ai',
                  content: message.content,
                  seq: 0,
                  created_at: new Date().toISOString()
                };
                onMessage(mockMessage);
              }
              break;
            case 'error':
              setError(new Error(message.error || 'WebSocket error'));
              break;
            case 'pong':
              // Keep-alive response, no action needed
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsStreaming(false);
        setStreamingContent('');

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Clear reconnect timeout to prevent automatic reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Only attempt to reconnect if it wasn't a clean close AND we're not intentionally disconnecting
        if (event.code !== 1000 && event.code !== 1001 && wsRef.current) {
          console.log('WebSocket closed unexpectedly, attempting to reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket(sessionId, userId, onMessage, onStreamChunk);
          }, 3000);
        } else {
          console.log('WebSocket closed cleanly or intentionally disconnected');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError(new Error('Failed to create WebSocket connection'));
    }
  }, []);

  // Send message via WebSocket
  const sendWebSocketMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'user_message',
        content
      };
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      setError(new Error('WebSocket not connected'));
      return false;
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket...');
    
    // Clear ping interval first to stop sending pings
    if (pingIntervalRef.current) {
      console.log('🔌 Clearing ping interval');
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      console.log('🔌 Clearing reconnect timeout');
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      console.log('🔌 Closing WebSocket connection');
      try {
        wsRef.current.close(1000, 'Client disconnecting');
      } catch (error) {
        console.log('🔌 Error closing WebSocket:', error);
      }
      wsRef.current = null;
    }
    
    // Reset all states
    setIsConnected(false);
    setIsStreaming(false);
    setStreamingContent('');
    setError(null);
    
    console.log('🔌 WebSocket disconnection complete');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    getSessionMessages,
    createMessage,
    generateAIResponse,
    connectWebSocket,
    sendWebSocketMessage,
    disconnectWebSocket,
    isConnected,
    isStreaming,
    streamingContent,
    loading,
    error,
  };
} 