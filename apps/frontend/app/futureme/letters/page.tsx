'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useFutureLetters, FutureLetterResponse } from '../services/useFutureLetters';
import { decryptContent, isContentEncrypted } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInHours, differenceInMinutes, differenceInDays } from 'date-fns';

function MyLettersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [letters, setLetters] = useState<FutureLetterResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'travelling' | 'delivered'>('travelling');
  const [sortBy, setSortBy] = useState<string>('earliest-delivery');
  
  const { 
    fetchUserLetters, 
    deleteLetter,
    error 
  } = useFutureLetters();

  // Get the current user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
    };
    getUser();
  }, [router]);

  // Decrypt a single letter's email content
  const decryptLetterContent = (letter: FutureLetterResponse): FutureLetterResponse => {
    if (!letter.email_content || !isContentEncrypted(letter.email_content)) {
      return letter;
    }
    
    try {
      const decryptedContent = decryptContent(letter.email_content);
      return {
        ...letter,
        email_content: decryptedContent
      };
    } catch (error) {
      console.error('Error decrypting letter content:', error);
      return letter;
    }
  };
  
  // Decrypt a list of letters' email content
  const decryptLettersList = (lettersList: FutureLetterResponse[]): FutureLetterResponse[] => {
    return lettersList.map(letter => decryptLetterContent(letter));
  };

  // Fetch user letters
  useEffect(() => {
    const loadLetters = async () => {
      if (user?.id) {
        setIsLoading(true);
        const result = await fetchUserLetters(user.id);
        if (result) {
          const decryptedLetters = decryptLettersList(result);
          setLetters(decryptedLetters);
        }
        setIsLoading(false);
      }
    };

    if (user) loadLetters();
  }, [user, fetchUserLetters]);

  // Calculate word count
  const getWordCount = (content: string) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Calculate time remaining for editing
  const getTimeRemaining = (sendDate: string) => {
    const send = parseISO(sendDate);
    const now = new Date();
    
    if (send <= now) return null; // Already sent or past due
    
    const totalHours = differenceInHours(send, now);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = differenceInMinutes(send, now) % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Handle letter deletion
  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    
    try {
      const success = await deleteLetter(id, user.id);
      if (success) {
        setLetters(prev => prev.filter(letter => letter.id !== id));
        toast.success("Letter deleted successfully");
      }
    } catch (err) {
      toast.error("Failed to delete letter");
    }
  };

  // Handle read letter
  const handleRead = (letter: FutureLetterResponse) => {
    // Navigate to the dedicated reading page
    router.push(`/futureme/letters/${letter.id}`);
  };

  // Sort letters function
  const sortLetters = (lettersToSort: FutureLetterResponse[]) => {
    return [...lettersToSort].sort((a, b) => {
      switch (sortBy) {
        case 'earliest-writing':
          return new Date(a.created_at || a.send_date).getTime() - new Date(b.created_at || b.send_date).getTime();
        case 'recent-writing':
          return new Date(b.created_at || b.send_date).getTime() - new Date(a.created_at || a.send_date).getTime();
        case 'earliest-delivery':
          return new Date(a.send_date).getTime() - new Date(b.send_date).getTime();
        case 'recent-delivery':
          return new Date(b.send_date).getTime() - new Date(a.send_date).getTime();
        default:
          return new Date(a.send_date).getTime() - new Date(b.send_date).getTime();
      }
    });
  };

  // Filter letters by status
  const travellingLetters = letters.filter(letter => letter.send_status !== 'sent');
  const deliveredLetters = letters.filter(letter => letter.send_status === 'sent');
  
  // Get filtered and sorted letters based on active tab
  const filteredLetters = sortLetters(activeTab === 'travelling' ? travellingLetters : deliveredLetters);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Loading your letters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Future Letters</h1>
          <p className="text-muted-foreground">
            {letters.length} {letters.length === 1 ? 'letter' : 'letters'} to your future self
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => router.push('/futureme')}
          className="flex items-center gap-2"
        >
          Write a new letter
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('travelling')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'travelling'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-1">
              <span>📄</span>
              <span>{travellingLetters.length}</span>
            </div>
            <span>Time Travelling Letters</span>
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'delivered'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-1">
              <span>✅</span>
              <span>{deliveredLetters.length}</span>
            </div>
            <span>Delivered Letters</span>
          </button>
        </div>
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-muted-foreground">Sort by</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="earliest-writing">Earliest writing date</SelectItem>
            <SelectItem value="recent-writing">Most recent writing date</SelectItem>
            <SelectItem value="earliest-delivery">Earliest delivery date</SelectItem>
            <SelectItem value="recent-delivery">Most recent delivery date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Letters List */}
      <div className="space-y-4">
        {filteredLetters.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {activeTab === 'travelling' ? 'No letters scheduled for delivery' : 'No letters delivered yet'}
            </p>
            {activeTab === 'travelling' && (
              <Button onClick={() => router.push('/futureme')}>
                Write Your First Letter
              </Button>
            )}
          </Card>
        ) : (
          filteredLetters.map((letter) => {
            const timeRemaining = getTimeRemaining(letter.send_date);
            const wordCount = getWordCount(letter.email_content);
            const isEditable = letter.send_status !== 'sent' && timeRemaining;
            
            return (
              <Card key={letter.id} className="p-6">
                <div className="space-y-4">
                  {/* Header with Title and Action Buttons */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Status Badge */}
                      {isEditable && timeRemaining && (
                        <div className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium mb-3">
                          Editable for {timeRemaining}
                        </div>
                      )}
                      {letter.send_status === 'sent' && (
                        <div className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium mb-3">
                          Sent
                        </div>
                      )}
                      
                      {/* Title */}
                      <h3 className="text-xl font-semibold text-blue-600">
                        A letter from {format(parseISO(letter.send_date), 'MMM d, yyyy')}
                      </h3>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        onClick={() => handleRead(letter)}
                      >
                        Read now
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(letter.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  {/* Letter Details Grid - Now below the buttons */}
                  <div className="text-sm">
                    {/* Desktop Layout */}
                    <div className="hidden lg:grid lg:gap-6" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                      <div className="min-w-0">
                        <p className="text-muted-foreground mb-1">Creation Date</p>
                        <p className="font-medium">
                          {format(new Date(letter.created_at || letter.send_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-muted-foreground mb-1">Send Date</p>
                        <p className="font-medium">
                          → {format(parseISO(letter.send_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-muted-foreground mb-1">Words</p>
                        <p className="font-medium">{wordCount}</p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-muted-foreground mb-1">1 Recipient</p>
                        <p className="font-medium text-blue-600" title={letter.recipient_email}>
                          {letter.recipient_email}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-muted-foreground mb-1">Email Subject</p>
                        <p className="font-medium break-words leading-tight">
                          {letter.email_subject || 'No subject'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Mobile/Tablet Layout */}
                    <div className="lg:hidden space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground mb-1">Creation Date</p>
                          <p className="font-medium">
                            {format(new Date(letter.created_at || letter.send_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Send Date</p>
                          <p className="font-medium">
                            → {format(parseISO(letter.send_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground mb-1">Words</p>
                          <p className="font-medium">{wordCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">1 Recipient</p>
                          <p className="font-medium text-blue-600">
                            {letter.recipient_email}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Email Subject</p>
                        <p className="font-medium break-words">
                          {letter.email_subject || 'No subject'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function MyLettersPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Loading your letters...</p>
        </div>
      </div>
    }>
      <MyLettersContent />
    </Suspense>
  );
}