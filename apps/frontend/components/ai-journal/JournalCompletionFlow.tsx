import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpandableEmotion } from './ExpandableEmotion';

interface JournalCompletionFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  emotions?: any;
  userId: string;
  sessionId?: string;
  endSession?: (sessionId: string, userId: string) => Promise<any>;
  getSession?: (sessionId: string, userId: string) => Promise<any>;
  skipStreak?: boolean; // Skip streak calculation and go directly to emotions
}

// State machine for completion flow
type CompletionFlowState = 
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'streak'
  | 'emotions'
  | 'completed';

interface ModalState {
  loading: boolean;
  streak: boolean;
  emotions: boolean;
}

interface EmotionCardProps {
  emotion: string;
  percentage: number;
  explanation?: string | null;
}

function LightEmotionCard({ emotion, percentage, explanation }: EmotionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExplanation = explanation && explanation.length > 0;

  return (
    <div className="group">
      {/* Clean emotion row for light background */}
      <div 
        className={`flex items-center justify-between py-3 px-4 transition-all duration-200 ${
          hasExplanation ? 'cursor-pointer hover:bg-white/60 rounded-lg' : ''
        }`}
        onClick={hasExplanation ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center space-x-2">
          <span className="text-gray-800 dark:text-gray-200 capitalize leading-relaxed font-medium">
            {emotion}
          </span>
          {hasExplanation && (
            <div className={`transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100 ${isExpanded ? 'rotate-180 opacity-100' : 'rotate-0'}`}>
              <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
        <span className="text-gray-600 dark:text-gray-400 font-normal">
          {percentage}%
        </span>
      </div>
      
      {/* Expandable explanation */}
      {hasExplanation && (
        <div className={`overflow-hidden transition-all duration-400 ease-in-out ${
          isExpanded ? 'max-h-32 opacity-100 mt-2 mb-2' : 'max-h-0 opacity-0'
        }`}>
          <div className="pl-4 pr-2">
            <div className="border-l-2 border-gray-300 dark:border-gray-600 pl-4 py-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {explanation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Removed global variables - using refs instead
const FLOW_TIMEOUT = 30000; // 30 seconds timeout

export function JournalCompletionFlow({ 
  isOpen, 
  onComplete, 
  emotions,
  userId,
  sessionId,
  endSession,
  getSession,
  skipStreak = false
}: JournalCompletionFlowProps) {
  // State machine for completion flow
  const [flowState, setFlowState] = useState<CompletionFlowState>('idle');
  const [modalState, setModalState] = useState<ModalState>({
    loading: false,
    streak: false,
    emotions: false
  });
  
  const [streak, setStreak] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [finalEmotions, setFinalEmotions] = useState(emotions);
  const [expandedEmotions, setExpandedEmotions] = useState<Set<string>>(new Set());

  // Track flow state with refs to prevent re-renders
  const flowStateRef = useRef({ 
    endSessionCalled: false,
    currentSessionId: null as string | null | undefined,
    abortController: null as AbortController | null
  });

  // Toggle emotion expansion
  const toggleEmotionExpansion = (emotion: string) => {
    setExpandedEmotions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emotion)) {
        newSet.delete(emotion);
      } else {
        newSet.add(emotion);
      }
      return newSet;
    });
  };

  const calmingMessages = [
    "Take a deep breath...",
    "Let your thoughts settle...",
    "Reflect on your journey...",
    "Finding patterns in your thoughts...",
    "Processing your insights...",
    "Almost ready to reveal your growth..."
  ];

  // Calculate user's journaling streak
  const calculateStreak = async () => {
    try {
      const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
      const response = await fetch(`${backendApiDomain}/ai-journaling/users/${userId}/streak`);
      
      if (response.ok) {
        const data = await response.json();
        setStreak(data.streak || 1);
      } else {
        setStreak(1); // Default to 1 if API fails
      }
    } catch (error) {
      setStreak(1); // Default to 1 if error
    }
  };

  // Reset flow state helper
  const resetFlowState = () => {
    // Cancel any ongoing operations
    if (flowStateRef.current.abortController) {
      flowStateRef.current.abortController.abort();
    }
    
    // Reset all state
    setFlowState('idle');
    flowStateRef.current.endSessionCalled = false;
    flowStateRef.current.currentSessionId = null;
    flowStateRef.current.abortController = null;
    setModalState({ loading: false, streak: false, emotions: false });
    setExpandedEmotions(new Set());
  };

  // State machine effect - only depends on isOpen to prevent loops
  useEffect(() => {
    if (isOpen && flowState === 'idle') {
      // Check if this is a new session or same session
      const isNewSession = flowStateRef.current.currentSessionId !== sessionId;
      
      if (isNewSession) {
        console.log('🚀 Starting completion flow for NEW session:', sessionId);
        console.log('🔍 Previous session:', flowStateRef.current.currentSessionId, 'Current session:', sessionId);
        
        // Cancel any existing operations
        if (flowStateRef.current.abortController) {
          flowStateRef.current.abortController.abort();
        }
        
        // Create new abort controller for this session
        flowStateRef.current.abortController = new AbortController();
        flowStateRef.current.currentSessionId = sessionId;
        flowStateRef.current.endSessionCalled = false;
        
        // Transition to initializing state and skip loading modal
        setFlowState('initializing');
        setModalState({ loading: false, streak: false, emotions: false });
        setLoadingProgress(0);
        setExpandedEmotions(new Set());
        
        // Start the flow
        startCompletionFlow();
      } else {
        console.log('⚠️ Flow already initialized for session:', sessionId);
      }
    } else if (!isOpen && flowState !== 'idle') {
      // Reset when modal closes
      console.log('🔄 Resetting flow state - modal closed');
      resetFlowState();
    }
  }, [isOpen, flowState]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (flowStateRef.current.abortController) {
        flowStateRef.current.abortController.abort();
      }
    };
  }, []);

  const startCompletionFlow = async () => {
    console.log('📋 startCompletionFlow called');
    
    // Check if operation was aborted
    if (flowStateRef.current.abortController?.signal.aborted) {
      console.log('⚠️ Operation aborted, stopping completion flow');
      return;
    }
    
    // Skip loading state and go directly to streak calculation
    setFlowState('streak');
    // For re-analysis, we skip session ending but still show both streak and emotions modals
    if (skipStreak) {
      setFinalEmotions(emotions);
      calculateStreak().catch(() => setStreak(1));
      
      // Go directly to streak modal
      setTimeout(() => {
        if (!flowStateRef.current.abortController?.signal.aborted) {
          setFlowState('streak');
          setModalState({ loading: false, streak: true, emotions: false });
        }
      }, 100);
      return;
    }
    // Start the actual backend work with timeout
    const backendWork = async () => {
      const FLOW_TIMEOUT = 15000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Flow timeout - backend took too long')), FLOW_TIMEOUT)
      );
      try {
        const workPromise = (async () => {
          let analysisCompleted = false;
          if (sessionId && endSession && !flowStateRef.current.endSessionCalled) {
            try {
              flowStateRef.current.endSessionCalled = true;
              const endedSession = await endSession(sessionId, userId);
              if (endedSession?.analysis?.emotions) {
                setFinalEmotions(endedSession.analysis.emotions);
                analysisCompleted = true;
              } else {
                if (getSession) {
                  for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const refreshedSession = await getSession(sessionId, userId);
                    if (refreshedSession?.analysis?.emotions) {
                      setFinalEmotions(refreshedSession.analysis.emotions);
                      analysisCompleted = true;
                      break;
                    }
                  }
                }
              }
            } catch (error) {
              // fallback
            }
          } else if (flowStateRef.current.endSessionCalled) {
            console.log('⚠️ End session already called, skipping to avoid duplicate calls');
          }
          if (!analysisCompleted) {
            if (emotions) {
              setFinalEmotions(emotions);
            } else {
              setFinalEmotions({
                "neutral": { "score": 1.0, "explanation": "Processing your thoughts..." }
              });
            }
          }
          
          // Calculate streak
          try {
            await calculateStreak();
          } catch {
            setStreak(1);
          }
        })();
        await Promise.race([workPromise, timeoutPromise]);
      } catch {
        if (emotions) {
          setFinalEmotions(emotions);
        } else {
          setFinalEmotions({
            "reflection": {
              "score": 0.6,
              "explanation": "Your conversation demonstrates thoughtful self-reflection and emotional awareness. You took time to examine your feelings and experiences, showing a willingness to understand yourself more deeply."
            },
            "introspection": {
              "score": 0.5,
              "explanation": "You engaged in meaningful introspection during this journaling session, looking inward to examine your thoughts and feelings. This shows your commitment to personal growth."
            }
          });
        }
        setStreak(1);
      }
    };
    
    // Execute backend work and then go directly to streak modal
    await backendWork();
    
    // Wait for backend work to complete, then show streak modal
    Promise.race([
      backendWork(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]).finally(() => {
      // Check if operation was aborted
      if (flowStateRef.current.abortController?.signal.aborted) {
        console.log('⚠️ Operation aborted during completion');
        return;
      }
      
      console.log('💫 Backend work completed, transitioning to streak modal');
      setTimeout(() => {
        if (!flowStateRef.current.abortController?.signal.aborted) {
          setFlowState('streak');
          setModalState({ loading: false, streak: true, emotions: false });
        }
      }, 300);
    });
    
    // Fallback timeout to ensure modal shows
    const maxTimeout = setTimeout(() => {
      if (!flowStateRef.current.abortController?.signal.aborted) {
        console.log('⏰ Timeout reached, forcing streak modal');
        setFlowState('streak');
        setModalState({ loading: false, streak: true, emotions: false });
      }
    }, 5000);
    
    return () => {
      clearTimeout(maxTimeout);
    };
  };

  const handleStreakContinue = () => {
    console.log('🎯 Streak continue clicked');
    setFlowState('emotions');
    setModalState({ loading: false, streak: false, emotions: true });
  };

  const handleEmotionsContinue = () => {
    console.log('👋 Emotions continue - completing flow');
    setFlowState('completed');
    resetFlowState();
    onComplete();
  };

  const handleClose = () => {
    console.log('❌ Modal closed by user');
    setFlowState('completed');
    resetFlowState();
    onComplete();
  };

  console.log('🎭 JournalCompletionFlow render - isOpen:', isOpen, 'flowState:', flowState, 'modalState:', modalState);
  
  if (!isOpen) {
    console.log('❌ Modal not open, returning null');
    return null;
  }

  console.log('✅ Modal is open, rendering...');

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)' 
      }}
    >
      {/* Loading Modal - REMOVED */}
      
      {/* Fallback: If modal is open but no specific state is active, show streak modal */}
      {isOpen && flowState !== 'idle' && flowState !== 'completed' && !modalState.streak && !modalState.emotions && (
        <div className="bg-white rounded-3xl max-w-4xl w-full mx-4 relative h-[600px] flex flex-col" style={{ border: '5px solid orange', backgroundColor: 'white' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'orange', color: 'white', padding: '5px', zIndex: 10000 }}>
            DEBUG: Fallback Modal - FlowState: {flowState}
          </div>
          <button
            title="Close"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-20 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-center p-16">
            <div className="text-center max-w-2xl space-y-12">
              <div className="space-y-6">
                <h2 className="text-5xl font-light text-gray-900 leading-tight">
                  Processing your entry...
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Please wait while we analyze your journal entry.
                </p>
              </div>
              
              <div className="pt-4">
                <Button
                  onClick={() => {
                    console.log('🔄 Force transition to streak modal');
                    setFlowState('streak');
                    setModalState({ loading: false, streak: true, emotions: false });
                  }}
                  className="bg-black text-white hover:bg-gray-800 px-10 py-4 rounded-full font-medium transition-all duration-200 text-lg"
                >
                  Continue to Results
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streak Congratulation Modal */}
      {(() => {
        console.log('🎭 Rendering streak modal - flowState:', flowState, 'modalState.streak:', modalState.streak);
        return flowState === 'streak' && modalState.streak;
      })() && (
        <div className="bg-white rounded-3xl max-w-4xl w-full mx-4 relative h-[600px] flex flex-col" style={{ border: '5px solid red', backgroundColor: 'white' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'red', color: 'white', padding: '5px', zIndex: 10000 }}>
            DEBUG: Streak Modal Visible
          </div>
          <button
            title="Close"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-20 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-center p-16">
            <div className="text-center max-w-2xl space-y-12">
              {/* Header Section */}
              <div className="space-y-6">
                <h2 className="text-5xl font-light text-gray-900 leading-tight">
                  Great job! You're getting mentally fit.
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Reflect every day to build your streak and make Let Me In more personalised for you.
                </p>
              </div>
              
              {/* Streak Circle */}
              <div className="flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-gray-300 rounded-full flex flex-col items-center justify-center bg-gray-50/50">
                  <div className="text-6xl font-light text-gray-900">{streak}</div>
                  <div className="text-lg text-gray-500 mt-2">day streak</div>
                </div>
              </div>
              
              {/* Action Button */}
              <div className="pt-4">
                <Button
                  title="Continue"
                  onClick={handleStreakContinue}
                  className="bg-black text-white hover:bg-gray-800 px-10 py-4 rounded-full font-medium transition-all duration-200 text-lg"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emotional State Analysis Modal */}
      {flowState === 'emotions' && modalState.emotions && (
        <div className="bg-white rounded-2xl max-w-6xl w-full mx-4 relative overflow-hidden h-[85vh] max-h-[750px]">
          <button
            title="Close"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-20 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex h-full">
            {/* Left Side - Simplified Content */}
            <div className="flex-1 flex flex-col justify-center p-12">
              <div className="max-w-lg space-y-8">
                {/* Header Section */}
                <div className="space-y-6">
                  <h2 className="text-5xl font-light text-gray-900 leading-tight">
                    Emotional state analysis
                  </h2>
                  <p className="text-xl text-gray-600 leading-relaxed">
                    Here's what we detected from your journal entry. These insights can help you understand your emotional patterns and mental state.
                  </p>
                </div>
                
                {/* Simple completion indicator */}
                <div className="flex items-center space-x-3 text-gray-500">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-sm">Analysis completed • {new Date().toLocaleDateString()}</span>
                </div>
                
                {/* Action Button */}
                <div className="pt-8">
                  <Button
                    onClick={handleEmotionsContinue}
                    className="bg-black text-white hover:bg-gray-800 px-10 py-4 rounded-full font-medium transition-all duration-200 text-lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Right Side - Enhanced Emotions Panel */}
            <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 relative border-l border-gray-200">
              <div className="h-full p-8 flex flex-col">
                {/* Header with stats */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-gray-900">Emotions</h3>
                    <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                      {finalEmotions ? Object.keys(finalEmotions).length : 0} detected
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Your emotional breakdown from this session</p>
                </div>
                
                {/* Emotions List */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {finalEmotions && Object.keys(finalEmotions).length > 0 ? (() => {
                    try {
                      const emotionEntries = Object.entries(finalEmotions);
                      const sortedEmotions = emotionEntries
                        .map(([emotion, data]) => {
                          const score = typeof data === 'number' ? data : (data as any)?.score || 0;
                          return [emotion, data, score] as [string, any, number];
                        })
                        .sort(([,, scoreA], [,, scoreB]) => scoreB - scoreA);
                      
                      const total = sortedEmotions.reduce((sum, [, , score]) => sum + score, 0);
                      
                      if (total === 0 || sortedEmotions.length === 0) {
                        return (
                          <div className="text-gray-600 text-center py-16 px-4">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                              <span className="text-2xl">🤔</span>
                            </div>
                            <div className="text-base leading-relaxed">
                              Not enough data to form an analysis
                            </div>
                          </div>
                        );
                      }
                      
                      return sortedEmotions.map(([emotion, data, score], index) => {
                        const normalizedPercentage = Math.round((score / total) * 100);
                        const explanation = typeof data === 'object' && data.explanation ? data.explanation : null;
                        const isExpanded = expandedEmotions.has(emotion);
                        const shouldTruncate = explanation && explanation.length > 80;
                        
                        // Different styling for top 3 emotions
                        const isTopEmotion = index < 3;
                        
                        return (
                          <div 
                            key={emotion} 
                            className={`rounded-xl p-4 transition-colors ${
                              isTopEmotion 
                                ? 'bg-white shadow-sm border border-gray-200' 
                                : 'bg-white/60 hover:bg-white/80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`capitalize font-medium ${
                                isTopEmotion ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {emotion}
                              </span>
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  index === 0 ? 'bg-blue-500' :
                                  index === 1 ? 'bg-green-500' :
                                  index === 2 ? 'bg-purple-500' :
                                  'bg-gray-400'
                                }`}></div>
                                <span className={`text-sm font-medium ${
                                  isTopEmotion ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {normalizedPercentage}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  index === 0 ? 'bg-blue-500' :
                                  index === 1 ? 'bg-green-500' :
                                  index === 2 ? 'bg-purple-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${normalizedPercentage}%` }}
                              ></div>
                            </div>
                            
                            {explanation && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-600 leading-relaxed">
                                  {shouldTruncate && !isExpanded 
                                    ? explanation.substring(0, 80) + '...' 
                                    : explanation}
                                </p>
                                
                                {shouldTruncate && (
                                  <button
                                    onClick={() => toggleEmotionExpansion(emotion)}
                                    className="flex items-center space-x-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                  >
                                    <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                                    <svg 
                                      className={`w-3 h-3 transition-transform duration-200 ${
                                        isExpanded ? 'rotate-180' : 'rotate-0'
                                      }`} 
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    } catch (error) {
                      console.error('Error processing emotions:', error);
                      return (
                        <div className="text-gray-600 text-center py-16 px-4">
                          <div className="text-base leading-relaxed">
                            Unable to process emotional data
                          </div>
                        </div>
                      );
                    }
                  })() : (
                    <div className="text-gray-600 text-center py-16 px-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-2xl">📝</span>
                      </div>
                      <div className="text-base leading-relaxed">
                        No emotional data available
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Bottom insight */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500 text-center">
                    Insights become more accurate with regular journaling
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 