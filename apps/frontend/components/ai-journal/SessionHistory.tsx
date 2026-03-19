"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// ScrollArea component replaced with regular scrollable div
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Calendar, 
  MessageCircle, 
  Brain,
  Sparkles,
  Clock,
  Search,
  Filter,
  Loader2,
  Eye,
  Trash2
} from 'lucide-react';
import { useAIJournalSessions, AIJournalSessionSummary } from '@/app/ai-journal/services/useAIJournalSessions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SessionHistoryProps {
  userId: string;
  onBack: () => void;
  onViewSession: (sessionId: string) => void;
}

export function SessionHistory({ userId, onBack, onViewSession }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<AIJournalSessionSummary[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AIJournalSessionSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with-analysis' | 'with-artworks'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const {
    getUserSessions,
    deleteSession,
    loading,
    error
  } = useAIJournalSessions();

  const SESSIONS_PER_PAGE = 20;

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      const data = await getUserSessions(userId, SESSIONS_PER_PAGE * currentPage);
      if (data) {
        if (currentPage === 1) {
          setSessions(data);
        } else {
          setSessions(prev => [...prev, ...data]);
        }
        setHasMore(data.length === SESSIONS_PER_PAGE * currentPage);
      } else if (error) {
        toast.error('Failed to load sessions');
      }
    };

    loadSessions();
  }, [userId, currentPage, getUserSessions, error]);

  // Filter sessions based on search and filter type
  useEffect(() => {
    let filtered = sessions;

    // Apply filter type
    if (filterType === 'with-analysis') {
      filtered = filtered.filter(session => session.has_analysis);
    } else if (filterType === 'with-artworks') {
      filtered = filtered.filter(session => session.has_artworks);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(session => {
        const date = new Date(session.started_at).toLocaleDateString().toLowerCase();
        return date.includes(query);
      });
    }

    setFilteredSessions(filtered);
  }, [sessions, searchQuery, filterType]);

  // Load more sessions
  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering onViewSession
    
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    const success = await deleteSession(sessionId, userId);
    if (success) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session deleted successfully');
    } else {
      toast.error('Failed to delete session');
    }
  };

  // Format session duration
  const formatDuration = (startedAt: string, endedAt?: string) => {
    if (!endedAt) return 'In progress';
    
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.round(durationMs / 60000);
    
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Get session stats
  const getSessionStats = () => {
    const total = sessions.length;
    const withAnalysis = sessions.filter(s => s.has_analysis).length;
    const withArtworks = sessions.filter(s => s.has_artworks).length;
    const completed = sessions.filter(s => s.ended_at).length;
    
    return { total, withAnalysis, withArtworks, completed };
  };

  const stats = getSessionStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your journaling sessions
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">With Analysis</p>
                <p className="text-2xl font-bold">{stats.withAnalysis}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">With Artworks</p>
                <p className="text-2xl font-bold">{stats.withArtworks}</p>
              </div>
              <Sparkles className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                All
              </Button>
              <Button
                variant={filterType === 'with-analysis' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('with-analysis')}
              >
                <Brain className="h-4 w-4 mr-1" />
                With Analysis
              </Button>
              <Button
                variant={filterType === 'with-artworks' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('with-artworks')}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                With Art
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sessions ({filteredSessions.length})</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">
                {sessions.length === 0 ? 'No sessions yet' : 'No sessions match your filters'}
              </p>
              <p className="text-sm">
                {sessions.length === 0 
                  ? 'Start journaling to see your sessions here' 
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
            </div>
          ) : (
            <div className="h-[600px] overflow-y-auto">
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors",
                      "group relative"
                    )}
                    onClick={() => onViewSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div 
                          className={cn(
                            "w-3 h-3 rounded-full",
                            session.ended_at ? "bg-green-500" : "bg-yellow-500"
                          )}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">
                              {new Date(session.started_at).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {new Date(session.started_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <MessageCircle className="h-3 w-3 mr-1" />
                              {session.message_count} messages
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(session.started_at, session.ended_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          {session.has_analysis && (
                            <Badge variant="secondary" className="text-xs">
                              <Brain className="h-3 w-3 mr-1" />
                              Analysis
                            </Badge>
                          )}
                          {session.has_artworks && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Art
                            </Badge>
                          )}
                          {!session.ended_at && (
                            <Badge variant="outline" className="text-xs">
                              In Progress
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewSession(session.id);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Load More Button */}
          {filteredSessions.length > 0 && hasMore && !loading && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={handleLoadMore}>
                Load More Sessions
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 