"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import DatePicker from "react-datepicker";
import { format, parseISO } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import { Settings, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { JournalTemplate, JournalTemplateWithQuestions, useJournalTemplates } from "./services/useJournalTemplates";
import { useJournalEntries } from "./services/useJournalEntries";
import { useJournalQuestions, JournalQuestion } from "./services/useJournalQuestions";

export default function JournalingPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [hasLoadedUserPreference, setHasLoadedUserPreference] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<JournalTemplateWithQuestions | null>(null);
  const [answers, setAnswers] = useState<{ [questionId: number]: string }>({});
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);
  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const [isEditing, setIsEditing] = useState(true);
  const [showTemplateManager, setShowTemplateManager] = useState(false); 
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newQuestionContent, setNewQuestionContent] = useState("");
  const [newTemplateForm, setNewTemplateForm] = useState({ name: "", description: "", duplicateFrom: "scratch" });
  const [editTemplateForm, setEditTemplateForm] = useState({ name: "", description: "" });
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [inlineEditingQuestionId, setInlineEditingQuestionId] = useState<number | null>(null);
  const [inlineEditingContent, setInlineEditingContent] = useState<string>("");

  const router = useRouter();

  const {
    getUserTemplates,
    getTemplateWithQuestions,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    loading: templateLoading,
    error: templateError
  } = useJournalTemplates();

  const {
    bulkUpsertJournalEntries,
    fetchUserJournalEntriesByTemplateAndDate,
    fetchUserEntryDates,
    loading: entriesLoading,
    error: entriesError
  } = useJournalEntries();

  const {
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getNextPosition,
    loading: questionLoading
  } = useJournalQuestions();

  const loading = templateLoading || entriesLoading || questionLoading;
  const error = templateError || entriesError;
  
    // Load user's last used template preference
  const loadUserTemplatePreference = async (userId: string): Promise<string | null> => {
    try {
      console.log('🔄 Loading template preference for user:', userId);
      
      const { data, error } = await supabase
        .from('user_preferences_journaltemplate')
        .select('last_template_id')
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.log('ℹ️ Error loading template preference:', error.message);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ No existing template preference found for user');
        return null;
      }

      console.log('✅ Template preference loaded:', data[0]);
      return data[0]?.last_template_id || null;
    } catch (error) {
      console.error('❌ Error loading template preference:', error);
      return null;
    }
  };

  // Save user's template preference
  const saveUserTemplatePreference = async (userId: string, templateId: string) => {
    try {
      console.log('🔄 Saving template preference:', { userId, templateId });
      
      // Ensure user is authenticated before attempting to save
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user || authData.user.id !== userId) {
        console.log('⚠️ User not properly authenticated, skipping save');
        return;
      }
      
      // First, clean up any potential duplicates
      await cleanupDuplicatePreferences(userId);
      
      const { data, error } = await supabase
        .from('user_preferences_journaltemplate')
        .upsert(
          {
            user_id: userId,
            last_template_id: templateId,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )
        .select();

      if (error) {
        console.error('❌ Error saving template preference:', error);
      } else {
        console.log('✅ Template preference saved successfully');
      }
    } catch (error) {
      console.error('❌ Exception saving template preference:', error);
    }
  };

  // Cleanup function to remove duplicate preferences
  const cleanupDuplicatePreferences = async (userId: string) => {
    try {
      // Get all preferences for this user
      const { data: preferences, error: fetchError } = await supabase
        .from('user_preferences_journaltemplate')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError || !preferences || preferences.length <= 1) {
        // No error to fix or only one record (which is correct)
        return;
      }

      // Keep the most recent one, delete the rest
      const [keepRecord, ...deleteRecords] = preferences;
      
      if (deleteRecords.length > 0) {
        console.log(`🧹 Cleaning up ${deleteRecords.length} duplicate preference records for user ${userId}`);
        
        const idsToDelete = deleteRecords.map(r => r.id);
        const { error: deleteError } = await supabase
          .from('user_preferences_journaltemplate')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('❌ Error cleaning up duplicates:', deleteError);
        } else {
          console.log('✅ Duplicate preferences cleaned up successfully');
        }
      }
    } catch (error) {
      console.error('❌ Error in cleanup function:', error);
      // Don't throw - this is a cleanup operation, shouldn't break the main flow
    }
  };

  // Helper function to format error messages properly
  const formatErrorMessage = (error: any): string => {
    if (!error) return "";
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.detail) {
      return error.detail;
    }
    
    // If it's an object, try to stringify it properly
    try {
      return JSON.stringify(error);
    } catch {
      return "An unknown error occurred";
    }
  };
  
    // Load templates and set default or user preference
  useEffect(() => {
    const loadTemplates = async () => {
      if (!user?.id) {
        console.log('⏸️ No user ID available, skipping template loading');
        return;
      }
      
      if (hasLoadedUserPreference) {
        console.log('⏸️ User preference already loaded, skipping');
        return;
      }
      
      console.log('🔄 Loading templates for user:', user.id);
      
      const data = await getUserTemplates(user.id, true);
      if (data) {
        setTemplates(data);
        
        if (!selectedTemplateId && data.length > 0) {
          // First, try to load user's last used template
          const lastUsedTemplateId = await loadUserTemplatePreference(user.id);
          
          if (lastUsedTemplateId && data.find(t => t.id === lastUsedTemplateId)) {
            // User's preferred template exists, use it
            console.log('📌 Using user\'s preferred template:', lastUsedTemplateId);
            setSelectedTemplateId(lastUsedTemplateId);
          } else {
            // No preference or template deleted, use default
            const defaultTemplate = data.find(t => t.is_default) || data[0];
            console.log('📌 Using default template:', defaultTemplate.id);
            setSelectedTemplateId(defaultTemplate.id);
          }
        }
        
        setHasLoadedUserPreference(true);
      }
    };

    if (user?.id) {
      loadTemplates();
      fetchAllEntryDates(user.id);
    }
  }, [user?.id, hasLoadedUserPreference]);

  // Auto-fill template name when duplicating
  useEffect(() => {
    if (newTemplateForm.duplicateFrom && newTemplateForm.duplicateFrom !== "scratch" && templates.length > 0) {
      const sourceTemplate = templates.find(t => t.id === newTemplateForm.duplicateFrom);
      if (sourceTemplate) {
        setNewTemplateForm(prev => ({
          ...prev,
          name: prev.name || `Copy of ${sourceTemplate.name}`,
          description: prev.description || sourceTemplate.description || ""
        }));
      }
    } else if (newTemplateForm.duplicateFrom === "scratch") {
      // Clear name and description when switching back to "start from scratch"
      setNewTemplateForm(prev => ({
        ...prev,
        name: "",
        description: ""
      }));
    }
  }, [newTemplateForm.duplicateFrom, templates]);

  // Load template questions when template changes
  useEffect(() => {
    const loadTemplate = async () => {
      if (!selectedTemplateId) return;
      
      const template = await getTemplateWithQuestions(selectedTemplateId);
      if (template) {
        // Ensure questions are always numbered starting from 1
        const renumberedQuestions = renumberQuestions(template.questions);
        const normalizedTemplate = {
          ...template,
          questions: renumberedQuestions
        };
        
        setCurrentTemplate(normalizedTemplate);
        setEditTemplateForm({
          name: template.name,
          description: template.description || ""
        });
        loadEntriesForDate();
      }
    };

    loadTemplate();
  }, [selectedTemplateId, selectedDate]);
  
    const fetchAllEntryDates = useCallback(async (userId: string) => {
    const dates = await fetchUserEntryDates(userId);
    if (dates) {
      const parsedDates = dates.map(dateStr => {
        try {
          return parseISO(dateStr);
        } catch (e) {
          console.error(`Failed to parse date string: ${dateStr}`, e);
          return null;
        }
      }).filter((date): date is Date => date !== null);

      setHighlightedDates(parsedDates);
    }
  }, [fetchUserEntryDates]);

  const loadEntriesForDate = useCallback(async () => {
    if (!user?.id || !selectedTemplateId) return;

    setAnswers({});
    setIsEditing(true);

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const entries = await fetchUserJournalEntriesByTemplateAndDate(user.id, selectedTemplateId, formattedDate);
    
    if (entries && entries.length > 0) {
      const answersMap: { [questionId: number]: string } = {};
      entries.forEach(entry => {
        answersMap[entry.question_id] = entry.answer;
      });
      setAnswers(answersMap);
      setIsEditing(false);
    } else {
      setAnswers({});
      setIsEditing(true);
    }
  }, [user?.id, selectedTemplateId, selectedDate, fetchUserJournalEntriesByTemplateAndDate]);

  // Enhanced user authentication check
  useEffect(() => {
    const checkUser = async () => {
      console.log('🔍 Checking user authentication...');
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        console.log('❌ No authenticated user found, redirecting to login');
        router.push("/login");
      } else {
        console.log('✅ User authenticated:', { id: authData.user.id, email: authData.user.email });
        
        // Reset state if user changed (handles logout/login scenarios)
        if (user?.id && user.id !== authData.user.id) {
          console.log('🔄 User changed, resetting state...');
          setHasLoadedUserPreference(false);
          setTemplates([]);
          setSelectedTemplateId(null);
          setCurrentTemplate(null);
        }
        
        setUser(authData.user);
      }
    };
    
    checkUser();
    
    // Also listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('�� Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out, resetting state');
        setUser(null);
        setHasLoadedUserPreference(false);
        setTemplates([]);
        setSelectedTemplateId(null);
        setCurrentTemplate(null);
        router.push("/login");
      } else if (event === 'SIGNED_IN' && session?.user) {
        console.log('👋 User signed in:', session.user.id);
        setUser(session.user);
        setHasLoadedUserPreference(false); // Reset to reload preferences
      }
    });

    return () => subscription.unsubscribe();
  }, [router, user?.id]);
  
    const handleInputChange = (questionId: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTemplate || !user?.id) return;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    
    // Convert answers to the format expected by backend (dict[int, str])
    const answersDict: { [key: number]: string } = {};
    Object.entries(answers).forEach(([questionId, answer]) => {
      if (answer.trim() !== '') {
        answersDict[parseInt(questionId)] = answer.trim();
      }
    });

    if (Object.keys(answersDict).length === 0) {
      toast.error("Please provide at least one answer before saving.");
      return;
    }

    // Validation: Check if all question IDs exist in the current template
    const templateQuestionIds = currentTemplate.questions.map(q => q.id);
    const submittedQuestionIds = Object.keys(answersDict).map(id => parseInt(id));
    const invalidQuestionIds = submittedQuestionIds.filter(id => !templateQuestionIds.includes(id));
    
    if (invalidQuestionIds.length > 0) {
      console.error('Invalid question IDs found:', invalidQuestionIds);
      console.error('Template question IDs:', templateQuestionIds);
      console.error('Submitted question IDs:', submittedQuestionIds);
      toast.error(`Error: Some questions don't belong to this template. Invalid IDs: ${invalidQuestionIds.join(', ')}`);
      return;
    }

    const bulkPayload = {
      user_id: user.id,
      template_id: selectedTemplateId!,
      entry_date: formattedDate,
      answers: answersDict
    };

    console.log('=== JOURNAL SAVE DEBUG ===');
    console.log('Current Template:', currentTemplate);
    console.log('Selected Template ID (type):', typeof selectedTemplateId, selectedTemplateId);
    console.log('User ID (type):', typeof user.id, user.id);
    console.log('Formatted Date:', formattedDate);
    console.log('Template Questions:', currentTemplate.questions);
    console.log('Template Question IDs:', templateQuestionIds);
    console.log('Answers Dict:', answersDict);
    console.log('Full Payload:', JSON.stringify(bulkPayload, null, 2));
    
    // Additional validation checks
    console.log('=== VALIDATION CHECKS ===');
    console.log('Is selectedTemplateId valid?', selectedTemplateId && selectedTemplateId.trim().length > 0);
    console.log('Is user.id valid?', user.id && user.id.trim().length > 0);
    console.log('Date format check:', /^\d{4}-\d{2}-\d{2}$/.test(formattedDate));
    console.log('All question IDs are numbers?', Object.keys(answersDict).every(id => !isNaN(parseInt(id))));
    console.log('All answers are strings?', Object.values(answersDict).every(answer => typeof answer === 'string'));
    console.log('Template exists in database?', currentTemplate?.id === selectedTemplateId);
    console.log('Questions count match?', currentTemplate.questions.length, 'template questions vs', Object.keys(answersDict).length, 'submitted answers');
    console.log('=== END DEBUG ===');

    try {
      const result = await bulkUpsertJournalEntries(bulkPayload);
      
      if (result) {
        toast.success("Journal entries saved successfully!");
        setIsEditing(false);
        fetchAllEntryDates(user.id);
      } else {
        throw new Error("Failed to save entries - no result returned");
      }
    } catch (error: any) {
      console.error("=== ERROR DETAILS ===");
      console.error("Full error object:", error);
      console.error("Error message:", error?.message);
      console.error("Error details:", error?.detail);
      console.error("Error response:", error?.response);
      console.error("=== END ERROR ===");
      
      // Extract the actual error message
      let errorMessage = "Failed to save journal entries.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.detail) {
        errorMessage = error.detail;
      }
      
      toast.error(`Error: ${errorMessage}\n\nCheck the console for detailed error information.`);
    }
  };
  
    const handleAddQuestion = async () => {
    if (!newQuestionContent.trim() || !currentTemplate) return;

    const position = getNextPosition(currentTemplate.questions);
    const result = await createQuestion(selectedTemplateId!, {
      content: newQuestionContent.trim(),
      position
    });

    if (result) {
      // Refresh the template data to ensure correct numbering
      const updatedTemplate = await getTemplateWithQuestions(selectedTemplateId!);
      if (updatedTemplate) {
        // Apply renumbering to ensure questions always start from 1
        const renumberedQuestions = renumberQuestions(updatedTemplate.questions);
        setCurrentTemplate({
          ...updatedTemplate,
          questions: renumberedQuestions
        });
      } else {
        // Fallback to local update if refresh fails
        setCurrentTemplate(prev => prev ? {
          ...prev,
          questions: renumberQuestions([...prev.questions, result])
        } : null);
      }
      setNewQuestionContent("");
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateForm.name.trim() || !user?.id) return;

    let result;

    if (newTemplateForm.duplicateFrom && newTemplateForm.duplicateFrom !== "scratch") {
      // Duplicate existing template
      result = await duplicateTemplate(
        newTemplateForm.duplicateFrom,
        user.id,
        {
          name: newTemplateForm.name.trim(),
          description: newTemplateForm.description.trim() || undefined
        }
      );
    } else {
      // Create new template from scratch
      result = await createTemplate({
        name: newTemplateForm.name.trim(),
        description: newTemplateForm.description.trim() || undefined,
        user_id: user.id,
        is_default: false
      });
    }

    if (result) {
      setTemplates(prev => [...prev, result]);
      setSelectedTemplateId(result.id);
      setShowCreateDialog(false);
      setNewTemplateForm({ name: "", description: "", duplicateFrom: "scratch" });
      
      // Save newly created template as user's preference
      if (user?.id) {
        saveUserTemplatePreference(user.id, result.id);
      }
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editTemplateForm.name.trim() || !currentTemplate) return;

    const result = await updateTemplate(selectedTemplateId!, {
      name: editTemplateForm.name.trim(),
      description: editTemplateForm.description.trim() || undefined
    });

    if (result) {
      setCurrentTemplate(prev => prev ? { ...prev, ...result } : null);
      setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...t, ...result } : t));
      setIsEditingTemplate(false);
    }
  };

  const handleDeleteCurrentTemplate = async () => {
    if (!currentTemplate || currentTemplate.is_default) return;
    
    const result = await deleteTemplate(currentTemplate.id);
    if (result) {
      setTemplates(prev => prev.filter(t => t.id !== currentTemplate.id));
      setShowTemplateManager(false);
      setShowDeleteConfirmation(false);
      
      // Switch to default template and update preference
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        // Update user's preference to default template
        if (user?.id) {
          saveUserTemplatePreference(user.id, defaultTemplate.id);
        }
      }
    }
  };

  const handleEditQuestion = (questionId: number, currentContent: string) => {
    setInlineEditingQuestionId(questionId);
    setInlineEditingContent(currentContent);
  };

  const handleSaveQuestionEdit = async () => {
    if (!inlineEditingContent.trim() || !inlineEditingQuestionId) return;

    const result = await updateQuestion(inlineEditingQuestionId, {
      content: inlineEditingContent.trim()
    });

    if (result) {
      setCurrentTemplate(prev => prev ? {
        ...prev,
        questions: renumberQuestions(
          prev.questions.map(q => 
            q.id === inlineEditingQuestionId ? { ...q, content: inlineEditingContent.trim() } : q
          )
        )
      } : null);
      setInlineEditingQuestionId(null);
      setInlineEditingContent("");
    }
  };

  const handleCancelQuestionEdit = () => {
    setInlineEditingQuestionId(null);
    setInlineEditingContent("");
  };

  // Client-side function to renumber questions sequentially starting from 1
  const renumberQuestions = (questions: JournalQuestion[]): JournalQuestion[] => {
    return questions
      .sort((a, b) => a.position - b.position)
      .map((question, index) => ({
        ...question,
        position: index + 1
      }));
  };

  const handleDeleteQuestion = async (questionId: number, questionContent: string) => {
    try {
      console.log('🗑️ Attempting to delete question:', questionId);
      
      // Check if this is a default template before attempting deletion
      if (currentTemplate?.is_default) {
        toast.error("Cannot delete questions from default templates. Please create a custom template first.");
        return;
      }

      // Optimistic update: immediately remove question and renumber
      const originalTemplate = currentTemplate;
      if (currentTemplate) {
        const filteredQuestions = currentTemplate.questions.filter(q => q.id !== questionId);
        const renumberedQuestions = renumberQuestions(filteredQuestions);
        
        setCurrentTemplate({
          ...currentTemplate,
          questions: renumberedQuestions
        });
        
        console.log('✨ Optimistic update applied - question removed and renumbered');
      }
      
      try {
        const result = await deleteQuestion(questionId);
        console.log('🗑️ Delete result:', result);
        console.log('✅ Question deleted successfully from database');
        
        // Clear any related state
        setInlineEditingQuestionId(null);
        setInlineEditingContent("");
        
        toast.success("Question deleted successfully!");
        
        // Verify deletion persisted after a short delay
        setTimeout(async () => {
          if (selectedTemplateId) {
            try {
              const verificationTemplate = await getTemplateWithQuestions(selectedTemplateId);
              if (verificationTemplate) {
                const deletedQuestionExists = verificationTemplate.questions.some(q => q.id === questionId);
                if (deletedQuestionExists) {
                  console.warn('⚠️ Question deletion did not persist, reverting');
                  // Apply renumbering even to reverted data
                  const renumberedQuestions = renumberQuestions(verificationTemplate.questions);
                  setCurrentTemplate({
                    ...verificationTemplate,
                    questions: renumberedQuestions
                  });
                  toast.error("Question deletion failed. Please try again.");
                } else {
                  // Ensure consistent numbering from backend data
                  const consistentQuestions = renumberQuestions(verificationTemplate.questions);
                  setCurrentTemplate({
                    ...verificationTemplate,
                    questions: consistentQuestions
                  });
                  console.log('✅ Question deletion verified and renumbered');
                }
              }
            } catch (verifyError) {
              console.warn('⚠️ Could not verify deletion:', verifyError);
            }
          }
        }, 1500);
        
      } catch (deleteError) {
        console.error('❌ Delete question error:', deleteError);
        
        // Revert optimistic update on error, but still apply renumbering
        if (originalTemplate) {
          const renumberedQuestions = renumberQuestions(originalTemplate.questions);
          setCurrentTemplate({
            ...originalTemplate,
            questions: renumberedQuestions
          });
          console.log('🔄 Optimistic update reverted due to error, with renumbering applied');
        }
        
        const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
        
        // Provide more specific error messages
        if (errorMessage.includes('default template')) {
          toast.error("Cannot delete questions from default templates. Please create a custom template first.");
        } else if (errorMessage.includes('403')) {
          toast.error("You don't have permission to delete this question.");
        } else if (errorMessage.includes('404')) {
          toast.error("Question not found. It may have already been deleted.");
        } else {
          toast.error(`Failed to delete question: ${errorMessage}`);
        }
      }
    } catch (outerError) {
      console.error('❌ Unexpected error in delete handler:', outerError);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  // Enhanced function to detect numeric questions
  const isNumericQuestion = (content: string) => {
    const lowerContent = content.toLowerCase();
    
    // Direct character matches (no word boundaries needed)
    if (lowerContent.includes('%') || lowerContent.includes('$')) {
      return true;
    }
    
    // Word boundary matches for more precise detection
    const numericKeywords = [
      'minute', 'minutes', 'min', 'mins',
      'hour', 'hours', 'hr', 'hrs', 
      'second', 'seconds', 'sec', 'secs',
      'time', 'times',
      'percent', 'percentage',
      'number', 'count', 'amount',
      'rate', 'rating', 'score',
      'level', 'scale',
      'temperature', 'temp',
      'weight', 'height', 'distance',
      'age', 'years', 'year',
      'dollars', 'dollar', 'cost', 'price',
      'speed', 'mph', 'km/h'
    ];
    
    // Phrase matches (must match exactly)
    const numericPhrases = ['how many', 'how much'];
    
    // Check phrases first
    if (numericPhrases.some(phrase => lowerContent.includes(phrase))) {
      return true;
    }
    
    // Check individual words with word boundaries
    return numericKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(content);
    });
  };

  const renderQuestionInput = (question: any) => {
    const answer = answers[question.id] || '';
    const isReadOnly = !isEditing;
    const isNumeric = isNumericQuestion(question.content);
    const isShortAnswer = question.content.length < 50 && !question.content.includes('?');

    if (isNumeric) {
      return (
        <Input
          type="number"
          value={answer}
          onChange={(e) => handleInputChange(question.id, e.target.value)}
          placeholder="0"
          readOnly={isReadOnly}
          disabled={isReadOnly}
          className="mt-1"
        />
      );
    }

    if (isShortAnswer) {
      return (
        <Input
          value={answer}
          onChange={(e) => handleInputChange(question.id, e.target.value)}
          placeholder="Your answer..."
          readOnly={isReadOnly}
          disabled={isReadOnly}
          className="mt-1"
        />
      );
    }

    return (
      <textarea
        value={answer}
        onChange={(e) => handleInputChange(question.id, e.target.value)}
        className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="Write your response here..."
        readOnly={isReadOnly}
        disabled={isReadOnly}
      />
    );
  };

  const renderDayContents = (day: number, date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const selectedFormattedDate = format(selectedDate, 'yyyy-MM-dd');
    const hasEntry = highlightedDates.some(d =>
      format(d, 'yyyy-MM-dd') === formattedDate
    );
    const isSelectedDate = formattedDate === selectedFormattedDate;

    return (
      <div className={`relative ${hasEntry && !isSelectedDate ? 'font-bold text-primary' : ''}`}>
        {day}
        {hasEntry && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Daily Journal</h1>
            <p>Please log in to access your journal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Daily Journal</h1>
          </div>
          
          {/* Template Selection Section */}
          <div className="bg-muted/30 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
            <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
              <div className="flex flex-col gap-1 flex-1">
                <Label className="text-sm font-medium text-muted-foreground">Journal Template</Label>
                <Select value={selectedTemplateId || ""} onValueChange={(value) => {
                  if (value === "NEW_TEMPLATE") {
                    setShowCreateDialog(true);
                  } else {
                    setSelectedTemplateId(value);
                    // Save user's template preference
                    if (user?.id && value) {
                      console.log('🔄 Template changed via dropdown, saving preference...');
                      saveUserTemplatePreference(user.id, value);
                    }
                  }
                }}>
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue placeholder="Choose a journal template..." />
                  </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} {template.is_default && "(Default)"}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value="NEW_TEMPLATE" className="text-primary font-medium">
                        <div className="flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          New Template
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                
                                {/* Create Template Dialog */}
                <Dialog 
                  open={showCreateDialog} 
                  onOpenChange={(open) => {
                    setShowCreateDialog(open);
                    if (!open) {
                      // Reset form when dialog closes
                      setNewTemplateForm({ name: "", description: "", duplicateFrom: "scratch" });
                    }
                  }}
                >
                  <DialogContent className="sm:max-w-md mx-4 w-[calc(100vw-2rem)] sm:mx-0 sm:w-full">
                    <DialogHeader className="pb-3">
                      <DialogTitle className="text-lg md:text-xl">Create New Template</DialogTitle>
                      <DialogDescription>
                        Create a custom journal template with your own questions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="duplicate-from" className="text-sm font-medium">
                          Start From (Optional)
                        </Label>
                        <Select 
                          value={newTemplateForm.duplicateFrom} 
                          onValueChange={(value) => setNewTemplateForm(prev => ({ ...prev, duplicateFrom: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Start from scratch or duplicate existing template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scratch">Start from scratch</SelectItem>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                Duplicate: {template.name} {template.is_default && "(Default)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-name" className="text-sm font-medium">
                          Template Name
                        </Label>
                        <Input
                          id="template-name"
                          value={newTemplateForm.name}
                          onChange={(e) => setNewTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="My Custom Template"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-description" className="text-sm font-medium">
                          Description (Optional)
                        </Label>
                        <Textarea
                          id="template-description"
                          value={newTemplateForm.description}
                          onChange={(e) => setNewTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="What is this template for?"
                          rows={3}
                          className="w-full resize-none"
                        />
                      </div>
                    </div>
                    <DialogFooter className="pt-3 flex flex-col-reverse gap-2 md:flex-row">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1 h-10">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateTemplate} 
                        disabled={!newTemplateForm.name.trim() || loading}
                        className="flex-1 h-10"
                      >
                        {loading 
                          ? (newTemplateForm.duplicateFrom !== "scratch" ? "Duplicating..." : "Creating...") 
                          : (newTemplateForm.duplicateFrom !== "scratch" ? "Duplicate Template" : "Create Template")
                        }
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                {/* Manage Template Button */}
                {currentTemplate && !currentTemplate.is_default && (
                  <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    
                                        <DialogContent className="max-w-3xl mx-4 w-[calc(100vw-2rem)] sm:mx-0 sm:w-full max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col">
                      <DialogHeader className="pb-6">
                        <DialogTitle className="text-xl font-semibold">{currentTemplate.name}</DialogTitle>
                        <DialogDescription className="text-base">
                          Configure your journal template and manage questions
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-8 overflow-y-auto flex-1 pr-1">
                        {/* Template Settings */}
                        <div className="space-y-6">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-foreground">Template Settings</h3>
                                  <p className="text-sm text-muted-foreground">Configure your journal template</p>
                                </div>
                              </div>
                              {!isEditingTemplate ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsEditingTemplate(true)}
                                  className="h-9 px-4 bg-white/60 dark:bg-gray-800/60 border-white/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsEditingTemplate(false);
                                      setEditTemplateForm({
                                        name: currentTemplate.name,
                                        description: currentTemplate.description || ""
                                      });
                                    }}
                                    className="h-9 px-4 bg-white/60 dark:bg-gray-800/60 border-white/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={handleUpdateTemplate}
                                    disabled={loading}
                                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                                  >
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            {isEditingTemplate ? (
                              <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-template-name" className="text-sm font-medium text-foreground">Template Name</Label>
                                  <Input
                                    id="edit-template-name"
                                    value={editTemplateForm.name}
                                    onChange={(e) => setEditTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="bg-white/80 dark:bg-gray-900/80 border-white/90 dark:border-gray-700/90 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                    placeholder="Enter template name..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-template-description" className="text-sm font-medium text-foreground">Description</Label>
                                  <Textarea
                                    id="edit-template-description"
                                    value={editTemplateForm.description}
                                    onChange={(e) => setEditTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="bg-white/80 dark:bg-gray-900/80 border-white/90 dark:border-gray-700/90 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                                    placeholder="Describe what this template is for..."
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-5 border border-white/80 dark:border-gray-700/80">
                                <div className="flex items-start gap-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                  <div>
                                    <h4 className="font-semibold text-foreground text-base">{currentTemplate.name}</h4>
                                    {currentTemplate.description && (
                                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                        {currentTemplate.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Questions Management */}
                        <div className="space-y-6">
                          <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 rounded-xl p-6 border border-gray-200/50 dark:border-gray-800/50">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900/50 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">📝</span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-foreground">Questions</h3>
                                  <p className="text-sm text-muted-foreground">Build your journal prompts</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/30 px-3 py-2 rounded-full border border-amber-200/50 dark:border-amber-800/50">
                                <span className="text-amber-600 dark:text-amber-400">💡</span>
                                <span className="font-medium">Use "minutes", "%" for numbers</span>
                              </div>
                            </div>
                            
                            <div className="space-y-5">
                              <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-4 border border-white/80 dark:border-gray-700/80">
                                <div className="flex gap-3">
                                  <Input
                                    placeholder="Type your question here..."
                                    value={newQuestionContent}
                                    onChange={(e) => setNewQuestionContent(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddQuestion()}
                                    className="flex-1 bg-white/80 dark:bg-gray-900/80 border-2 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 px-4 py-3 h-auto placeholder:text-muted-foreground/70 hover:bg-white/90 dark:hover:bg-gray-800/90 focus:scale-[1.01] hover:border-gray-400 dark:hover:border-gray-500"
                                  />
                                  <Button 
                                    onClick={handleAddQuestion} 
                                    disabled={!newQuestionContent.trim()}
                                    className="px-6 py-3 h-auto bg-primary hover:bg-primary/90 disabled:bg-gray-400 hover:scale-105 active:scale-95 transition-all duration-150 disabled:hover:scale-100 shadow-sm"
                                  >
                                    <Plus className="h-4 w-4 mr-2 transition-transform duration-150" />
                                    Add Question
                                  </Button>
                                </div>
                              </div>
                            
                              <div className="space-y-3">
                                {currentTemplate.questions
                                  .sort((a, b) => a.position - b.position)
                                  .map((question, index) => (
                                    <div key={question.id} className="bg-white/70 dark:bg-gray-800/70 border border-white/90 dark:border-gray-700/90 rounded-lg p-5 hover:bg-white/90 dark:hover:bg-gray-800/90 hover:shadow-md transition-all duration-200 group backdrop-blur-sm relative overflow-hidden">
                                      {/* Interactive hint overlay */}
                                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                      <div className="relative z-10">
                                      <div className="flex-1">
                                        {inlineEditingQuestionId === question.id ? (
                                          <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="flex items-center gap-3 text-sm font-medium text-primary animate-in slide-in-from-left-2 duration-300">
                                              <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                                                <Pencil className="h-4 w-4 animate-in zoom-in duration-200" />
                                              </div>
                                              <span>Editing Question {index + 1}</span>
                                            </div>
                                            <Textarea
                                              value={inlineEditingContent}
                                              onChange={(e) => setInlineEditingContent(e.target.value)}
                                              placeholder="Enter your question here..."
                                              rows={3}
                                              className="w-full resize-none bg-white/80 dark:bg-gray-900/80 border-white/90 dark:border-gray-700/90 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 animate-in fade-in slide-in-from-top-2 duration-300"
                                              autoFocus
                                            />
                                            <div className="flex gap-2 justify-end animate-in slide-in-from-right-2 duration-300">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCancelQuestionEdit}
                                                disabled={loading}
                                                className="h-9 px-4 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 hover:scale-105 transition-all duration-150"
                                              >
                                                Cancel
                                              </Button>
                                              <Button
                                                size="sm"
                                                onClick={handleSaveQuestionEdit}
                                                disabled={loading || !inlineEditingContent.trim()}
                                                className="h-9 px-4 bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-150"
                                              >
                                                {loading ? (
                                                  <span className="flex items-center gap-2">
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Saving...
                                                  </span>
                                                ) : (
                                                  "Save Changes"
                                                )}
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          
                                                                                    <div className="flex items-start justify-between gap-4">
                                            <div 
                                              className="flex-1 min-w-0 cursor-pointer hover:bg-white/50 dark:hover:bg-gray-900/50 rounded-lg p-3 -m-3 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group/edit relative border border-transparent hover:border-primary/20 hover:shadow-sm"
                                              onClick={() => handleEditQuestion(question.id, question.content)}
                                              title="Click to edit question"
                                            >
                                              <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                  <span className="text-xs font-semibold text-primary">
                                                    {index + 1}
                                                  </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm text-foreground leading-relaxed font-medium group-hover/edit:text-primary transition-colors duration-200">
                                                    {question.content}
                                                  </p>
                                                  <div className="flex items-center gap-2 mt-1 opacity-0 group-hover/edit:opacity-100 transition-opacity duration-200">
                                                    <Pencil className="h-3 w-3 text-primary/70" />
                                                    <span className="text-xs text-primary/70 font-medium">Click to edit</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 ease-out">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full hover:scale-110 active:scale-95 transition-all duration-150"
                                                onClick={() => handleDeleteQuestion(question.id, question.content)}
                                                title="Delete question"
                                              >
                                                <Trash2 className="h-3.5 w-3.5 transition-transform duration-150" />
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      </div>
                                    </div>
                                  ))}
                                {currentTemplate.questions.length === 0 && (
                                  <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-white/70 dark:bg-gray-800/70 border border-white/90 dark:border-gray-700/90 rounded-xl p-8 backdrop-blur-sm">
                                      <div className="mb-4 animate-in zoom-in duration-300 delay-200">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                          <span className="text-3xl">📝</span>
                                        </div>
                                      </div>
                                      <h4 className="text-base font-semibold text-foreground mb-2 animate-in slide-in-from-bottom-2 duration-300 delay-300">No questions yet</h4>
                                      <p className="text-sm text-muted-foreground animate-in slide-in-from-bottom-2 duration-300 delay-400">Add your first question above to start building your journal template</p>
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                        <DialogFooter className="flex-col-reverse md:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
                        <Button 
                          variant="destructive" 
                          onClick={() => setShowDeleteConfirmation(true)}
                          disabled={loading}
                          className="w-full md:w-auto h-10 order-2 md:order-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Template
                        </Button>
                        <Button 
                          onClick={() => setShowTemplateManager(false)} 
                          className="w-full md:w-auto h-10 order-1 md:order-2"
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Delete Template Button (for custom templates) */}
                {currentTemplate && !currentTemplate.is_default && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="text-destructive hover:text-destructive h-9 md:h-8"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Template
                  </Button>
                )}
                

              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded">
            Error: {formatErrorMessage(error)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="rounded-lg border border-border bg-card p-4 md:p-6 shadow-sm">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Select Date</h2>
            {loading && <p>Loading data...</p>}
            <div className="calendar-container">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                inline
                renderDayContents={renderDayContents}
                highlightDates={highlightedDates}
                calendarClassName="w-full border rounded-md text-sm md:text-base"
              />
            </div>
            <div className="mt-3 md:mt-4">
              <p className="text-sm text-muted-foreground">
                Selected date: <span className="font-medium">{format(selectedDate, 'MMMM d, yyyy')}</span>
              </p>
              {!isEditing && (
                <Button
                  variant="outline"
                  className="mt-2 w-full h-10 md:h-9"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Entry
                </Button>
              )}
            </div>
          </div>
                  
                            <div className="rounded-lg border border-border bg-card p-4 md:p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
              <h2 className="text-lg md:text-xl font-semibold">
                {currentTemplate ? currentTemplate.name : "Loading..."}
              </h2>
              <p className="text-sm font-medium text-muted-foreground md:text-foreground">{format(selectedDate, 'MMMM d, yyyy')}</p>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading entry details...</p>}
            {!loading && currentTemplate && (
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="space-y-4 md:space-y-5">
                  {/* Render existing questions */}
                  {currentTemplate.questions
                    .sort((a, b) => a.position - b.position)
                    .map((question) => (
                      <div key={question.id}>
                        <Label className="text-sm font-medium">
                          {question.content}
                        </Label>
                        {renderQuestionInput(question)}
                      </div>
                    ))}
                  
                  {/* Empty state message for custom templates with no questions */}
                  {currentTemplate.questions.length === 0 && !currentTemplate.is_default && (
                    <div className="flex items-center justify-center min-h-[300px] w-full">
                      <div className="flex flex-col items-center justify-center text-center text-muted-foreground max-w-sm mx-auto">
                        <div className="mb-4">
                          <span className="text-4xl">📝</span>
                        </div>
                        <p className="text-sm mb-2">No questions in this template yet.</p>
                        <p className="text-xs">
                          Click the <strong>Edit</strong> button above to add your first question.
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {isEditing && currentTemplate.questions.length > 0 && (
                  <Button
                    type="submit"
                    className="w-full h-11 md:h-10 text-base md:text-sm font-medium"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Journal Entries"}
                  </Button>
                )}
              </form>
            )}
          </div>
        </div>

                {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
          <DialogContent className="sm:max-w-md mx-4 w-[calc(100vw-2rem)] sm:mx-0 sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center text-destructive text-lg md:text-xl">
                <Trash2 className="h-5 w-5 mr-2" />
                Delete Template
              </DialogTitle>
              <DialogDescription className="text-base text-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{currentTemplate?.name}"</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-semibold mb-3">
                  ⚠️ WARNING: This will permanently delete ALL data
                </p>
                <div className="space-y-2 text-sm text-foreground">
                  <p>This action will permanently delete:</p>
                  <ul className="ml-4 space-y-1 list-disc">
                    <li><strong>The template</strong> "{currentTemplate?.name}"</li>
                    <li><strong>All {currentTemplate?.questions?.length || 0} questions</strong> in this template</li>
                    <li><strong>ALL your journal entries</strong> that answered these questions</li>
                  </ul>
                  <p className="mt-3 font-semibold text-destructive">
                    📝 You will lose all your written responses and journal history for this template.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Consider exporting your data first if you want to keep a backup of your entries.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 md:flex-row">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={loading}
                className="flex-1 h-10"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteCurrentTemplate}
                disabled={loading}
                className="flex-1 h-10"
              >
                {loading ? "Deleting..." : "Delete Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>




      </div>
    </div>
  );
}