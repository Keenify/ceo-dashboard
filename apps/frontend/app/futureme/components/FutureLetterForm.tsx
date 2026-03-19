'use client';

import { useState, useEffect } from 'react';
import { useForm, ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FutureLetterResponse } from '../services/useFutureLetters';
import { encryptContent, decryptContent, isContentEncrypted } from '@/lib/encryption';
import { CalendarIcon, Lock, LockOpen, Shield } from 'lucide-react';
import FileUploader from '@/components/ui/file-uploader';
import { cn } from '@/lib/utils';

// Import the form components from components/ui/form.tsx
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Define schema with non-optional send_status to match form submission
const formSchema = z.object({
  recipient_email: z.string().email({ message: 'Please enter a valid email address' }),
  email_subject: z.string().optional(),
  email_content: z.string().min(10, { message: 'Content must be at least 10 characters' }),
  send_date: z.date().min(new Date(), { message: 'Date must be in the future' }),
  send_status: z.enum(['scheduled', 'sent', 'failed']),
});

// Export type
export type FutureLetterFormValues = z.infer<typeof formSchema>;

// Component props
interface FutureLetterFormProps {
  onSubmit: (values: FutureLetterFormValues & { attachment_urls: string[] }) => void;
  initialData?: FutureLetterResponse | null;
  isSubmitting?: boolean;
  userId?: string;
  userEmail?: string;
}

// Type for form field to avoid 'any' type error
type FormFieldType = {
  field: ControllerRenderProps<FutureLetterFormValues, any>;
};

export default function FutureLetterForm({ 
  onSubmit, 
  initialData, 
  isSubmitting = false,
  userId,
  userEmail
}: FutureLetterFormProps) {
  // Track file attachments
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(
    initialData?.attachment_urls ? [...initialData.attachment_urls] : []
  );
  
  // Track encryption/decryption state
  const [isProcessingEncryption, setIsProcessingEncryption] = useState(false);
  
  // Store the decrypted version of initialData if needed
  const [decryptedInitialData, setDecryptedInitialData] = useState<FutureLetterResponse | null | undefined>(initialData);
  
  // Decrypt initial data email content if needed
  useEffect(() => {
    if (initialData) {
      const decryptedData = {...initialData};
      
      // Only decrypt the email_content field
      if (initialData.email_content && isContentEncrypted(initialData.email_content)) {
        decryptedData.email_content = decryptContent(initialData.email_content);
      }
      
      setDecryptedInitialData(decryptedData);
    } else {
      setDecryptedInitialData(initialData);
    }
  }, [initialData]);
  
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
  
  // Initialize form with react-hook-form
  const form = useForm<FutureLetterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient_email: decryptedInitialData?.recipient_email || userEmail || '',
      email_subject: decryptedInitialData?.email_subject || '',
      email_content: decryptedInitialData?.email_content || '',
      send_date: decryptedInitialData?.send_date ? new Date(decryptedInitialData.send_date) : (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      })(),
      send_status: (decryptedInitialData?.send_status as 'scheduled' | 'sent' | 'failed') || 'scheduled',
    },
  });

  // Update form values when decryptedInitialData changes
  useEffect(() => {
    if (decryptedInitialData) {
      form.reset({
        recipient_email: decryptedInitialData.recipient_email || userEmail || '',
        email_subject: decryptedInitialData.email_subject || '',
        email_content: decryptedInitialData.email_content || '',
        send_date: decryptedInitialData.send_date ? new Date(decryptedInitialData.send_date) : (() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        })(),
        send_status: (decryptedInitialData.send_status as 'scheduled' | 'sent' | 'failed') || 'scheduled',
      });
    }
  }, [decryptedInitialData, form, userEmail]);
  
  // Handle file changes
  const handleFileChange = (fileUrls: string[]) => {
    setAttachmentUrls(fileUrls);
  };

  // Form submission handler with proper type
  function handleFormSubmit(data: FutureLetterFormValues) {
    setIsProcessingEncryption(true);
    
    try {
      // Force encryption of the email_content field
      let finalContent = data.email_content;
      
      // Only encrypt if not already encrypted
      if (!isContentEncrypted(data.email_content)) {
        const encryptedEmailContent = encryptContent(data.email_content);
        finalContent = encryptedEmailContent;
      }
      
      // Always submit with the final content (encrypted or original)
      onSubmit({
        ...data,
        email_content: finalContent,
        attachment_urls: attachmentUrls,
      });
    } catch (error) {
      // Submit with original content if encryption fails
      onSubmit({
        ...data,
        attachment_urls: attachmentUrls,
      });
    } finally {
      setIsProcessingEncryption(false);
    }
  }

  // Check if form should be disabled (e.g., for sent letters)
  const isFormDisabled = initialData?.send_status === 'sent';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            {/* Recipient Email */}
            <FormField
              control={form.control}
              name="recipient_email"
              render={({ field }: FormFieldType) => (
                <FormItem>
                  <FormLabel>Recipient Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="yourfuture@email.com"
                      disabled={isFormDisabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Subject */}
            <FormField
              control={form.control}
              name="email_subject"
              render={({ field }: FormFieldType) => (
                <FormItem>
                  <FormLabel>Email Subject (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A message to my future self"
                      disabled={isFormDisabled}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Content */}
            <FormField
              control={form.control}
              name="email_content"
              render={({ field }: FormFieldType) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Email Content</FormLabel>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 mr-1" />
                      <span>End-to-end encrypted</span>
                    </div>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        placeholder="Dear Future Me..."
                        className={cn(
                          "min-h-[200px]",
                          "pr-10" // Add padding for the lock icon
                        )}
                        disabled={isFormDisabled}
                        {...field}
                      />
                      <div className="absolute right-3 top-3 text-muted-foreground">
                        <Lock className="h-4 w-4" />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <FormDescription className="flex items-center text-xs text-muted-foreground">
                    <Lock className="h-3 w-3 mr-1 inline" />
                    Your message will be encrypted and can only be read when delivered.
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Send Date */}
            <FormField
              control={form.control}
              name="send_date"
              render={({ field }: FormFieldType) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Send Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isFormDisabled}
                          type="button"
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Start of today
                          const checkDate = new Date(date);
                          checkDate.setHours(0, 0, 0, 0); // Start of the date being checked
                          return checkDate <= today; // Disable today and all previous dates
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-xs text-muted-foreground">
                    Letter will be sent at 6:00 AM (Singapore time) on the selected date.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status (only for existing letters) */}
            {initialData && (
              <FormField
                control={form.control}
                name="send_status"
                render={({ field }: FormFieldType) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isFormDisabled}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="scheduled" />
                          </FormControl>
                          <FormLabel className="font-normal">Scheduled</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="sent" />
                          </FormControl>
                          <FormLabel className="font-normal">Sent</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="failed" />
                          </FormControl>
                          <FormLabel className="font-normal">Failed</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <FormLabel>Attachments</FormLabel>
              <FileUploader 
                onFilesChange={handleFileChange}
                existingFiles={initialData?.attachment_urls || []}
                className="pt-2"
                userId={userId}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              type="submit" 
              disabled={isSubmitting || isFormDisabled || isProcessingEncryption}
            >
              {isSubmitting || isProcessingEncryption ? 'Processing...' : initialData ? 'Update Letter' : 'Save Letter'}
            </Button>
          </div>
        </Card>
      </form>
    </Form>
  );
} 