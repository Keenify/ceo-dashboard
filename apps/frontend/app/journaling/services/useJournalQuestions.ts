import { useState, useCallback } from 'react';

// Types for Journal Questions
export interface JournalQuestion {
  id: number;
  template_id: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface JournalQuestionCreate {
  template_id: string;
  content: string;
  position: number;
}

export interface JournalQuestionUpdate {
  content?: string;
  position?: number;
}

export interface QuestionReorderItem {
  question_id: number;
  position: number;
}

export interface JournalQuestionsReorderBulk {
  questions: QuestionReorderItem[];
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const QUESTIONS_ENDPOINT = `${backendApiDomain}/journal-questions/`;

export function useJournalQuestions() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a new question for a template
  const createQuestion = useCallback(
    async (templateId: string, questionData: Omit<JournalQuestionCreate, 'template_id'>): Promise<JournalQuestion | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${QUESTIONS_ENDPOINT}templates/${templateId}/questions`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...questionData,
            template_id: templateId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalQuestion = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating question'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get all questions for a template
  const getTemplateQuestions = useCallback(
    async (templateId: string): Promise<JournalQuestion[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${QUESTIONS_ENDPOINT}templates/${templateId}/questions?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalQuestion[] = await response.json();
        // Ensure questions are sorted by position
        data.sort((a, b) => a.position - b.position);
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching template questions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get a specific question by ID
  const getQuestion = useCallback(
    async (questionId: number): Promise<JournalQuestion | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${QUESTIONS_ENDPOINT}questions/${questionId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalQuestion = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching question'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Update a question
  const updateQuestion = useCallback(
    async (questionId: number, updateData: JournalQuestionUpdate): Promise<JournalQuestion | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${QUESTIONS_ENDPOINT}questions/${questionId}`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalQuestion = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating question'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Delete a question
  const deleteQuestion = useCallback(
    async (questionId: number): Promise<JournalQuestion | null> => {
      setLoading(true);
      setError(null);
      try {
        console.log('🔄 Deleting question ID:', questionId);
        const response = await fetch(`${QUESTIONS_ENDPOINT}questions/${questionId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });

        console.log('🔄 Delete response status:', response.status);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { detail: `HTTP error! status: ${response.status}` };
          }
          setLoading(false);
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        // Handle different successful response types
        let data = null;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const responseText = await response.text();
          if (responseText.trim()) {
            try {
              data = JSON.parse(responseText);
            } catch {
              console.log('✅ Delete successful, non-JSON response');
            }
          }
        }
        
        console.log('✅ Question deleted successfully from database');
        setLoading(false);
        return data || { success: true } as any;
      } catch (err) {
        console.error('❌ Delete question error:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting question'));
        setLoading(false);
        throw err;
      }
    },
    []
  );

  // Reorder questions within a template
  const reorderQuestions = useCallback(
    async (templateId: string, questionsReorder: QuestionReorderItem[]): Promise<JournalQuestion[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${QUESTIONS_ENDPOINT}templates/${templateId}/questions/reorder`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ questions: questionsReorder }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalQuestion[] = await response.json();
        // Ensure questions are sorted by position
        data.sort((a, b) => a.position - b.position);
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while reordering questions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Helper function to calculate the next position for a new question
  const getNextPosition = useCallback(
    (existingQuestions: JournalQuestion[]): number => {
      if (existingQuestions.length === 0) {
        return 1;
      }
      return Math.max(...existingQuestions.map(q => q.position)) + 1;
    },
    []
  );

  return {
    createQuestion,
    getTemplateQuestions,
    getQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getNextPosition,
    loading,
    error,
  };
} 