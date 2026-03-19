"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// ScrollArea component replaced with regular scrollable div
import { 
  ArrowLeft, 
  Brain,
  TrendingUp,
  Calendar,
  BarChart3,
  Lightbulb,
  Heart,
  Target,
  Loader2,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAIJournalSessions, AIJournalDashboardData } from '@/app/ai-journal/services/useAIJournalSessions';
import { useEmotionStats, EmotionStatsResponse, TimeFilter } from '@/app/ai-journal/services/useEmotionStats';
import { EmotionBubbles } from '@/components/ai-journal/EmotionBubbles';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InsightsPanelProps {
  userId: string;
  onBack: () => void;
}

// Mock data for demonstration - in a real app, this would come from the API
const mockInsights = {
  patterns: [
    {
      title: "Most Active Time",
      value: "Evening (7-9 PM)",
      description: "You tend to journal most frequently in the evening hours",
      icon: Calendar,
      color: "text-blue-500"
    },
    {
      title: "Average Session Length",
      value: "12 minutes",
      description: "Your typical journaling session lasts about 12 minutes",
      icon: BarChart3,
      color: "text-green-500"
    },
    {
      title: "Consistency Score",
      value: "85%",
      description: "You maintain a strong journaling habit",
      icon: Target,
      color: "text-purple-500"
    }
  ],
  emotionalJourney: [
    {
      period: "This Week",
      emotions: {
        "gratitude": 0.85,
        "curiosity": 0.78,
        "reflection": 0.72,
        "growth": 0.68,
        "peace": 0.65
      }
    },
    {
      period: "Last Week",
      emotions: {
        "anxiety": 0.72,
        "reflection": 0.68,
        "determination": 0.65,
        "hope": 0.62,
        "curiosity": 0.58
      }
    }
  ],
  recommendations: [
    {
      title: "Morning Reflection",
      description: "Consider adding a brief morning journaling session to complement your evening practice",
      type: "habit"
    },
    {
      title: "Gratitude Focus",
      description: "Your recent entries show high gratitude - explore this theme deeper",
      type: "content"
    },
    {
      title: "Weekly Review",
      description: "Create a weekly summary of your key insights and growth areas",
      type: "practice"
    }
  ]
};

export function InsightsPanel({ userId, onBack }: InsightsPanelProps) {
  const [dashboardData, setDashboardData] = useState<AIJournalDashboardData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('month');
  const [emotionStats, setEmotionStats] = useState<EmotionStatsResponse | null>(null);

  const {
    getDashboard,
    loading,
    error
  } = useAIJournalSessions();

  const {
    getEmotionStats,
    loading: emotionLoading,
    error: emotionError
  } = useEmotionStats();

  // Load dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      const data = await getDashboard(userId);
      if (data) {
        setDashboardData(data);
      } else if (error) {
        toast.error('Failed to load insights data');
      }
    };

    loadDashboard();
  }, [userId, getDashboard, error]);

  // Load emotion stats data
  useEffect(() => {
    const loadEmotionStats = async () => {
      const timeFilter: TimeFilter = selectedTimeRange === 'week' ? 'weekly' : 
                                     selectedTimeRange === 'month' ? 'monthly' : 'yearly';
      const data = await getEmotionStats(userId, timeFilter);
      if (data) {
        setEmotionStats(data);
      } else if (emotionError) {
        toast.error('Failed to load emotion data');
      }
    };

    loadEmotionStats();
  }, [userId, selectedTimeRange, getEmotionStats, emotionError]);

  // Handle bubble click - simple placeholder since modal moved to AIJournalDashboard
  const handleBubbleClick = (emotion: string) => {
    console.log('Bubble clicked:', emotion);
    // Note: Modal functionality moved to AIJournalDashboard.tsx
  };

  // Refresh insights
  const handleRefresh = async () => {
    const data = await getDashboard(userId);
    if (data) {
      setDashboardData(data);
      
      // Refresh emotion stats too
      const timeFilter: TimeFilter = selectedTimeRange === 'week' ? 'weekly' : 
                                     selectedTimeRange === 'month' ? 'monthly' : 'yearly';
      const emotionData = await getEmotionStats(userId, timeFilter);
      if (emotionData) {
        setEmotionStats(emotionData);
      }
      
      toast.success('Insights refreshed');
    }
  };

  // Get emotion color based on intensity
  const getEmotionColor = (intensity: number) => {
    if (intensity >= 0.8) return 'text-green-600 bg-green-100';
    if (intensity >= 0.6) return 'text-blue-600 bg-blue-100';
    if (intensity >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Get insights based on time range
  const getTimeRangeData = () => {
    if (!dashboardData) return null;
    
    switch (selectedTimeRange) {
      case 'week':
        return {
          label: 'This Week',
          sessions: dashboardData.sessions_this_week,
          emotions: dashboardData.common_emotions
        };
      case 'month':
        return {
          label: 'This Month',
          sessions: dashboardData.sessions_this_month,
          emotions: dashboardData.common_emotions
        };
      case 'all':
        return {
          label: 'All Time',
          sessions: dashboardData.total_sessions,
          emotions: dashboardData.common_emotions
        };
      default:
        return null;
    }
  };

  const timeRangeData = getTimeRangeData();

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading insights...</span>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold">Insights & Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Discover patterns and growth in your journaling journey
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Button
              variant={selectedTimeRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('week')}
            >
              This Week
            </Button>
            <Button
              variant={selectedTimeRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('month')}
            >
              This Month
            </Button>
            <Button
              variant={selectedTimeRange === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange('all')}
            >
              All Time
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockInsights.patterns.map((pattern, index) => {
          const IconComponent = pattern.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{pattern.title}</p>
                    <p className="text-2xl font-bold mt-1">{pattern.value}</p>
                    <p className="text-sm text-muted-foreground mt-2">{pattern.description}</p>
                  </div>
                  <IconComponent className={cn("h-8 w-8", pattern.color)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emotional Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Heart className="h-5 w-5 mr-2" />
              Emotional Patterns - {timeRangeData?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeRangeData?.emotions && Object.keys(timeRangeData.emotions).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(timeRangeData.emotions)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([emotion, intensity]) => (
                    <div key={emotion} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant="outline" 
                          className={cn("capitalize", getEmotionColor(intensity))}
                        >
                          {emotion}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                            style={{ width: `${intensity * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">
                          {Math.round(intensity * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No emotional data available yet</p>
                <p className="text-sm">Continue journaling to see patterns emerge</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lightbulb className="h-5 w-5 mr-2" />
              Personalized Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] overflow-y-auto">
              <div className="space-y-4">
                {mockInsights.recommendations.map((rec, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {rec.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emotional Journey Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Emotional Journey Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {mockInsights.emotionalJourney.map((period, index) => (
              <div key={index}>
                <h4 className="font-medium mb-3">{period.period}</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(period.emotions).map(([emotion, intensity]) => (
                    <div key={emotion} className="text-center">
                      <div 
                        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white font-medium mb-2"
                        style={{
                          background: `linear-gradient(135deg, hsl(${intensity * 120}, 70%, 50%), hsl(${intensity * 120}, 70%, 60%))`
                        }}
                      >
                        {Math.round(intensity * 100)}%
                      </div>
                      <p className="text-xs capitalize">{emotion}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Growth Insights */}
      {dashboardData && dashboardData.total_sessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Growth Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Journey Summary</h4>
                <p className="text-sm text-muted-foreground">
                  You've completed <strong>{dashboardData.total_sessions}</strong> journaling sessions, 
                  with <strong>{dashboardData.sessions_this_month}</strong> sessions this month. 
                  {dashboardData.sessions_this_week > 0 && (
                    <span> You're on track with <strong>{dashboardData.sessions_this_week}</strong> sessions this week.</span>
                  )}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Next Steps</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Continue your consistent journaling practice</li>
                  <li>• Explore the emotions that appear frequently</li>
                  <li>• Consider setting weekly reflection goals</li>
                  <li>• Share insights with a trusted friend or mentor</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emotional State Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Heart className="h-5 w-5 mr-2" />
            Emotional State Analysis - {timeRangeData?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Debug panel */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <h4 className="font-medium mb-2">Debug Information:</h4>
            <p>• Loading: {String(emotionLoading)}</p>
            <p>• Has emotion stats: {emotionStats ? 'Yes' : 'No'}</p>
            <p>• Emotion count: {emotionStats?.emotions?.length || 0}</p>
            <p>• Total sessions: {emotionStats?.totalSessions || 0}</p>
            <p>• User ID: {userId}</p>
            <p>• Time range: {selectedTimeRange}</p>
            <p>• Backend API: {process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN}</p>
            <button 
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs"
              onClick={async () => {
                console.log('🧪 Manual API test starting...');
                const timeFilter: TimeFilter = selectedTimeRange === 'week' ? 'weekly' : 
                                               selectedTimeRange === 'month' ? 'monthly' : 'yearly';
                const result = await getEmotionStats(userId, timeFilter);
                console.log('🧪 Manual test result:', result);
              }}
            >
              Test API Call
            </button>
          </div>
          
          <EmotionBubbles
            emotions={emotionStats?.emotions || []}
            onBubbleClick={handleBubbleClick}
            loading={emotionLoading}
          />
        </CardContent>
      </Card>

    </div>
  );
} 