"use client";

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { OPPPForm, OPPPFormPayload, OPPPFormData, OPPP_TEMPLATE } from '../types';

export function useOPPP() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOPPPForm = useCallback(async (userId: string, formDate: string): Promise<OPPPForm | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (user.id !== userId) {
        throw new Error('User ID mismatch');
      }

      const { data, error: supabaseError } = await supabase
        .from('oppp_form')
        .select('*')
        .eq('user_id', userId)
        .eq('form_date', formDate)
        .maybeSingle();

      if (supabaseError) {
        console.error('Supabase error fetching OPPP form:', supabaseError);
        throw supabaseError;
      }

      if (!data) {
        // No data found, return null
        setLoading(false);
        return null;
      }

      setLoading(false);
      return data as OPPPForm;
    } catch (err) {
      console.error('Error fetching OPPP form:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch OPPP form'));
      setLoading(false);
      return null;
    }
  }, []);

  const fetchAllOPPPForms = useCallback(async (userId: string): Promise<OPPPForm[]> => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (user.id !== userId) {
        throw new Error('User ID mismatch');
      }
      const { data, error: supabaseError } = await supabase
        .from('oppp_form')
        .select('*')
        .eq('user_id', userId)
        .order('form_date', { ascending: false });

      if (supabaseError) {
        console.error('Supabase error fetching all OPPP forms:', supabaseError);
        throw supabaseError;
      }

      setLoading(false);
      return data as OPPPForm[];
    } catch (err) {
      console.error('Error fetching all OPPP forms:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch OPPP forms'));
      setLoading(false);
      return [];
    }
  }, []);

  const upsertOPPPForm = useCallback(async (payload: OPPPFormPayload): Promise<OPPPForm | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (user.id !== payload.user_id) {
        throw new Error('User ID mismatch');
      }

      console.log('Attempting to upsert OPPP form:', payload);

      const { data, error: supabaseError } = await supabase
        .from('oppp_form')
        .upsert({
          user_id: payload.user_id,
          form_date: payload.form_date,
          form_data: payload.form_data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,form_date'
        })
        .select()
        .single();

      if (supabaseError) {
        console.error('Supabase error upserting OPPP form:', supabaseError);
        throw supabaseError;
      }

      console.log('Successfully upserted OPPP form:', data);
      setLoading(false);
      return data as OPPPForm;
    } catch (err) {
      console.error('Error upserting OPPP form:', err);
      setError(err instanceof Error ? err : new Error('Failed to save OPPP form'));
      setLoading(false);
      return null;
    }
  }, []);

  const deleteOPPPForm = useCallback(async (userId: string, formDate: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (user.id !== userId) {
        throw new Error('User ID mismatch');
      }

      const { error: supabaseError } = await supabase
        .from('oppp_form')
        .delete()
        .eq('user_id', userId)
        .eq('form_date', formDate);

      if (supabaseError) {
        console.error('Supabase error deleting OPPP form:', supabaseError);
        throw supabaseError;
      }

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error deleting OPPP form:', err);
      setError(err instanceof Error ? err : new Error('Failed to delete OPPP form'));
      setLoading(false);
      return false;
    }
  }, []);

  const getEmptyFormData = useCallback((): OPPPFormData => {
    return JSON.parse(JSON.stringify(OPPP_TEMPLATE)) as OPPPFormData;
  }, []);

  return {
    fetchOPPPForm,
    fetchAllOPPPForms,
    upsertOPPPForm,
    deleteOPPPForm,
    getEmptyFormData,
    loading,
    error,
  };
}