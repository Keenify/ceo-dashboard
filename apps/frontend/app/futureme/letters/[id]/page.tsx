'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useFutureLetters, FutureLetterResponse } from '../../services/useFutureLetters';
import { decryptContent, isContentEncrypted } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Clock, Paperclip, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInMonths, differenceInYears } from 'date-fns';

export default function ReadLetterPage() {
  const router = useRouter();
  const params = useParams();
  const letterId = params?.id as string;
  
  const [user, setUser] = useState<any>(null);
  const [letter, setLetter] = useState<FutureLetterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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

  // Decrypt letter content
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

  // Fetch the specific letter
  useEffect(() => {
    const loadLetter = async () => {
      if (user?.id && letterId) {
        setIsLoading(true);
        const result = await fetchUserLetters(user.id);
        if (result) {
          const foundLetter = result.find(l => l.id === letterId);
          if (foundLetter) {
            const decryptedLetter = decryptLetterContent(foundLetter);
            setLetter(decryptedLetter);
          } else {
            toast.error("Letter not found");
            router.push('/futureme/letters');
          }
        }
        setIsLoading(false);
      }
    };

    if (user) loadLetter();
  }, [user, letterId, fetchUserLetters, router]);

  // Calculate word count
  const getWordCount = (content: string) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Calculate time travel duration
  const getTimeTravelDuration = (sendDate: string) => {
    const now = new Date();
    const send = parseISO(sendDate);
    
    const years = differenceInYears(send, now);
    const months = differenceInMonths(send, now) % 12;
    
    if (years > 0) {
      if (months > 0) {
        return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
      }
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      return "less than a month";
    }
  };

  // Extract filename from URL
  const getFilenameFromUrl = (url: string) => {
    try {
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      // Remove any query parameters
      return filename.split('?')[0];
    } catch (error) {
      return 'attachment';
    }
  };

  // Handle attachment download
  const handleDownloadAttachment = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  // Handle letter edit
  const handleEdit = () => {
    if (!letter) return;
    
    // Navigate back to main page with letter data in URL params
    const params = new URLSearchParams({
      edit: letter.id,
      subject: letter.email_subject || '',
      content: letter.email_content,
      email: letter.recipient_email,
      date: letter.send_date,
      status: letter.send_status,
      attachments: JSON.stringify(letter.attachment_urls || [])
    });
    
    router.push(`/futureme?${params.toString()}`);
  };

  // Handle letter deletion
  const handleDelete = async () => {
    if (!user?.id || !letter) return;
    
    try {
      const success = await deleteLetter(letter.id, user.id);
      if (success) {
        toast.success("Letter deleted successfully");
        router.push('/futureme/letters');
      }
    } catch (err) {
      toast.error("Failed to delete letter");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading your letter...</p>
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Letter not found</p>
      </div>
    );
  }

  const wordCount = getWordCount(letter.email_content);
  const timeDuration = getTimeTravelDuration(letter.send_date);

  return (
    <div className="min-h-screen">
      {/* Dark Blue Header */}
      <div className="bg-blue-900 text-white py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push('/futureme/letters')}
            className="text-white hover:bg-blue-800 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Letters
          </Button>
          
          {/* Time Travel Info */}
          <div className="flex items-center gap-2 mb-4 text-blue-200">
            <Clock className="h-4 w-4" />
            <span>Time Travelling — {timeDuration}</span>
          </div>
          
          {/* Letter Title */}
          <h1 className="text-4xl font-bold mb-4">
            {letter.email_subject || `A letter from ${format(parseISO(letter.send_date), 'MMM d, yyyy')}`}
          </h1>
          
          {/* Date Range */}
          <p className="text-xl mb-4 text-blue-100">
            {format(new Date(letter.created_at || letter.send_date), 'MMM d, yyyy')} → {format(parseISO(letter.send_date), 'MMM d, yyyy')}
          </p>
          
          {/* Letter Info */}
          <div className="flex items-center gap-6 mb-6 text-blue-100">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
            </div>
            <div>
              <span>Recipients: {letter.recipient_email}</span>
            </div>
            {letter.attachment_urls && letter.attachment_urls.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                <span>{letter.attachment_urls.length} attachment{letter.attachment_urls.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleEdit}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <div className="text-xl font-medium text-foreground mb-6">Dear FutureMe,</div>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap">
              {letter.email_content}
            </div>
          </div>
          
          {/* Attachments Section */}
          {letter.attachment_urls && letter.attachment_urls.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments ({letter.attachment_urls.length})
              </h3>
              <div className="grid gap-3">
                {letter.attachment_urls.map((url, index) => {
                  const filename = getFilenameFromUrl(url);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="text-foreground font-medium">{filename}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAttachment(url, filename)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 