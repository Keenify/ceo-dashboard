# One-Page Personal Plan (OPPP) Setup Guide

This guide will help you set up the necessary Supabase configuration for the OPPP feature.

## Prerequisites

- A Supabase project
- Access to your Supabase dashboard
- Admin access to SQL Editor

## Database Setup

### 1. Create the `oppp_form` table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create the oppp_form table
CREATE TABLE IF NOT EXISTS public.oppp_form (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    form_date DATE NOT NULL,
    form_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, form_date)
);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_oppp_form_user_date ON public.oppp_form(user_id, form_date);

-- Enable Row Level Security
ALTER TABLE public.oppp_form ENABLE ROW LEVEL SECURITY;
```

### 2. Set up Row Level Security (RLS) Policies

Run the following SQL to create the necessary RLS policies:

```sql
-- Policy for SELECT: Users can only read their own forms
CREATE POLICY "Users can read their own OPPP forms" ON public.oppp_form
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for INSERT: Users can only create forms for themselves
CREATE POLICY "Users can create their own OPPP forms" ON public.oppp_form
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: Users can only update their own forms
CREATE POLICY "Users can update their own OPPP forms" ON public.oppp_form
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy for DELETE: Users can only delete their own forms
CREATE POLICY "Users can delete their own OPPP forms" ON public.oppp_form
    FOR DELETE USING (auth.uid() = user_id);
```

### 3. Create a trigger for updated_at timestamp (Optional)

```sql
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER handle_oppp_form_updated_at
    BEFORE UPDATE ON public.oppp_form
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

## Expected form_data Structure

The `form_data` JSONB column should follow this structure:

```json
{
  "10-25_years": {
    "relationships": ["item1", "item2"],
    "achievements": ["item1", "item2"],
    "rituals": ["item1", "item2"],
    "wealth": ["item1", "item2"]
  },
  "1_year": {
    "relationships": ["item1", "item2"],
    "achievements": ["item1", "item2"],
    "rituals": ["item1", "item2"],
    "wealth": ["item1", "item2"]
  },
  "start": {
    "relationships": ["item1", "item2"],
    "achievements": ["item1", "item2"],
    "rituals": ["item1", "item2"],
    "wealth": ["item1", "item2"]
  },
  "stop": {
    "relationships": ["item1", "item2"],
    "achievements": ["item1", "item2"],
    "rituals": ["item1", "item2"],
    "wealth": ["item1", "item2"]
  }
}
```

## Testing the Setup

1. After running the SQL commands, navigate to the OPPP page in your application (`/oppp`)
2. Try to create a new form by adding items to different cells
3. Save the form and verify it appears in your Supabase database
4. Try editing the form and saving changes
5. Test the delete functionality

## Troubleshooting

### 403 Forbidden Errors
- Ensure RLS policies are correctly applied
- Check that the user is authenticated
- Verify the `auth.uid()` matches the `user_id` in the policies

### 406 Not Acceptable Errors
- Usually indicates content-type issues or malformed request data
- Check that the `form_data` follows the expected JSON structure

### General Issues
- Check the Supabase logs in your project dashboard
- Look for JavaScript console errors in your browser
- Verify your environment variables are correctly set

If you encounter any other issues, please check the Supabase logs and frontend console for more detailed error messages.