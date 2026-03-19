"use client";

import React from 'react';
import { EmotionStat, EmotionSession } from '@/app/ai-journal/services/useEmotionStats';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, BarChart3, Loader2, Calendar, FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmotionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  emotion: string;
  emotionStat: EmotionStat | null;
  entryCount: number;
  loading?: boolean;
  emotionSessions?: EmotionSession[] | null;
  sessionsLoading?: boolean;
}

export function EmotionSummaryModal({ 
  isOpen, 
  onClose, 
  emotion, 
  emotionStat,
  entryCount,
  loading = false,
  emotionSessions = null,
  sessionsLoading = false
}: EmotionSummaryModalProps) {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="capitalize text-xl">{emotion}</span>
              <span className="text-lg text-muted-foreground ml-2">Analysis</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            AI-generated insights across {entryCount} journal {entryCount === 1 ? 'session' : 'sessions'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="ml-3 text-muted-foreground">Loading emotion analysis...</span>
            </div>
          ) : !emotionStat ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Brain className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-muted-foreground text-lg">No analysis available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Analysis will be generated automatically as you continue journaling
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <BarChart3 className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{emotionStat.session_count}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Badge 
                        variant="outline" 
                        className="bg-purple-50 text-purple-700 border-purple-200 text-sm px-3 py-1"
                      >
                        <span className="capitalize">{emotion}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Primary Emotion</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-sm font-medium">{formatDate(emotionStat.created_at)}</p>
                    <p className="text-sm text-muted-foreground">First Recorded</p>
                  </CardContent>
                </Card>
              </div>

              {/* AI Analysis Summary */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold">AI-Generated Analysis</h3>
                  </div>
                  
                  {emotionStat.summary_all ? (
                    <div className="prose prose-gray max-w-none">
                      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-500">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {emotionStat.summary_all}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        AI analysis is being generated for your {emotion} sessions
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check back soon for personalized insights
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Insights */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    Pattern Insights
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Frequency</h4>
                      <p className="text-sm text-blue-700">
                        You've experienced <strong>{emotion}</strong> in{" "}
                        <strong>{emotionStat.session_count}</strong> journaling{" "}
                        {emotionStat.session_count === 1 ? 'session' : 'sessions'}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Recognition</h4>
                      <p className="text-sm text-green-700">
                        Great self-awareness! Identifying and journaling about{" "}
                        <strong>{emotion}</strong> helps with emotional intelligence
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Entry Details */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Individual Entry Details
                  </h3>
                  
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                      <span className="ml-3 text-muted-foreground">Loading entries...</span>
                    </div>
                  ) : !emotionSessions || emotionSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No individual entries found for {emotion}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Continue journaling to see detailed session entries here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {emotionSessions.map((session, index) => {
                        const { date, time } = formatDateTime(session.created_at);
                        return (
                          <div
                            key={session.session_id}
                            className="border border-gray-200 hover:border-purple-300 transition-colors duration-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-2 py-1"
                                >
                                  Entry #{index + 1}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className="bg-gray-50 text-gray-600 border-gray-200 text-xs px-2 py-1 capitalize"
                                >
                                  {session.emotion}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Session Summary</span>
                              </div>
                              <div className="bg-gray-50 rounded-md p-3 border-l-4 border-purple-300">
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {session.summary || 'No summary available for this session.'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{date}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{time}</span>
                              </div>
                              <div className="ml-auto text-xs text-gray-400">
                                Session ID: {session.session_id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}