'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useFutureLetters, FutureLetterResponse } from './services/useFutureLetters';
import { encryptContent, decryptContent, isContentEncrypted } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, CalendarIcon, History, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths, addYears, addHours } from 'date-fns';
import { cn } from '@/lib/utils';

import FileUploader from '@/components/ui/file-uploader';
import { Lightbulb } from 'lucide-react';

function FutureMeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [letters, setLetters] = useState<FutureLetterResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingEncryption, setIsProcessingEncryption] = useState(false);
  
  // Form state
  const [letterContent, setLetterContent] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('A message to my future self');
  const [deliveryOption, setDeliveryOption] = useState<string>('6months');
  const [customDate, setCustomDate] = useState<Date>();
  const [selectedLetter, setSelectedLetter] = useState<FutureLetterResponse | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [sendStatus, setSendStatus] = useState<'scheduled' | 'sent' | 'failed'>('scheduled');
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  
  // Form validation errors
  const [errors, setErrors] = useState<{
    letterContent?: string;
    recipientEmail?: string;
  }>({});

  // Inspire Me prompts
  const inspirePrompts = [
    "Future me, I hope you remember how determined I was today to...",
    "I'm writing this because I want you to know that right now I'm feeling...",
    "Future me, please don't forget that today I decided to...",
    "I hope by the time you read this, you've finally achieved...",
    "Right now I'm struggling with... but I believe you've overcome it.",
    "Future me, I want you to remember that today I was brave enough to...",
    "I'm so excited about... and I hope it turned out even better than I imagined.",
    "Future me, if you're feeling lost, remember that today I felt...",
    "I hope you're still as passionate about... as I am right now.",
    "Future me, I need you to know that today I chose to believe in...",
    "Right now my biggest dream is... I hope you made it happen.",
    "Future me, please remember how much... means to me today.",
    "I'm writing this on a day when I felt really proud of myself for...",
    "Future me, I hope you never stopped being the person who...",
    "Today I learned something important about myself:...",
    "Future me, I hope you remember how grateful I felt today for...",
    "Right now I'm worried about... but I trust that you figured it out.",
    "Future me, I want you to know that today I had the courage to...",
    "I hope by now you've forgiven yourself for... like I'm trying to today.",
    "Future me, never forget that today someone told me..."
  ];

  // Get a random prompt
  const getRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * inspirePrompts.length);
    return inspirePrompts[randomIndex];
  };

  // Handle showing new inspiration
  const handleInspireMe = () => {
    const newPrompt = getRandomPrompt();
    setCurrentPrompt(newPrompt);
  };

  // Handle inserting inspiration prompt
  const handleInsertPrompt = (prompt: string) => {
    const currentContent = letterContent;
    const newContent = currentContent 
      ? `${currentContent}\n\n${prompt}\n\n` 
      : `${prompt}\n\n`;
    setLetterContent(newContent);
    setCurrentPrompt(''); // Hide the prompt after inserting
    // Clear any content errors since we're adding content
    if (errors.letterContent) {
      setErrors(prev => ({ ...prev, letterContent: undefined }));
    }
  };
  
  const { 
    createFutureLetter, 
    fetchUserLetters, 
    deleteLetter,
    updateFutureLetter,
    error 
  } = useFutureLetters();

  // Ensure encryption key is available even if env variable is not loaded
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_EMAIL_CONTENT_ENCRYPTION_KEY) {
      // Only in development, set the key directly if missing from env
      if (process.env.NODE_ENV === 'development') {
        // @ts-ignore - deliberately setting env var
        process.env.NEXT_PUBLIC_EMAIL_CONTENT_ENCRYPTION_KEY = "Eiil3LIJyRjZFdVBLSWfjNuy65kzISW7736R5dnAtEs=";
      }
    }
  }, []);

  // Get the current user
  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
      setRecipientEmail(data.user.email || '');
      setLoading(false);
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

  // Form validation
  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    // Content validation
    if (!letterContent.trim()) {
      newErrors.letterContent = 'Please write your letter content';
    } else if (letterContent.trim().length < 10) {
      newErrors.letterContent = 'Content must be at least 10 characters';
    }
    
    // Email validation
    if (!recipientEmail.trim()) {
      newErrors.recipientEmail = 'Please enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      newErrors.recipientEmail = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate delivery date based on selected option
  const getDeliveryDate = () => {
    const now = new Date();
    switch (deliveryOption) {
      case '6months':
        return addMonths(now, 6);
      case '1year':
        return addYears(now, 1);
      case '3years':
        return addYears(now, 3);
      case '5years':
        return addYears(now, 5);
      case '10years':
        return addYears(now, 10);
      case 'custom':
        return customDate || addYears(now, 1);
      default:
        return addYears(now, 1);
    }
  };

  // Handle file changes
  const handleFileChange = (fileUrls: string[]) => {
    setAttachmentUrls(fileUrls);
  };

  // Check if form should be disabled
  const isFormDisabled = selectedLetter?.send_status === 'sent';

  // Handle form submission
  const handleSubmit = async () => {
    if (!user?.id) return;
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setIsProcessingEncryption(true);
    
    try {
      // Verify encryption - if it's not encrypted, try to encrypt it here as a fallback
      let emailContent = letterContent;
      
      try {
        if (!isContentEncrypted(letterContent) && letterContent.length > 0) {
          emailContent = encryptContent(letterContent);
        }
      } catch (encryptionError) {
        // If encryption fails, use original content and log error
        console.error('Encryption failed:', encryptionError);
        emailContent = letterContent;
      }
      
      // Get delivery date
      const deliveryDate = getDeliveryDate();
      
      // Adjust the date for Singapore timezone (UTC+8)
      // This prevents date changes when converting to ISO string
      const sgDate = addHours(deliveryDate, 8);
      
      // Format values for API (email_content should be encrypted by now)
      const formattedValues = {
        user_id: user.id,
        recipient_email: recipientEmail,
        email_subject: emailSubject || `Letter to Future Me - ${format(deliveryDate, 'MMM d, yyyy')}`,
        email_content: emailContent, // Use the verified encrypted content
        send_date: sgDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        send_status: sendStatus,
        // Ensure attachment_urls is explicitly included and not null
        attachment_urls: Array.isArray(attachmentUrls) ? attachmentUrls : [],
      };

      if (selectedLetter) {
        // Update existing letter
        const updated = await updateFutureLetter(selectedLetter.id, user.id, formattedValues);
        if (updated) {
          const decryptedUpdated = decryptLetterContent(updated);
          setLetters(prev => prev.map(letter => 
            letter.id === decryptedUpdated.id ? decryptedUpdated : letter
          ));
          toast.success("Letter updated successfully");
          setSelectedLetter(null);
          
          // Redirect back to letters page after updating
          router.push('/futureme/letters');
          return; // Exit early to avoid form reset
        }
      } else {
        // Create new letter
        const created = await createFutureLetter(formattedValues);
        
        if (created) {
          const decryptedCreated = decryptLetterContent(created);
          setLetters(prev => [...prev, decryptedCreated]);
          toast.success("Letter sent to the future! 🚀");
          
          // Redirect to letters page after creating new letter
          router.push('/futureme/letters');
          return; // Exit early to avoid form reset
        }
      }
      
      // Reset form
      setLetterContent('');
      setEmailSubject('A message to my future self');
      setDeliveryOption('6months');
      setCustomDate(undefined);
      setAttachmentUrls([]);
      setSendStatus('scheduled');
      setErrors({});
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save letter";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setIsProcessingEncryption(false);
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

  // Handle URL parameters for editing (from letters page)
  useEffect(() => {
    if (!searchParams) return;
    
    const editId = searchParams.get('edit');
    if (editId) {
      // Get data from URL params
      const subject = searchParams.get('subject') || '';
      const content = searchParams.get('content') || '';
      const email = searchParams.get('email') || '';
      const date = searchParams.get('date') || '';
      const status = searchParams.get('status') || 'scheduled';
      const attachments = searchParams.get('attachments') || '[]';
      
      // Set form data
      setEmailSubject(subject);
      setLetterContent(content);
      setRecipientEmail(email);
      setSendStatus(status as 'scheduled' | 'sent' | 'failed');
      setDeliveryOption('custom');
      setCustomDate(date ? new Date(date) : undefined);
      
      try {
        const parsedAttachments = JSON.parse(attachments);
        setAttachmentUrls(parsedAttachments);
      } catch (e) {
        setAttachmentUrls([]);
      }
      
      // Set selected letter (for update mode)
      setSelectedLetter({
        id: editId,
        email_subject: subject,
        email_content: content,
        recipient_email: email,
        send_date: date,
        send_status: status,
        attachment_urls: JSON.parse(attachments),
        user_id: user?.id || '',
        created_at: new Date().toISOString()
      } as FutureLetterResponse);
      
      // Clear URL params
      router.replace('/futureme');
    }
  }, [searchParams, user?.id, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">
      <p>Loading...</p>
    </div>;
  }

  if (!user) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-3">Write a letter to your future self</h1>
          <p className="text-muted-foreground text-lg mb-2">
            <strong>Write</strong>. Pick a receiving date. <strong>Send</strong>. Verify. That's it 😊
          </p>
          <p className="text-sm text-muted-foreground">
            Your letter is <strong>safe</strong> with us - we've sent over <strong>20 million letters</strong> in <strong>20 years</strong>!
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={() => router.push('/futureme/letters')}
        >
          <History className="mr-2 h-4 w-4" />
          My Letters ({letters.length})
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left side - Letter writing area */}
        <div className="lg:col-span-2">
          <Card className="p-6 h-full">
            <div className="space-y-4">
              {/* Email Subject */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Email Subject (Optional)
                </label>
                <Input
                  placeholder="A message to my future self"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full"
                  disabled={isFormDisabled}
                />
              </div>

              {/* Letter Content */}
              <div>
                <div className="flex items-center justify-end mb-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Shield className="h-3.5 w-3.5 mr-1" />
                    <span>End-to-end encrypted</span>
                  </div>
                </div>
                {currentPrompt && (
                  <div 
                    className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => handleInsertPrompt(currentPrompt)}
                  >
                    {currentPrompt}
                  </div>
                )}
                <div className="text-lg font-medium text-gray-700 mb-2">Dear Future Me,</div>
                <div className="relative">
                  <Textarea
                    placeholder="Write your letter here... What do you want to tell your future self?"
                    value={letterContent}
                    onChange={(e) => {
                      setLetterContent(e.target.value);
                      // Clear error when user starts typing
                      if (errors.letterContent) {
                        setErrors(prev => ({ ...prev, letterContent: undefined }));
                      }
                    }}
                    className="min-h-[400px] text-base leading-relaxed pr-10"
                    disabled={isFormDisabled}
                  />
                  <div className="absolute right-3 top-3 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <button
                    onClick={handleInspireMe}
                    disabled={isFormDisabled}
                    className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-all duration-200 hover:shadow-sm"
                  >
                    <span className="text-yellow-500">✨</span>
                    <span>New inspiration...</span>
                  </button>
                </div>
                {errors.letterContent && (
                  <p className="text-sm text-red-500 mt-1">{errors.letterContent}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2 flex items-center">
                  <Lock className="h-3 w-3 mr-1" />
                  Your message will be encrypted and can only be read when delivered.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right side - Delivery options */}
        <div className="space-y-6">
          {/* Delivery timing */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Deliver in</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: '6months', label: '6 months' },
                  { value: '1year', label: '1 year' },
                  { value: '3years', label: '3 years' },
                  { value: '5years', label: '5 years' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={deliveryOption === option.value ? 'default' : 'outline'}
                    className="h-10"
                    onClick={() => {
                      setDeliveryOption(option.value);
                    }}
                    disabled={isFormDisabled}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Button
                variant={deliveryOption === '10years' ? 'default' : 'outline'}
                className="w-full h-10"
                onClick={() => {
                  setDeliveryOption('10years');
                }}
                disabled={isFormDisabled}
              >
                10 years
              </Button>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">Or choose a date</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      (!customDate || deliveryOption !== 'custom') && "text-muted-foreground"
                    )}
                    onClick={() => {
                      setDeliveryOption('custom');
                    }}
                    disabled={isFormDisabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate && deliveryOption === 'custom' ? (
                      format(customDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(date) => {
                      setCustomDate(date);
                      setDeliveryOption('custom');
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkDate = new Date(date);
                      checkDate.setHours(0, 0, 0, 0);
                      return checkDate <= today;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* Email input */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Recipient Email</h3>
            <Input
              type="email"
              placeholder="your@email.com"
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                // Clear error when user starts typing
                if (errors.recipientEmail) {
                  setErrors(prev => ({ ...prev, recipientEmail: undefined }));
                }
              }}
              className="w-full"
              disabled={isFormDisabled}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-red-500 mt-1">{errors.recipientEmail}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Letter will be sent at 6:00 AM (Singapore time) on the selected date.
            </p>
          </Card>

          {/* Send Status (only for existing letters) */}
          {selectedLetter && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Status</h3>
              <RadioGroup
                value={sendStatus}
                onValueChange={(value: 'scheduled' | 'sent' | 'failed') => setSendStatus(value)}
                disabled={isFormDisabled}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <label htmlFor="scheduled" className="font-normal cursor-pointer">
                    Scheduled
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sent" id="sent" />
                  <label htmlFor="sent" className="font-normal cursor-pointer">
                    Sent
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="failed" id="failed" />
                  <label htmlFor="failed" className="font-normal cursor-pointer">
                    Failed
                  </label>
                </div>
              </RadioGroup>
            </Card>
          )}

          {/* Attachments */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Attachments</h3>
            <FileUploader 
              onFilesChange={handleFileChange}
              existingFiles={attachmentUrls}
              className=""
              userId={user?.id}
              bucketName="futureme"
            />
          </Card>

          {/* Send button */}
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessingEncryption || isFormDisabled}
            className="w-full h-12 text-lg font-semibold"
          >
            {isSubmitting || isProcessingEncryption ? 'Processing...' : selectedLetter ? 'Update Letter' : 'Send to the Future'}
          </Button>
          
          {selectedLetter && (
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedLetter(null);
                setLetterContent('');
                setEmailSubject('A message to my future self');
                setDeliveryOption('6months');
                setCustomDate(undefined);
                setAttachmentUrls([]);
                setSendStatus('scheduled');
                setErrors({});
                
                // Redirect back to letters page
                router.push('/futureme/letters');
              }}
              className="w-full"
            >
              Cancel Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FutureMePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <FutureMeContent />
    </Suspense>
  );
}
