-- Complete OPPP Setup Script
-- Run this entire script in your Supabase SQL Editor

-- First, drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS public.oppp_form CASCADE;

-- Create the oppp_form table
CREATE TABLE public.oppp_form (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    form_date DATE NOT NULL,
    form_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, form_date)
);

-- Create an index for better performance
CREATE INDEX idx_oppp_form_user_date ON public.oppp_form(user_id, form_date);

-- Enable Row Level Security
ALTER TABLE public.oppp_form ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own OPPP forms" ON public.oppp_form;
DROP POLICY IF EXISTS "Users can create their own OPPP forms" ON public.oppp_form;
DROP POLICY IF EXISTS "Users can update their own OPPP forms" ON public.oppp_form;
DROP POLICY IF EXISTS "Users can delete their own OPPP forms" ON public.oppp_form;

-- Create RLS policies
CREATE POLICY "Users can read their own OPPP forms" ON public.oppp_form
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own OPPP forms" ON public.oppp_form
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OPPP forms" ON public.oppp_form
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OPPP forms" ON public.oppp_form
    FOR DELETE USING (auth.uid() = user_id);

-- Create a trigger function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS handle_oppp_form_updated_at ON public.oppp_form;
CREATE TRIGGER handle_oppp_form_updated_at
    BEFORE UPDATE ON public.oppp_form
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Test the setup by checking if everything was created correctly
SELECT 
    'Table created successfully' as status,
    count(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'oppp_form' AND table_schema = 'public';

-- Check RLS policies
SELECT 
    'Policies created successfully' as status,
    count(*) as policy_count
FROM pg_policies 
WHERE tablename = 'oppp_form' AND schemaname = 'public';

-- Verify RLS is enabled
SELECT 
    'RLS status' as check_type,
    CASE 
        WHEN rowsecurity = true THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END as rls_status
FROM pg_class 
WHERE relname = 'oppp_form';

-- Test data insertion (this will only work if you're authenticated)
-- Comment out these lines if you want to test manually
/*
INSERT INTO public.oppp_form (user_id, form_date, form_data) 
VALUES (
    auth.uid(),
    CURRENT_DATE,
    '{
        "10-25_years": {
            "relationships": ["Test relationship"],
            "achievements": ["Test achievement"],
            "rituals": ["Test ritual"],
            "wealth": ["Test wealth goal"]
        },
        "1_year": {
            "relationships": [],
            "achievements": [],
            "rituals": [],
            "wealth": []
        },
        "start": {
            "relationships": [],
            "achievements": [],
            "rituals": [],
            "wealth": []
        },
        "stop": {
            "relationships": [],
            "achievements": [],
            "rituals": [],
            "wealth": []
        }
    }'::jsonb
);

SELECT 'Test insertion successful' as test_result, count(*) as row_count 
FROM public.oppp_form WHERE user_id = auth.uid();
*/