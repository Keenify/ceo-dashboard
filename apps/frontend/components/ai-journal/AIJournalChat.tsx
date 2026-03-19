"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
// Removed Card components for diary-style design
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
// ScrollArea component replaced with regular scrollable div
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Brain,
  StopCircle,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAIJournalSessions, AIJournalSession, AIJournalMessage } from '@/app/ai-journal/services/useAIJournalSessions';
import { useAIJournalMessages } from '@/app/ai-journal/services/useAIJournalMessages';
import { toast } from 'sonner';
import { ExpandableEmotion } from './ExpandableEmotion';

// API configuration
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

interface AIJournalChatProps {
  sessionId: string;
  userId: string;
  onBack?: () => void;
}

interface DisplayMessage extends AIJournalMessage {
  isStreaming?: boolean;
  streamContent?: string;
}

export function AIJournalChat({ sessionId, userId, onBack }: AIJournalChatProps) {
  const [session, setSession] = useState<AIJournalSession | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [isContinuingSession, setIsContinuingSession] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshingMessageId, setRefreshingMessageId] = useState<string | null>(null);
  const [lastRefreshedId, setLastRefreshedId] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [isEndSessionInProgress, setIsEndSessionInProgress] = useState(false);
  const endSessionInProgressRef = useRef(false);
  const [sessionEndedLocally, setSessionEndedLocally] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    getSession,
    endSession,
    loading: sessionLoading
  } = useAIJournalSessions();

  const {
    getSessionMessages,
    connectWebSocket,
    sendWebSocketMessage,
    disconnectWebSocket,
    isConnected,
    isStreaming,
    loading: messagesLoading
  } = useAIJournalMessages();

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);

  // Scroll to show ONLY the latest user message and AI response
  const scrollToLatestMessages = useCallback(() => {
    if (messages.length === 0) return;
    
    // Find the last user message and last AI message
    let lastUserIndex = -1;
    let lastAIIndex = -1;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user' && lastUserIndex === -1) {
        lastUserIndex = i;
      }
      if (messages[i].sender === 'ai' && lastAIIndex === -1) {
        lastAIIndex = i;
      }
      
      // Stop once we found both
      if (lastUserIndex !== -1 && lastAIIndex !== -1) {
        break;
      }
    }
    
    // For the first exchange or when we have both user and AI messages, 
    // position to show both messages comfortably
    const targetIndex = lastUserIndex !== -1 ? lastUserIndex : (lastAIIndex !== -1 ? lastAIIndex : messages.length - 1);
    
    const messageElements = document.querySelectorAll('[data-message-index]');
    const targetElement = messageElements[targetIndex] as HTMLElement;
    
    if (targetElement) {
      // Use 'center' to ensure both user and AI messages are visible
      // This positions the user message in the center of the viewport
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center', // Center the user message so AI response is visible below
        inline: 'nearest'
      });
    } else {
      // Fallback to bottom scroll
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        });
      }
    }
  }, [messages]);

  // Load session and messages
  useEffect(() => {
    // Reset local session ended flag when loading new session
    setSessionEndedLocally(false);
    
    const loadSessionData = async () => {
      console.log('📥 Loading session data for session:', sessionId);
      
      // Load session details with analysis
      const sessionData = await getSession(sessionId, userId);
      if (sessionData) {
        console.log('✅ Session loaded:', sessionData.id, 'ended_at:', sessionData.ended_at);
        setSession(sessionData);
        
        // Disconnect WebSocket if session is already ended
        if (sessionData.ended_at) {
          console.log('🔌 Session already ended, disconnecting WebSocket');
          disconnectWebSocket();
        }
      }

      // Load existing messages
      const messagesData = await getSessionMessages(sessionId);
      if (messagesData) {
        console.log('📝 Messages loaded:', messagesData.length);
        const processedMessages = messagesData.map(msg => ({ ...msg, isStreaming: false }));
        
        // Sort by creation time to ensure proper order
        processedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        setMessages(processedMessages);
        
        // Clean up any old localStorage entries for this session
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('refreshed_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Handle scrolling based on session state
        setTimeout(() => {
          if (sessionData?.ended_at) {
            // For completed sessions, scroll to top to show summary first
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (processedMessages.length > 0) {
            // For active sessions, scroll to show latest conversation
            scrollToLatestMessages();
          }
          
          // Mark initial load as complete
          setIsInitialLoad(false);
        }, 200);
      } else {
        console.log('📝 No messages found for session');
        setMessages([]);
        setIsInitialLoad(false);
      }
    };

    loadSessionData();
  }, [sessionId, userId, getSession, getSessionMessages]);

  // Setup WebSocket connection
  useEffect(() => {
    // Disconnect WebSocket if session is ended
    if (session?.ended_at || sessionEndedLocally) {
      console.log('🔌 Session ended, disconnecting WebSocket');
      disconnectWebSocket();
      return;
    }

    const handleNewMessage = (message: AIJournalMessage) => {
      setMessages(prev => {
        // Check if message already exists by ID
        const existsById = prev.some(m => m.id === message.id);
        if (existsById) {
          return prev;
        }
        
        // For AI messages, also check for content similarity to prevent duplicates
        if (message.sender === 'ai') {
          const recentAIMessages = prev.slice(-3).filter(m => m.sender === 'ai');
          const isDuplicateContent = recentAIMessages.some(prevMsg => {
            return message.content.length > 50 && prevMsg.content.length > 50 &&
                   (message.content === prevMsg.content || 
                    message.content.substring(0, 100) === prevMsg.content.substring(0, 100));
          });
          
          if (isDuplicateContent) {
            return prev;
          }
          
          // Focus input after AI response completes
          setTimeout(() => {
            inputRef.current?.focus();
          }, 500);
          
          // If this is an AI response in a continued session, trigger analysis update
          if (session?.analysis && !session?.ended_at) {
            console.log('🔄 Triggering analysis update for continued session');
            setTimeout(() => {
              handleRegenerateAnalysis();
            }, 2000); // Wait 2 seconds after AI response to regenerate analysis
          }
        }
        
        return [...prev, { ...message, isStreaming: false }];
      });
    };

    const handleStreamChunk = (chunk: string, fullContent: string, isComplete: boolean, realMessageId?: string) => {
      console.log('🎯 handleStreamChunk called:', { chunk, fullContent, isComplete, realMessageId });
      setMessages(prev => {
        console.log('📋 Current messages before update:', prev.length);
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        
        // Special case: If we have a real message ID, update the streaming message with it
        if (realMessageId && isComplete) {
          const streamingMessageIndex = newMessages.findIndex(msg => 
            msg.sender === 'ai' && 
            (msg.isStreaming || msg.id.startsWith('streaming-') || msg.id.startsWith('final-'))
          );
          
          if (streamingMessageIndex !== -1) {
            const streamingMessage = newMessages[streamingMessageIndex];
            console.log('🆔 Updating message ID from', streamingMessage.id, 'to', realMessageId);
            newMessages[streamingMessageIndex] = {
              ...streamingMessage,
              id: realMessageId,
              isStreaming: false,
              content: streamingMessage.streamContent || streamingMessage.content
            };
            
            // Focus input when AI streaming completes
            setTimeout(() => {
              inputRef.current?.focus();
            }, 300);
            
            return newMessages;
          }
        }
        
        // Check if we have an existing streaming message
        const hasStreamingMessage = lastIndex >= 0 && 
          newMessages[lastIndex].sender === 'ai' && 
          newMessages[lastIndex].isStreaming;
        
        if (hasStreamingMessage) {
          // Update existing streaming message
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            streamContent: fullContent,
            content: isComplete ? fullContent : newMessages[lastIndex].content,
            isStreaming: !isComplete
          };
          
          // Focus input when streaming completes
          if (isComplete) {
            setTimeout(() => {
              inputRef.current?.focus();
            }, 300);
          }
        } else if (!isComplete && fullContent.trim()) {
          // Create new streaming message only if we have content and it's not complete
          const streamingMessage: DisplayMessage = {
            id: `streaming-${Date.now()}`,
            session_id: sessionId,
            sender: 'ai',
            content: '',
            streamContent: fullContent,
            seq: newMessages.length + 1,
            created_at: new Date().toISOString(),
            isStreaming: true
          };
          newMessages.push(streamingMessage);
        } else if (isComplete && fullContent.trim()) {
          // Create final message directly if complete and no streaming message exists
          const finalMessage: DisplayMessage = {
            id: `final-${Date.now()}`,
            session_id: sessionId,
            sender: 'ai',
            content: fullContent,
            seq: newMessages.length + 1,
            created_at: new Date().toISOString(),
            isStreaming: false
          };
          newMessages.push(finalMessage);
          
          // Focus input when AI response completes
          setTimeout(() => {
            inputRef.current?.focus();
          }, 300);
        }
        
        return newMessages;
      });
    };

    // Only connect WebSocket if session is not ended
    if (!session?.ended_at && !sessionEndedLocally) {
      console.log('🔌 Connecting WebSocket for active session');
      connectWebSocket(sessionId, userId, handleNewMessage, handleStreamChunk);
    } else {
      console.log('🔌 Session already ended, skipping WebSocket connection');
    }
  }, [session?.ended_at, sessionEndedLocally, sessionId, userId, connectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endSessionInProgressRef.current = false;
      // Ensure WebSocket is disconnected on unmount
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  // Simple autoscroll - just show latest user + AI messages
  useEffect(() => {
    const isSessionEnded = session?.ended_at;
    
    // Don't scroll during initial load - that's handled in loadSessionData
    if (isInitialLoad || isSessionEnded || messages.length === 0) {
      return;
    }
    
    // Always scroll to show the latest messages
    setTimeout(() => {
      scrollToLatestMessages();
    }, 100);
  }, [messages, scrollToLatestMessages, session, isInitialLoad]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle input changes and typing detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Set typing state
    setIsTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to detect when user stops typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 6000); // 6 seconds after user stops typing
  };

  // Handle input focus/blur events
  const handleInputFocus = () => {
    // Don't change typing state on focus, let typing detection handle it
  };

  const handleInputBlur = () => {
    // User moved cursor away from input, show buttons
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle cursor movement (selection change)
  const handleSelectionChange = () => {
    // Only show buttons if input is focused and user is not actively typing
    if (document.activeElement === inputRef.current && !isTyping) {
      setIsTyping(false);
    }
  };

  // Add selection change listener
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isTyping]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to build context for message refresh
  const buildContextForRefresh = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return [];
    
    // Get all messages UP TO (but not including) the message being refreshed
    return messages.slice(0, messageIndex);
  }, [messages]);

  // Helper function to update message content in place
  const updateMessageContent = useCallback((messageId: string, newContent: string, isRefreshing = false) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, isStreaming: isRefreshing, streamContent: isRefreshing ? newContent : undefined }
          : msg
      )
    );
  }, []);

  // Handle refreshing a specific AI message
  const handleRefreshMessage = useCallback(async (messageId: string, retryAttempt = 0) => {
    // Debouncing: prevent rapid clicks (500ms cooldown)
    const now = Date.now();
    if (now - lastClickTime < 500) {
      return;
    }
    setLastClickTime(now);

    // Prevent multiple refreshes at once
    if (refreshingMessageId) {
      toast.info('Please wait for current refresh to complete');
      return;
    }

    // Only allow refreshing AI messages
    const messageToRefresh = messages.find(m => m.id === messageId);
    if (!messageToRefresh || messageToRefresh.sender !== 'ai') {
      toast.error('Can only refresh AI messages');
      return;
    }

    // Don't allow refreshing streaming messages
    if (messageToRefresh.isStreaming) {
      toast.info('Please wait for the AI response to complete before refreshing');
      return;
    }

    // Check if message has a temporary ID that's still being processed
    if (messageId.startsWith('streaming-') || messageId.startsWith('temp-')) {
      console.log('⏳ Message still has temporary ID:', messageId);
      toast.info('Please wait for the message to be fully saved before refreshing');
      return;
    }

    // For debugging: log the message ID we're trying to refresh
    console.log('🔍 Attempting to refresh message with ID:', messageId, 'Type:', typeof messageId);

    // More lenient UUID validation - allow any reasonable ID format
    if (!messageId || messageId.length < 10) {
      console.log('❌ Invalid message ID format:', messageId);
      toast.error('Message is not ready for refresh yet. Please wait a moment.');
      return;
    }

    console.log('🔄 Starting refresh for message:', messageId);
    setRefreshingMessageId(messageId);
    
    // Store original message for rollback if needed
    const originalMessage = { ...messageToRefresh };
    
    try {
      // Get conversation context up to this message
      const contextMessages = buildContextForRefresh(messageId);
      console.log('📝 Context for refresh:', contextMessages.length, 'messages');
      
      // Mark message as refreshing
      updateMessageContent(messageId, messageToRefresh.content, true);
      
      toast.info('Refreshing response...');
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Call the refresh API
      const response = await fetch(`${backendApiDomain}/ai-journaling/sessions/${sessionId}/messages/${messageId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const refreshedMessageData = await response.json();
        console.log('✅ API response:', refreshedMessageData);
        
        // Update with the new content from API
        updateMessageContent(messageId, refreshedMessageData.content, false);
        
        // Trigger success animation
        setLastRefreshedId(messageId);
        setTimeout(() => setLastRefreshedId(null), 2000); // Clear after 2 seconds
        
        console.log('✅ Message refreshed successfully');
        toast.success('✨ Fresh perspective generated!', {
          description: 'The AI response has been refreshed with new insights.'
        });
        
        // Focus input after successful refresh
        setTimeout(() => {
          inputRef.current?.focus();
        }, 500);
      } else {
        const errorText = await response.text();
        console.error('❌ Refresh API failed:', response.status, errorText);
        
        // Restore original message on API error
        updateMessageContent(messageId, originalMessage.content, false);
        
        if (response.status === 404) {
          toast.error('Message not found or cannot be refreshed');
        } else if (response.status === 500 && retryAttempt < 2) {
          // Auto-retry server errors up to 2 times
          console.log(`🔄 Retrying refresh (attempt ${retryAttempt + 1}/2)...`);
          toast.info(`Server error, retrying... (${retryAttempt + 1}/2)`);
          setTimeout(() => {
            handleRefreshMessage(messageId, retryAttempt + 1);
          }, 1000);
          return; // Don't restore original message yet
        } else {
          const errorMessage = response.status === 500 
            ? 'Server error after retries. Please try again later.'
            : `Refresh failed (${response.status}). Please try again.`;
          toast.error(errorMessage);
        }
      }
      
    } catch (error) {
      console.error('❌ Error refreshing message:', error);
      
      // Restore original message on error
      updateMessageContent(messageId, originalMessage.content, false);
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else if (error instanceof Error && error.message.includes('Network')) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error('Failed to refresh message. Please try again.');
      }
    } finally {
      setRefreshingMessageId(null);
    }
  }, [refreshingMessageId, messages, buildContextForRefresh, updateMessageContent, lastClickTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input
      if (e.target === inputRef.current) return;
      
      // Refresh last AI message with 'R' key
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        
        // Find the last AI message that's fully saved (not streaming, not temp ID)
        const lastAIMessage = [...messages].reverse().find(m => 
          m.sender === 'ai' && 
          !m.isStreaming &&
          !m.id.startsWith('streaming-') &&
          !m.id.startsWith('temp-') &&
          m.id && m.id.length >= 10
        );
        
        if (lastAIMessage && !refreshingMessageId) {
          handleRefreshMessage(lastAIMessage.id);
          toast.info('⌨️ Keyboard shortcut activated!', {
            description: 'Refreshing the last AI response...'
          });
        } else if (!lastAIMessage) {
          toast.info('No AI message ready for refresh yet');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [messages, refreshingMessageId, handleRefreshMessage]);

  // No longer needed - regeneration is handled via API calls

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isSubmitting || !isConnected) {
      return;
    }

    setIsSubmitting(true);
    const messageContent = inputValue.trim();
    setInputValue('');

    try {
      // Check if this is the first message after continuing a completed session
      const wasSessionEnded = session?.ended_at !== undefined;
      if (wasSessionEnded) {
        console.log('🔄 Reopening completed session with new message');
      }

      // Add user message immediately to UI
      const userMessage: DisplayMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        sender: 'user',
        content: messageContent,
        seq: messages.length + 1,
        created_at: new Date().toISOString(),
        isStreaming: false
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Ensure we scroll to show the user's message
      setTimeout(() => {
        scrollToLatestMessages();
      }, 100);

      // Send via WebSocket for real-time streaming response
      console.log('📤 Sending WebSocket message:', messageContent);
      const sent = sendWebSocketMessage(messageContent);
      console.log('📡 WebSocket send result:', sent);
      
      if (!sent) {
        console.error('❌ Failed to send WebSocket message');
        toast.error('Failed to send message. Please try again.');
        // Remove the temporary message
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      } else if (wasSessionEnded) {
        // If this was a continued session, update backend to reopen it
        // The WebSocket message handler should handle this automatically
        console.log('✅ Session continuation message sent successfully');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle ending session
  const handleEndSession = async () => {
    console.log('🔚 Starting session end - no modal, direct analysis...');
    
    // Check if session end is already in progress
    if (endSessionInProgressRef.current || isEndSessionInProgress) {
      console.log('⚠️ Session end already in progress, skipping');
      return;
    }
    
    // Set the ref to prevent multiple calls
    endSessionInProgressRef.current = true;
    setIsEndSessionInProgress(true);
    setIsSubmitting(true);
    
    try {
      // Disconnect WebSocket to prevent interference
      console.log('🔌 Disconnecting WebSocket before ending session');
      disconnectWebSocket();
      
      // Force a small delay to ensure WebSocket is fully disconnected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Call endSession API to generate analysis
      const endedSession = await endSession(sessionId, userId);
      
      if (endedSession) {
        console.log('✅ Session ended successfully');
        setSession(endedSession);
        setSessionEndedLocally(true);
        toast.success('Session ended and analysis generated!');
      } else {
        console.log('⚠️ Session end failed');
        toast.error('Failed to end session');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    } finally {
      endSessionInProgressRef.current = false;
      setIsEndSessionInProgress(false);
      setIsSubmitting(false);
    }
  };


  // Retry connection
  const handleRetryConnection = () => {
    connectWebSocket(sessionId, userId);
  };

  // Handle continuing a completed session
  const handleContinueConversation = async () => {
    if (!session || !session.ended_at) {
      return;
    }

    console.log('🔄 Continuing conversation for session:', sessionId);
    setIsContinuingSession(true);

    try {
      // Update local session state to show as active
      setSession(prev => prev ? { ...prev, ended_at: undefined } : null);
      
      // Reset initial load flag since we're continuing
      setIsInitialLoad(false);
      
      // Scroll to show latest messages and input area
      setTimeout(() => {
        scrollToLatestMessages();
      }, 100);

      // Focus on input when it becomes available
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);

      toast.success('Session resumed - you can continue your conversation!');
    } catch (error) {
      console.error('Error continuing conversation:', error);
      toast.error('Failed to resume session');
      
      // Revert session state on error
      setSession(prev => prev ? { ...prev, ended_at: session.ended_at } : null);
    } finally {
      setIsContinuingSession(false);
    }
  };

  // Parse markdown summary into bullet points (same function as in entries view)
  const parseSummaryPoints = (summaryMd: string): string[] => {
    if (!summaryMd) return [];
    
    // Split by lines and filter for bullet points or numbered lists
    const lines = summaryMd.split('\n');
    const bullets: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match markdown bullets (-, *, +) or numbered lists (1., 2., etc.)
      if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        // Remove markdown syntax and add to bullets
        const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
        if (cleaned) {
          bullets.push(cleaned);
        }
      } else if (trimmed) {
        bullets.push(trimmed);
      }
    }
    
    // If we still have no bullets, try splitting by sentences
    if (bullets.length === 0 && summaryMd.trim()) {
      const sentences = summaryMd.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
      bullets.push(...sentences.slice(0, 4));
    }
    
    return bullets.slice(0, 4); // Limit to 4 bullet points for card display
  };

  // Handle re-analysis (regenerate analysis)
  const handleRegenerateAnalysis = async () => {
    console.log('🔄 Regenerating analysis...');
    
    if (!session?.id || isSubmitting) {
      console.log('⚠️ Cannot regenerate - no session or already processing');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call endSession API to regenerate analysis
      const endedSession = await endSession(session.id, userId);
      
      if (endedSession) {
        console.log('✅ Analysis regenerated successfully');
        setSession(endedSession);
        toast.success('Analysis regenerated successfully!');
      } else {
        console.log('⚠️ Analysis regeneration failed');
        toast.error('Failed to regenerate analysis');
      }
      
    } catch (error) {
      console.error('Error regenerating analysis:', error);
      toast.error('Failed to regenerate analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-900 dark:text-gray-100">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading session...</span>
      </div>
    );
  }

  const isSessionEnded = session?.ended_at;
  const hasAnalysis = session?.analysis?.summary_md;
  const summaryPoints = session?.analysis?.summary_md ? parseSummaryPoints(session.analysis.summary_md) : [];
  
  // Show summary/emotions if session is ended OR if it has analysis (was previously ended and continued)
  const shouldShowAnalysis = hasAnalysis;

  return (
    <div className="min-h-screen bg-white">
            {/* Minimal Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack} 
                className="group bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-full shadow-sm hover:shadow-md transition-all duration-300 ease-in-out px-3 py-3 h-auto opacity-60 hover:opacity-100 hover:scale-105"
              >
                <div className="flex items-center">
                  <div className="transition-transform duration-300 ease-in-out group-hover:scale-110">
                    <ArrowLeft className="h-4 w-4" />
                  </div>
                  <span className="text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out ml-0 group-hover:ml-2 whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-xs transform translate-x-[-10px] group-hover:translate-x-0">
                    Back
                  </span>
                </div>
              </Button>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-medium text-gray-900">
                  Let Me In
                </h1>
                {isConnected ? (
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                ) : (
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
            {isSessionEnded && (
              <span className="text-xs text-gray-500 font-medium">Session Complete</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Section - Stays visible for continued sessions */}
      {shouldShowAnalysis && summaryPoints.length > 0 && (
        <div className="px-8 py-6">
          <div className="relative group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200 tracking-tight">
                Summary
              </h3>
              
              {/* Three dots menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400">
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleRegenerateAnalysis}
                    disabled={isSubmitting}
                    className="flex items-center space-x-2"
                  >
                    <Brain className="w-4 h-4" />
                    <span>{isSubmitting ? 'Analyzing...' : 'Re-analyze'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="space-y-3">
              {summaryPoints.map((point, index) => (
                <div key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed flex items-start">
                  <span className="text-gray-400 mr-3 mt-1">•</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Separator line between summary and emotions */}
      {shouldShowAnalysis && summaryPoints.length > 0 && session?.analysis?.emotions && Object.keys(session.analysis.emotions).length > 0 && (
        <div className="px-8">
          <hr className="border-gray-300 border-t" />
        </div>
      )}

      {/* Emotion Visualization - Stays visible for continued sessions */}
      {shouldShowAnalysis && session?.analysis?.emotions && Object.keys(session.analysis.emotions).length > 0 && (
        <div className="px-8 py-6">
          <div className="relative group">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-4 tracking-tight">
              Emotions
            </h3>
            <div className="space-y-3">
              {(() => {
                // Get sorted emotions - handle both old and new formats
                const emotionEntries = Object.entries(session.analysis.emotions);
                
                // Sort by score (handle both number and object formats)
                const sortedEmotions = emotionEntries
                  .map(([emotion, data]) => {
                    const score = typeof data === 'number' ? data : (data as any)?.score || 0;
                    return [emotion, data, score] as [string, any, number];
                  })
                  .sort(([,, scoreA], [,, scoreB]) => scoreB - scoreA)
                  .slice(0, 5);
                
                // Calculate total for normalization
                const total = sortedEmotions.reduce((sum, [, , score]) => sum + score, 0);
                
                return sortedEmotions.map(([emotion, data, score]) => {
                  const normalizedPercentage = Math.round((score / total) * 100);
                  
                  return (
                    <ExpandableEmotion
                      key={emotion}
                      emotion={emotion}
                      data={data}
                      percentage={normalizedPercentage}
                    />
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Separator line between emotions and chat */}
      {shouldShowAnalysis && session?.analysis?.emotions && Object.keys(session.analysis.emotions).length > 0 && (
        <div className="px-8">
          <hr className="border-gray-300 border-t" />
        </div>
      )}

      {/* Separator line between summary/emotions and chat (when no emotions) */}
      {shouldShowAnalysis && (!session?.analysis?.emotions || Object.keys(session.analysis.emotions).length === 0) && (
        <div className="px-8">
          <hr className="border-gray-300 border-t" />
        </div>
      )}

      {/* Journal Writing Area - Top positioned when no messages */}
      {!isSessionEnded && messages.length === 0 && (
        <div className="px-8 py-8">
          <div className="w-full max-w-4xl space-y-6">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ((e.ctrlKey || e.metaKey) || !e.shiftKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="What's on your mind..."
              disabled={isSubmitting || !isConnected}
              className="w-full bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-base leading-relaxed focus:outline-none focus:ring-0 resize-none min-h-[60px] p-0"
              maxLength={2000}
            />
            
            {/* Action Buttons for first message */}
            <div className={`overflow-hidden transition-all duration-500 ease-out ${
              inputValue.trim() && !isTyping
                ? 'max-h-20 opacity-100 transform translate-y-0' 
                : 'max-h-0 opacity-0 transform translate-y-2'
            }`}>
              <div className="flex items-center space-x-4 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isSubmitting || !isConnected}
                  className="bg-black text-white hover:bg-gray-800 px-8 py-3 rounded-full font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Go deeper'
                  )}
                </Button>

                <button
                  onClick={handleEndSession}
                  disabled={false}
                  className="bg-transparent text-gray-500 hover:text-gray-700 px-0 py-2 font-normal text-base underline underline-offset-2 transition-colors duration-200 ease-out border-none cursor-pointer"
                >
                  Finish entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages Container - Only show when there are messages */}
      {messages.length > 0 && (
        <div className="px-8 py-8">
          <div className="max-w-none">
            <div className="space-y-8">
              {messages.map((message, index) => (
                <div key={message.id || index} className="w-full" data-message-index={index}>
                  {message.sender === 'user' ? (
                    /* User Message - Plain black text, no bubble */
                    <div className="mb-6">
                      <div className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap font-normal">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    /* AI Response - Blue text with left border */
                    <div className="mb-6 relative group">
                      <div className={`border-l-4 pl-6 text-base leading-relaxed whitespace-pre-wrap font-normal transition-all duration-500 ease-out ${
                        refreshingMessageId === message.id 
                          ? 'border-blue-500 text-blue-600 opacity-75 animate-pulse' 
                          : lastRefreshedId === message.id
                          ? 'border-emerald-400 text-emerald-700 bg-emerald-50/50 shadow-emerald-200/50 shadow-lg animate-pulse'
                          : 'border-blue-500 text-blue-600'
                      }`}>
                        {message.isStreaming ? (
                          <span>
                            {message.streamContent}
                            <span className="animate-pulse">|</span>
                          </span>
                        ) : (
                          <span>{message.content}</span>
                        )}
                      </div>
                      
                      {/* Refresh Button - Positioned in right margin */}
                      {!message.isStreaming && (
                        <div className="absolute -right-12 top-1 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out">
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              handleRefreshMessage(message.id);
                            }}
                            disabled={refreshingMessageId === message.id || refreshingMessageId !== null}
                            className={`
                              group/refresh bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-full shadow-sm hover:shadow-md 
                              transition-all duration-300 ease-in-out p-2 h-auto opacity-60 hover:opacity-100 hover:scale-105
                              ${refreshingMessageId === message.id ? 'animate-pulse' : ''}
                              ${lastRefreshedId === message.id ? 'bg-emerald-100 border-emerald-300 text-emerald-600' : ''}
                            `}
                            size="sm"
                            title={
                              refreshingMessageId === message.id 
                                ? 'Refreshing...' 
                                : lastRefreshedId === message.id 
                                ? 'Just refreshed!' 
                                : 'Refresh this response'
                            }
                          >
                            <div className={`transition-transform duration-500 ease-in-out ${
                              refreshingMessageId === message.id 
                                ? '' 
                                : 'group-hover/refresh:rotate-180'
                            }`}>
                              {refreshingMessageId === message.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : lastRefreshedId === message.id ? (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </div>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isStreaming && (
                <div className="mb-6">
                  <div className="border-l-4 border-blue-500 pl-6 flex items-center space-x-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-base">Thinking...</span>
                  </div>
                </div>
              )}

              {/* Continue Conversation Button for completed sessions */}
              {isSessionEnded && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={handleContinueConversation}
                    disabled={isContinuingSession}
                    className="group bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-full shadow-sm hover:shadow-md transition-all duration-300 ease-in-out px-3 py-3 h-auto opacity-60 hover:opacity-100 hover:scale-105"
                    size="sm"
                  >
                    <div className="flex items-center">
                      <div className="transition-transform duration-300 ease-in-out group-hover:scale-110">
                        {isContinuingSession ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.001 8.001 0 01-7.75-6M3 12c0-4.418 3.582-8 8-8a8.001 8.001 0 017.75 6" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out ml-0 group-hover:ml-2 whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-xs transform translate-x-[-10px] group-hover:translate-x-0">
                        {isContinuingSession ? 'Resuming...' : 'Continue Conversation'}
                      </span>
                    </div>
                  </Button>
                </div>
              )}

              {/* Journal Writing Area - Inline with messages when they exist */}
              {!isSessionEnded && (
                <div className="space-y-6">
                  <div className="w-full">
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && ((e.ctrlKey || e.metaKey) || !e.shiftKey)) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      placeholder="Write here..."
                      disabled={isSubmitting || !isConnected}
                      className="w-full bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-base leading-relaxed focus:outline-none focus:ring-0 resize-none min-h-[60px] p-0"
                      maxLength={2000}
                    />
                  </div>
                  
                  <div className={`flex items-center space-x-4 transition-all duration-500 ease-out ${
                    isTyping ? 'opacity-0 transform translate-y-2' : 'opacity-100 transform translate-y-0'
                  }`}>
                    {/* Dynamic Action Button with Animated Text Transition */}
                    <Button
                      onClick={inputValue.trim() ? handleSubmit : () => {
                        // Find the last AI message and refresh it
                        const lastAIMessage = [...messages].reverse().find(msg => msg.sender === 'ai');
                        if (lastAIMessage) {
                          handleRefreshMessage(lastAIMessage.id);
                        }
                      }}
                      disabled={inputValue.trim() ? (!inputValue.trim() || isSubmitting || !isConnected) : (refreshingMessageId !== null)}
                      className="bg-black text-white hover:bg-gray-800 px-8 py-3 rounded-full font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] relative min-w-[120px]"
                      size="lg"
                    >
                      <div className="relative flex items-center justify-center">
                        {/* Loading states - shown when submitting or refreshing */}
                        {(isSubmitting || refreshingMessageId) && (
                          <div className="flex items-center animate-in fade-in-0 duration-300">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span>{isSubmitting ? 'Sending...' : 'Refreshing...'}</span>
                          </div>
                        )}
                        
                        {/* Normal states - with smooth transitions */}
                        {!isSubmitting && !refreshingMessageId && (
                          <>
                            {/* "Go deeper" text - shown when there's input */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
                              inputValue.trim() 
                                ? 'opacity-100 translate-y-0 scale-100' 
                                : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                            }`}>
                              <span>Go deeper</span>
                            </div>
                            
                            {/* "Refresh" text - shown when no input */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
                              !inputValue.trim() 
                                ? 'opacity-100 translate-y-0 scale-100' 
                                : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                            }`}>
                              <span>Refresh</span>
                            </div>
                          </>
                        )}
                      </div>
                    </Button>

                    {/* Context-sensitive Button: Finish entry for new, Re-analyse for old */}
                    <button
                      onClick={(event) => {
                        console.log('🔘 Finish entry button clicked');
                        
                        // Check if action is already in progress
                        if (isSubmitting || isEndSessionInProgress) {
                          console.log('⚠️ Button disabled, ignoring click');
                          return;
                        }
                        
                        // Disable button temporarily
                        const button = event?.target as HTMLButtonElement;
                        if (button) {
                          button.disabled = true;
                          setTimeout(() => {
                            button.disabled = false;
                          }, 2000); // Re-enable after 2 seconds
                        }
                        
                        if (session?.analysis || sessionEndedLocally) {
                          console.log('🔄 Calling handleRegenerateAnalysis');
                          handleRegenerateAnalysis();
                        } else {
                          console.log('🔚 Calling handleEndSession');
                          handleEndSession();
                        }
                      }}

                      className="bg-transparent text-gray-500 hover:text-gray-700 px-0 py-2 font-normal text-base underline underline-offset-2 transition-colors duration-200 ease-out border-none cursor-pointer disabled:opacity-50"
                    >
                      {(session?.analysis || sessionEndedLocally) ? 'Re-analyse' : 'Finish entry'}
                    </button>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}


      {/* Scroll to Bottom Button */}
      {messages.length > 0 && (
        <div className="fixed bottom-8 right-8 z-50">
          <Button
            onClick={scrollToBottom}
            className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full shadow-lg dark:shadow-gray-900/30 transition-all duration-300 ease-in-out px-3 py-3 h-auto opacity-70 hover:opacity-100 hover:scale-105 hover:shadow-xl dark:hover:shadow-gray-900/50"
            size="sm"
            title="Scroll to bottom"
          >
            <div className="flex items-center">
              <div className="transition-transform duration-300 ease-in-out group-hover:scale-110">
                <ChevronDown className="h-5 w-5" />
              </div>
              <span className="text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out ml-0 group-hover:ml-2 whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-xs transform translate-x-[-10px] group-hover:translate-x-0">
                Scroll to bottom
              </span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
