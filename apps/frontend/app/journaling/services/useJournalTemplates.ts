import { useState, useCallback } from 'react';

// Types for Journal Templates
export interface JournalTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalQuestion {
  id: number;
  template_id: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface JournalTemplateWithQuestions extends JournalTemplate {
  questions: JournalQuestion[];
}

export interface JournalTemplateCreate {
  name: string;
  description?: string;
  user_id: string;
  is_default?: boolean;
}

export interface JournalTemplateUpdate {
  name?: string;
  description?: string;
}

export interface JournalTemplateDuplicate {
  name: string;
  description?: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const TEMPLATES_ENDPOINT = `${backendApiDomain}/journal-templates/`;

export function useJournalTemplates() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a new template
  const createTemplate = useCallback(
    async (templateData: JournalTemplateCreate): Promise<JournalTemplate | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(TEMPLATES_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalTemplate = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get template by ID
  const getTemplate = useCallback(
    async (templateId: string): Promise<JournalTemplate | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}${templateId}?t=${Date.now()}`, {
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

        const data: JournalTemplate = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get template with questions
  const getTemplateWithQuestions = useCallback(
    async (templateId: string): Promise<JournalTemplateWithQuestions | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}${templateId}/with-questions?t=${Date.now()}`, {
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

        const data: JournalTemplateWithQuestions = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching template with questions'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get user templates (including defaults)
  const getUserTemplates = useCallback(
    async (userId: string, includeDefaults: boolean = true): Promise<JournalTemplate[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = includeDefaults 
          ? `${TEMPLATES_ENDPOINT}user/${userId}/with-defaults`
          : `${TEMPLATES_ENDPOINT}user/${userId}`;
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalTemplate[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user templates'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Get default templates
  const getDefaultTemplates = useCallback(
    async (): Promise<JournalTemplate[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}defaults/`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalTemplate[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching default templates'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Update template
  const updateTemplate = useCallback(
    async (templateId: string, updateData: JournalTemplateUpdate): Promise<JournalTemplate | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}${templateId}`, {
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

        const data: JournalTemplate = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Delete template
  const deleteTemplate = useCallback(
    async (templateId: string): Promise<JournalTemplate | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}${templateId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalTemplate = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // Duplicate template
  const duplicateTemplate = useCallback(
    async (templateId: string, userId: string, duplicateData: JournalTemplateDuplicate): Promise<JournalTemplateWithQuestions | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${TEMPLATES_ENDPOINT}${templateId}/duplicate?user_id=${userId}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(duplicateData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: JournalTemplateWithQuestions = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while duplicating template'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    createTemplate,
    getTemplate,
    getTemplateWithQuestions,
    getUserTemplates,
    getDefaultTemplates,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    loading,
    error,
  };
} 