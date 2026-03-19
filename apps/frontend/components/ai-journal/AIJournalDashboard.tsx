"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  MessageCircle, 
  Brain, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Plus,
  Sparkles,
  Activity,
  BarChart3,
  Loader2,
  BookOpen,
  Home,
  Mic,
  ChevronDown,
  Grid3X3,
  List,
  Heart
} from 'lucide-react';
import { useAIJournalSessions, AIJournalDashboardData, AIJournalSessionSummary } from '@/app/ai-journal/services/useAIJournalSessions';
import { useEmotionStats, TimeFilter, EmotionStat, EmotionSession } from '@/app/ai-journal/services/useEmotionStats';
import { EmotionBubbles } from '@/components/ai-journal/EmotionBubbles';
import { EmotionSummaryModal } from '@/components/ai-journal/EmotionSummaryModal';
import { AIJournalChat } from './AIJournalChat';
import { toast } from 'sonner';

interface AIJournalDashboardProps {
  userId: string;
}

type ViewMode = 'home' | 'entries' | 'insights' | 'chat';

export function AIJournalDashboard({ userId }: AIJournalDashboardProps) {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [dashboardData, setDashboardData] = useState<AIJournalDashboardData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<ViewMode>('home');

  const {
    getTodaySession,
    startNewSession,
    getDashboard,
    getUserSessions,
    loading,
    error
  } = useAIJournalSessions();

  // Load dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboard(userId);
        if (data) {
          setDashboardData(data);
        } else {
          // Set empty dashboard data to prevent infinite loading
          setDashboardData({
            total_sessions: 0,
            sessions_this_week: 0,
            sessions_this_month: 0,
            recent_sessions: [],
            common_emotions: {}
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        // Set empty dashboard data even on error to prevent infinite loading
        setDashboardData({
          total_sessions: 0,
          sessions_this_week: 0,
          sessions_this_month: 0,
          recent_sessions: [],
          common_emotions: {}
        });
        toast.error('Failed to load dashboard data');
      }
    };

    loadDashboard();
  }, [userId]);

  // Start a new session
  const handleStartJournaling = async () => {
    try {
      const session = await startNewSession(userId);
      if (session) {
        setPreviousView(currentView); // Remember where we came from
        setCurrentSessionId(session.id);
        setCurrentView('chat');
        toast.success('Welcome! Let yourself in.');
      } else {
        toast.error('Failed to start session');
      }
    } catch (err) {
      console.error('Error starting session:', err);
      toast.error('Failed to start session');
    }
  };

  // Navigate back to previous view
  const handleBackToPreviousView = () => {
    setCurrentView(previousView);
    setCurrentSessionId(null);
  };

  // View specific session
  const handleViewSession = (sessionId: string) => {
    setPreviousView(currentView); // Remember where we came from
    setCurrentSessionId(sessionId);
    setCurrentView('chat');
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-900 dark:text-gray-100">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your journal...</span>
      </div>
    );
  }

  // Render chat view
  if (currentView === 'chat' && currentSessionId) {
    return (
      <AIJournalChat
        sessionId={currentSessionId}
        userId={userId}
        onBack={handleBackToPreviousView}
      />
    );
  }

  // Navigation tabs
  const navigationTabs = (
    <TooltipProvider>
      <div className="flex space-x-6 mb-8">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCurrentView('home')}
              aria-label="Home"
              className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ${
                currentView === 'home' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Home className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Home</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCurrentView('entries')}
              aria-label="Entries"
              className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ${
                currentView === 'entries' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Entries</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCurrentView('insights')}
              aria-label="Insights"
              className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ${
                currentView === 'insights' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Insights</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  // Render entries view
  if (currentView === 'entries') {
    return (
      <div className="space-y-6">
        {navigationTabs}
        <JournalEntriesView 
        userId={userId}
        onViewSession={handleViewSession}
      />
      </div>
    );
  }

  // Render insights view
  if (currentView === 'insights') {
    return (
      <div className="space-y-6">
        {navigationTabs}
        <JournalInsightsView 
        userId={userId}
          dashboardData={dashboardData}
      />
      </div>
    );
  }

  // Home view - minimal with just start journaling button
  return (
    <div className="space-y-8">
      {navigationTabs}
      
      {/* Ultra Minimal Home View */}
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-12">
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-light text-gray-900 dark:text-gray-100">Let Me In</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-light">
            Your mental clarity zone. Let AI guide your thoughts, organize your mind, and unlock new insights.
          </p>
        </div>
        
        <Button 
          onClick={handleStartJournaling}
          className="group relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-12 py-6 text-lg rounded-full font-light transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-blue-500/30"
          size="lg"
        >
          <div className="flex items-center justify-center">
            <span className="transition-all duration-300 group-hover:tracking-wider">Start writing</span>
            <div className="overflow-hidden max-w-0 group-hover:max-w-[24px] transition-all duration-300 ease-out">
              <svg className="w-5 h-5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
          
          {/* Blue glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 via-blue-500/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        </Button>
      </div>
    </div>
  );
}

// Journal Entries View Component
interface JournalEntriesViewProps {
  userId: string;
  onViewSession: (sessionId: string) => void;
}

function JournalEntriesView({ userId, onViewSession }: JournalEntriesViewProps) {
  const [sessions, setSessions] = useState<AIJournalSessionSummary[]>([]);
  const [fullSessions, setFullSessions] = useState<{[key: string]: any}>({});
  const [regeneratingSessionId, setRegeneratingSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const { getUserSessions, getSession, loading } = useAIJournalSessions();

  const loadSessions = async () => {
    console.log('📥 Loading sessions...');
    const data = await getUserSessions(userId, 50);
    console.log('📊 Sessions data:', data);
    
    if (data) {
      const completedSessions = data.filter(session => session.ended_at);
      console.log('✅ Completed sessions:', completedSessions.length);
      setSessions(completedSessions);
      
      // Load full session data for those with analysis
      const sessionsWithAnalysis = completedSessions.filter(session => session.has_analysis);
      console.log('🧠 Sessions with analysis:', sessionsWithAnalysis.length);
      
      const fullSessionData: {[key: string]: any} = {};
      
      for (const session of sessionsWithAnalysis) {
        console.log(`🔍 Loading full session data for ${session.id}...`);
        const fullSession = await getSession(session.id, userId);
        if (fullSession && fullSession.analysis) {
          console.log(`✅ Analysis found for ${session.id}:`, fullSession.analysis);
          fullSessionData[session.id] = fullSession.analysis;
        } else {
          console.log(`❌ No analysis found for ${session.id}`);
        }
      }
      
      console.log('📋 Final fullSessions data:', fullSessionData);
      setFullSessions(fullSessionData);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [userId, getUserSessions, getSession]);

  // Function to regenerate analysis for a session
  const handleRegenerateAnalysis = async (sessionId: string) => {
    setRegeneratingSessionId(sessionId);
    
    try {
      const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
      const response = await fetch(`${backendApiDomain}/ai-journaling/sessions/${sessionId}/analysis/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const analysisData = await response.json();
        console.log('✅ Analysis response:', analysisData);
        
        // Reload sessions to get updated analysis
        await loadSessions();
        console.log('✅ Sessions reloaded after analysis');
        
        toast.success('Analysis regenerated successfully!');
      } else {
        const errorText = await response.text();
        console.error('❌ Regeneration failed:', response.status, errorText);
        throw new Error(`Failed to regenerate analysis: ${response.status}`);
      }
    } catch (error) {
      console.error('Error regenerating analysis:', error);
      toast.error('Failed to regenerate analysis. Please try again.');
    } finally {
      setRegeneratingSessionId(null);
    }
  };

  // Parse markdown summary into bullet points
  const parseSummaryPoints = (summaryMd: string): string[] => {
    console.log('🔍 Parsing summary:', summaryMd);
    if (!summaryMd) {
      console.log('❌ No summary provided');
      return [];
    }
    
    // Split by lines and filter for bullet points or numbered lists
    const lines = summaryMd.split('\n');
    console.log('📄 Lines after split:', lines);
    
    const bullets: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      console.log('🔍 Checking line:', `"${trimmed}"`);
      
      // Match markdown bullets (-, *, +) or numbered lists (1., 2., etc.)
      if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        // Remove markdown syntax and add to bullets
        const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
        console.log('✅ Found bullet:', `"${cleaned}"`);
        if (cleaned) {
          bullets.push(cleaned);
        }
      } else if (trimmed) {
        console.log('📝 Converting plain text to bullet');
        bullets.push(trimmed);
      }
    }
    
    // If we still have no bullets, try splitting by sentences
    if (bullets.length === 0 && summaryMd.trim()) {
      console.log('🔄 No bullets found, splitting by sentences');
      const sentences = summaryMd.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
      console.log('📝 Sentences found:', sentences);
      bullets.push(...sentences.slice(0, 4));
    }
    
    console.log('📋 Final bullets:', bullets);
    return bullets.slice(0, 4); // Limit to 4 bullet points for card display
  };

  // Group sessions by time periods for timeline view
  const groupSessionsByTime = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const groups = {
      today: [] as AIJournalSessionSummary[],
      pastWeek: [] as AIJournalSessionSummary[],
      older: [] as AIJournalSessionSummary[]
    };
    
    sessions.forEach(session => {
      const sessionDate = new Date(session.started_at);
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      
      if (sessionDay.getTime() === today.getTime()) {
        groups.today.push(session);
      } else if (sessionDay.getTime() >= weekAgo.getTime()) {
        groups.pastWeek.push(session);
      } else {
        groups.older.push(session);
      }
    });
    
    return groups;
  };

  // Get summary text for timeline view
  const getSummaryText = (session: AIJournalSessionSummary): string => {
    const analysis = fullSessions[session.id];
    if (analysis && analysis.summary_md) {
      const summaryPoints = parseSummaryPoints(analysis.summary_md);
      if (summaryPoints.length > 0) {
        return summaryPoints.join(' ');
      }
    }
            return 'A clarity session with thoughtful reflections and insights...';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-900 dark:text-gray-100">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading entries...</span>
              </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-16 relative">
      {/* Minimal Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-light text-gray-900 dark:text-gray-100 mb-4">Your Let Me In Entries</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-light">
            Explore your mental clarity journey
          </p>
      </div>

      {/* Switch View Button - Bottom Right */}
      <div className="fixed bottom-8 right-8 z-10">
        <Button
          onClick={() => setViewMode(viewMode === 'grid' ? 'timeline' : 'grid')}
          className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/30 transition-all duration-300 ease-in-out px-3 py-2 h-auto opacity-50 hover:opacity-100 hover:scale-105 hover:shadow-xl dark:hover:shadow-gray-900/50"
          size="sm"
        >
          <div className="flex items-center">
            <div className="transition-transform duration-300 ease-in-out group-hover:scale-110">
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </div>
            <span className="text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out ml-0 group-hover:ml-2 whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-xs transform translate-x-[-10px] group-hover:translate-x-0">
              Switch view
            </span>
          </div>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-2xl font-light text-gray-400 dark:text-gray-500 mb-4">No entries yet</h3>
          <p className="text-gray-400 dark:text-gray-500 font-light">Let yourself in to see your entries here</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-8">
          {sessions.map((session) => {
            const analysis = fullSessions[session.id];
            const summaryPoints = analysis ? parseSummaryPoints(analysis.summary_md) : [];
            
            return (
              <div 
                key={session.id}
                className="break-inside-avoid mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm dark:hover:shadow-gray-900/30 transition-all duration-300 cursor-pointer group"
                onClick={() => onViewSession(session.id)}
              >
                <div className="p-6">
                  {/* Date */}
                  <div className="text-gray-400 dark:text-gray-500 text-sm font-light mb-4">
                    {new Date(session.started_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  
                  {/* Summary Content */}
                  <div className="mb-6">
                    {summaryPoints.length > 0 ? (
                      <div className="space-y-2">
                        {summaryPoints.map((point, index) => (
                          <div key={index} className="text-gray-700 dark:text-gray-300 text-sm font-light leading-relaxed">
                            • {point}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-700 dark:text-gray-300 font-light leading-relaxed">
                        A clarity session with thoughtful reflections and insights...
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Section */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
                      <span>{session.message_count} messages</span>
                      {session.has_analysis && (
                        <span className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full mr-2"></div>
                          Analyzed
                        </span>
                      )}
                    </div>
                    
                    {/* Three dots menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {regeneratingSessionId === session.id ? (
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateAnalysis(session.id);
                          }}
                          disabled={regeneratingSessionId === session.id}
                          className="flex items-center space-x-2"
                        >
                          <Brain className="w-4 h-4" />
                          <span>{regeneratingSessionId === session.id ? 'Analyzing...' : 'Re-analyze'}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Timeline View */
        <div className="max-w-2xl mx-auto space-y-12">
          {/* Today */}
          {sessions.filter(session => {
            const sessionDate = new Date(session.started_at);
            const today = new Date();
            return sessionDate.toDateString() === today.toDateString();
          }).length > 0 && (
            <div>
              <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200 mb-8">Today</h2>
              <div className="space-y-6">
                {sessions
                  .filter(session => {
                    const sessionDate = new Date(session.started_at);
                    const today = new Date();
                    return sessionDate.toDateString() === today.toDateString();
                  })
                  .map((session) => {
                    const analysis = fullSessions[session.id];
                    const summaryText = analysis && analysis.summary_md 
                      ? parseSummaryPoints(analysis.summary_md).join(' ')
                      : 'A clarity session with thoughtful reflections and insights...';
                    
                    return (
                      <div
                        key={session.id}
                        onClick={() => onViewSession(session.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-6 transition-colors"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="text-gray-400 dark:text-gray-500 text-sm">
                              {new Date(session.started_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                              {summaryText.length > 200 
                                ? summaryText.substring(0, 200) + '...' 
                                : summaryText}
                            </p>
                            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                              draft entry
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Past Week */}
          {sessions.filter(session => {
            const sessionDate = new Date(session.started_at);
            const today = new Date();
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return sessionDate < today && sessionDate >= weekAgo && sessionDate.toDateString() !== today.toDateString();
          }).length > 0 && (
            <div>
              <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200 mb-8">Past Week</h2>
              <div className="space-y-6">
                {sessions
                  .filter(session => {
                    const sessionDate = new Date(session.started_at);
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return sessionDate < today && sessionDate >= weekAgo && sessionDate.toDateString() !== today.toDateString();
                  })
                  .map((session) => {
                    const analysis = fullSessions[session.id];
                    const summaryText = analysis && analysis.summary_md 
                      ? parseSummaryPoints(analysis.summary_md).join(' ')
                      : 'A clarity session with thoughtful reflections and insights...';
                    
                    return (
                      <div
                        key={session.id}
                        onClick={() => onViewSession(session.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-6 transition-colors"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="text-gray-400 dark:text-gray-500 text-sm">
                              {new Date(session.started_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                              {summaryText.length > 200 
                                ? summaryText.substring(0, 200) + '...' 
                                : summaryText}
                            </p>
                            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                              draft entry
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Journal Insights View Component
interface JournalInsightsViewProps {
  userId: string;
  dashboardData: AIJournalDashboardData | null;
}

function JournalInsightsView({ userId, dashboardData }: JournalInsightsViewProps) {
  const [timeRange, setTimeRange] = useState<'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'half_year' | 'this_year' | 'all_time' | 'custom'>('all_time');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState<AIJournalSessionSummary[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [isSelectingStartDate, setIsSelectingStartDate] = useState(true);
  const [emotionStats, setEmotionStats] = useState<any>(null);
  
  // Modal state management
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedEmotionStat, setSelectedEmotionStat] = useState<EmotionStat | null>(null);
  const [emotionSessions, setEmotionSessions] = useState<EmotionSession[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  
  const { getUserSessions } = useAIJournalSessions();
  const { getEmotionStats, getEmotionSummary, getEmotionSessions, loading: emotionLoading } = useEmotionStats();

  // Load actual sessions for accurate calculations
  useEffect(() => {
    const loadSessions = async () => {
      const data = await getUserSessions(userId, 100); // Load more for calculations
      if (data) {
        setSessions(data.filter(session => session.ended_at)); // Only completed sessions
      }
    };
    loadSessions();
  }, [userId, getUserSessions]);

  // Load emotion stats
  useEffect(() => {
    const loadEmotionStats = async () => {
      const timeFilter: TimeFilter = 'yearly'; // Use yearly to get most data
      const data = await getEmotionStats(userId, timeFilter);
      setEmotionStats(data);
    };
    loadEmotionStats();
  }, [userId, getEmotionStats]);

  // Calendar logic
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  
  // Adjust first day of week to match Monday start (0 = Sunday, 1 = Monday, etc.)
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - adjustedFirstDay + 1;
    const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    
    // Check if there's actually an entry on this day
    const dayDate = new Date(currentYear, currentMonth, dayNumber);
    const hasEntry = isCurrentMonth && sessions.some(session => {
      const sessionDate = new Date(session.started_at);
      return sessionDate.toDateString() === dayDate.toDateString();
    });
    
    return {
      day: isCurrentMonth ? dayNumber : null,
      hasEntry,
      isToday: isCurrentMonth && dayNumber === new Date().getDate()
    };
  });

  const weekDays = [
    { short: 'M', full: 'Monday' },
    { short: 'T', full: 'Tuesday' },
    { short: 'W', full: 'Wednesday' },
    { short: 'T', full: 'Thursday' },
    { short: 'F', full: 'Friday' },
    { short: 'S', full: 'Saturday' },
    { short: 'S', full: 'Sunday' }
  ];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filter sessions based on time range
  const getFilteredSessions = () => {
    const now = new Date();
    
    switch (timeRange) {
      case 'this_week':
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);
        return sessions.filter(session => new Date(session.started_at) >= startOfThisWeek);
      
      case 'last_week':
        const startOfLastWeek = new Date(now);
        startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
        startOfLastWeek.setHours(0, 0, 0, 0);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        endOfLastWeek.setHours(23, 59, 59, 999);
        return sessions.filter(session => {
          const sessionDate = new Date(session.started_at);
          return sessionDate >= startOfLastWeek && sessionDate <= endOfLastWeek;
        });
      
      case 'this_month':
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return sessions.filter(session => new Date(session.started_at) >= startOfThisMonth);
      
      case 'last_month':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return sessions.filter(session => {
          const sessionDate = new Date(session.started_at);
          return sessionDate >= startOfLastMonth && sessionDate <= endOfLastMonth;
        });
      
      case 'this_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
        return sessions.filter(session => new Date(session.started_at) >= startOfQuarter);
      
      case 'half_year':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        return sessions.filter(session => new Date(session.started_at) >= sixMonthsAgo);
      
      case 'this_year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return sessions.filter(session => new Date(session.started_at) >= startOfYear);
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          return sessions.filter(session => {
            const sessionDate = new Date(session.started_at);
            return sessionDate >= startDate && sessionDate <= endDate;
          });
        }
        return sessions;
      
      case 'all_time':
      default:
        return sessions;
    }
  };

  const filteredSessions = getFilteredSessions();

  // Calculate exact journaling time from start to finish
  const calculateTotalTime = () => {
    let totalMinutes = 0;
    const sessionDurations: number[] = []; // For debugging
    
    filteredSessions.forEach(session => {
      if (session.ended_at) {
        const start = new Date(session.started_at);
        const end = new Date(session.ended_at);
        const durationMs = end.getTime() - start.getTime();
        const sessionMinutes = Math.round(durationMs / 60000); // Convert to minutes
        
        // Use exact time - no caps, no filters, just raw session duration
        totalMinutes += sessionMinutes;
        sessionDurations.push(sessionMinutes);
        
        // Show detailed breakdown for each session
        const startDate = start.toLocaleDateString();
        const startTime = start.toLocaleTimeString();
        const endDate = end.toLocaleDateString();
        const endTime = end.toLocaleTimeString();
        const hours = Math.floor(sessionMinutes / 60);
        const mins = sessionMinutes % 60;
        
        console.log(`📝 Session ${session.id}:`);
        console.log(`   Started: ${startDate} at ${startTime}`);
        console.log(`   Ended: ${endDate} at ${endTime}`);
        console.log(`   Duration: ${sessionMinutes} minutes (${hours}h ${mins}m)`);
        console.log(`   ---`);
      }
    });
    
    // Debug logging to show exact calculations
    console.log('📊 All session durations (exact):', sessionDurations);
    console.log('📊 Total minutes (exact):', totalMinutes);
    console.log('📊 Average per session:', sessionDurations.length ? Math.round(totalMinutes / sessionDurations.length) : 0);
    console.log('📊 Total time in hours:', Math.round(totalMinutes / 60 * 10) / 10);
    
    return totalMinutes;
  };

  const calculateLongestStreak = () => {
    if (sessions.length === 0) return 0;
    
    // Get unique days with sessions
    const sessionDays = sessions.map(session => {
      const date = new Date(session.started_at);
      return date.toDateString();
    }).sort();
    
    const uniqueDays = Array.from(new Set(sessionDays));
    
    let longestStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < uniqueDays.length; i++) {
      const prevDate = new Date(uniqueDays[i - 1]);
      const currDate = new Date(uniqueDays[i]);
      
      // Check if days are consecutive
      const timeDiff = currDate.getTime() - prevDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return longestStreak;
  };

  const totalJournalingMinutes = calculateTotalTime();
  
  // Also calculate filtered time (sessions under 2 hours = realistic journaling)
  const calculateFilteredTime = () => {
    let totalMinutes = 0;
    let filteredCount = 0;
    
    filteredSessions.forEach(session => {
      if (session.ended_at) {
        const start = new Date(session.started_at);
        const end = new Date(session.ended_at);
        const durationMs = end.getTime() - start.getTime();
        const sessionMinutes = Math.round(durationMs / 60000);
        
        // Only count sessions under 2 hours (120 minutes) as "actual journaling"
        if (sessionMinutes <= 120) {
          totalMinutes += sessionMinutes;
          filteredCount++;
        }
      }
    });
    
    console.log(`📱 Filtered journaling time: ${totalMinutes} minutes from ${filteredCount} realistic sessions`);
    return totalMinutes;
  };
  
  const filteredJournalingMinutes = calculateFilteredTime();
  const longestStreakDays = calculateLongestStreak();
  const totalEntries = filteredSessions.length;
  
  // Debug logging
  console.log('🔍 Current timeRange:', timeRange);
  console.log('📊 All sessions:', sessions.length);
  console.log('📊 Filtered sessions:', filteredSessions.length);
  console.log('⏱️ Total minutes:', totalJournalingMinutes);

  // Generate month options for the dropdown
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      options.push({
        value: date,
        label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`
      });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  // Time range options
  const timeRangeOptions = [
    { value: 'this_week', label: 'This week' },
    { value: 'last_week', label: 'Last week' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_quarter', label: 'This quarter' },
    { value: 'half_year', label: 'Half a year' },
    { value: 'this_year', label: 'This year' },
    { value: 'all_time', label: 'All time' },
    { value: 'custom', label: 'Custom' }
  ];

  const getCurrentTimeRangeLabel = () => {
    return timeRangeOptions.find(option => option.value === timeRange)?.label || 'All time';
  };

  const getCurrentMonthLabel = () => {
    return `${monthNames[currentMonth]} ${currentYear}`;
  };

  // Calendar navigation functions
  const goToPreviousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  // Handle calendar date click
  const handleDateClick = (day: number) => {
    if (timeRange !== 'custom') return;
    
    const clickedDate = new Date(currentYear, currentMonth, day);
    
    if (isSelectingStartDate) {
      setCustomStartDate(clickedDate);
      setIsSelectingStartDate(false);
    } else {
      if (clickedDate >= customStartDate!) {
        setCustomEndDate(clickedDate);
        setIsSelectingStartDate(true);
      } else {
        // If end date is before start date, set as new start date
        setCustomStartDate(clickedDate);
        setCustomEndDate(null);
      }
    }
  };

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB'); // DD/MM/YY format
  };

  // Check if a date is in the selected range
  const isDateInRange = (day: number) => {
    if (!customStartDate || !customEndDate) return false;
    const date = new Date(currentYear, currentMonth, day);
    return date >= customStartDate && date <= customEndDate;
  };

  // Check if a date is a range endpoint
  const isRangeEndpoint = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = date.toDateString();
    return (customStartDate && customStartDate.toDateString() === dateStr) ||
           (customEndDate && customEndDate.toDateString() === dateStr);
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left side - Stats with gray background wrapper */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-8 mt-12 h-[620px]">
          {/* Header with Habit tracking title and time range dropdown */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Habit tracking</h3>
            </div>

            {/* Time Range Dropdown */}
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-gray-500 dark:text-gray-400 text-sm flex items-center hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    {getCurrentTimeRangeLabel()}
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {timeRangeOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTimeRange(option.value as 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'half_year' | 'this_year' | 'all_time' | 'custom')}
                      className={timeRange === option.value ? 'bg-accent' : ''}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 h-[496px]">
            {/* Total journaling time - Large container (title + value together) */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 relative flex flex-col">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4 text-left">Total journaling time</h3>
              <div className="flex-1"></div>
              <div className="absolute bottom-6 right-6 flex items-baseline">
                <span className="text-2xl font-light text-gray-900 dark:text-gray-100">{totalJournalingMinutes}</span>
                <span className="text-2xl font-light text-gray-900 dark:text-gray-100 ml-2">minutes</span>
              </div>
            </div>

            {/* Right side - Two smaller containers stacked */}
            <div className="space-y-4 flex flex-col">
              {/* Longest streak */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-8 relative flex flex-col flex-1">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4 text-left">Longest streak</h3>
                <div className="flex-1"></div>
                <div className="absolute bottom-6 right-6 flex items-baseline">
                  <span className="text-2xl font-light text-gray-900 dark:text-gray-100">{longestStreakDays}</span>
                  <span className="text-2xl font-light text-gray-900 dark:text-gray-100 ml-2">{longestStreakDays === 1 ? 'day' : 'days'}</span>
                </div>
              </div>

              {/* Entries */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-8 relative flex flex-col flex-1">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4 text-left">Entries</h3>
                <div className="flex-1"></div>
                <div className="absolute bottom-6 right-6">
                  <span className="text-2xl font-light text-gray-900 dark:text-gray-100">{totalEntries}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Calendar */}
        <div className="space-y-6">
          {/* Calendar grid */}
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-8 mt-12 h-[620px]">
            {/* Calendar header with month navigation */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <h3 className="text-gray-500 dark:text-gray-400 font-medium">Calendar</h3>
              </div>

              {/* Month/Year Navigation with dropdown */}
              <div className="flex items-center space-x-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-gray-500 dark:text-gray-400 text-sm flex items-center hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                      {getCurrentMonthLabel()}
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {monthOptions.map((option, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => setSelectedDate(option.value)}
                        className={
                          option.value.getMonth() === selectedDate.getMonth() && 
                          option.value.getFullYear() === selectedDate.getFullYear() 
                            ? 'bg-accent' : ''
                        }
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="h-[496px] flex flex-col">
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-md">
                {/* Week day headers */}
                <div className="grid grid-cols-7 mb-4">
                  {weekDays.map((day, index) => (
                    <div key={`${day.full}-${index}`} className="text-center text-gray-400 dark:text-gray-500 text-sm font-medium py-2">
                      {day.short}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const isClickable = timeRange === 'custom' && day.day;
                    const inRange = day.day && isDateInRange(day.day);
                    const isEndpoint = day.day && isRangeEndpoint(day.day);
                    
                    return (
                      <div
                        key={index}
                        onClick={() => day.day && handleDateClick(day.day)}
                        className={`
                          aspect-square flex items-center justify-center text-sm
                          ${day.day ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}
                          ${day.isToday ? 'bg-black dark:bg-white dark:text-black text-white rounded-full font-medium' : ''}
                          ${day.hasEntry && !day.isToday && !inRange ? 'bg-gray-100 dark:bg-gray-700 rounded-full' : ''}
                          ${inRange && !day.isToday ? 'bg-blue-100 dark:bg-blue-900' : ''}
                          ${isEndpoint && !day.isToday ? 'bg-blue-500 dark:bg-blue-600 text-white rounded-full' : ''}
                          ${isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}
                        `}
                      >
                        {day.day && <span>{day.day}</span>}
                      </div>
                    );
                  })}
                </div>
                
                {/* Custom date range display */}
                {timeRange === 'custom' && (customStartDate || customEndDate) && (
                  <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {isSelectingStartDate ? (
                      customStartDate ? (
                        <span>Start: {formatDate(customStartDate)} • Select end date</span>
                      ) : (
                        <span>Select start date</span>
                      )
                    ) : (
                      <span>
                        Range: {formatDate(customStartDate)} - {formatDate(customEndDate) || 'Select end date'}
                      </span>
                    )}
                  </div>
                                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Emotional State Analysis Section - Full Width */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Heart className="h-5 w-5 mr-2" />
              Emotional State Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmotionBubbles
              emotions={emotionStats?.emotions || []}
              onBubbleClick={async (emotion) => {
                console.log(`Bubble clicked: ${emotion}`);
                console.log('Setting modal state - selectedEmotion:', emotion, 'isModalOpen: true');
                
                setSelectedEmotion(emotion);
                setIsModalOpen(true);
                
                try {
                  console.log('Calling getEmotionSummary for:', userId, emotion);
                  const emotionStat = await getEmotionSummary(userId, emotion);
                  console.log('Emotion stat result:', emotionStat);
                  setSelectedEmotionStat(emotionStat);
                  
                  // Fetch individual emotion sessions
                  console.log('Calling getEmotionSessions for:', userId, emotion);
                  setSessionsLoading(true);
                  const sessions = await getEmotionSessions(userId, emotion, 'yearly');
                  console.log('Emotion sessions result:', sessions);
                  setEmotionSessions(sessions);
                  setSessionsLoading(false);
                } catch (error) {
                  console.error('Error loading emotion data:', error);
                  toast.error('Failed to load emotion data');
                  setSessionsLoading(false);
                }
              }}
              loading={emotionLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Emotion Summary Modal */}
      {selectedEmotion && isModalOpen && (
        <EmotionSummaryModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmotion(null);
            setSelectedEmotionStat(null);
            setEmotionSessions(null);
            setSessionsLoading(false);
          }}
          emotion={selectedEmotion}
          emotionStat={selectedEmotionStat}
          entryCount={emotionStats?.emotions.find((e: any) => e.emotion === selectedEmotion)?.entryCount || 0}
          loading={emotionLoading}
          emotionSessions={emotionSessions}
          sessionsLoading={sessionsLoading}
        />
      )}

    </div>
  );
}

// CSS for gradient text (add to globals.css)
const styles = `
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
`; 