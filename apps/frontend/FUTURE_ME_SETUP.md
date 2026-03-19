# Future Me Setup Guide

This guide will help you set up the necessary Supabase configuration for the Future Me feature, including file uploads.

## Prerequisites

- A Supabase project
- Access to your Supabase dashboard
- Backend API configured for handling Future Me letters

## Database Setup

1. The backend API should create the necessary `future_letters` table with the following structure:

```sql
CREATE TABLE public.future_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_email TEXT NOT NULL,
    email_subject TEXT,
    email_content TEXT NOT NULL,
    attachment_urls TEXT[] DEFAULT '{}',
    send_date DATE NOT NULL,
    send_status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## File Storage Setup

1. Log in to your Supabase dashboard.

2. Go to "Storage" in the left sidebar.

3. Create a new bucket called `futureme` (this is the default bucket name used by the file uploader component).

4. Configure the bucket:
   - Make it public or private based on your needs (recommended: private)
   - Set appropriate file size limits (recommended: 5-10MB max for attachments)

5. Set up the following access policies for your storage bucket:

### For the `futureme` bucket

#### Read Policy (for authenticated users to view their own files)

```sql
(auth.uid() = user_id)
```

#### Insert Policy (for authenticated users to upload files)

```sql
(auth.uid() IS NOT NULL)
```

#### Update Policy (for authenticated users to update their own files)

```sql
(auth.uid() = user_id)
```

#### Delete Policy (for authenticated users to delete their own files)

```sql
(auth.uid() = user_id)
```

## Environment Configuration

Ensure the following environment variables are set in your frontend .env.local file:

```NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_API_DOMAIN=http://localhost:8000
```

## Testing the Setup

1. After setting up, navigate to the Future Me page in your application.
2. Try to create a new letter with an attachment.
3. Verify that the file uploads successfully and appears in your Supabase storage bucket.
4. Check that you can view and download the attachment from the letter details.

## Troubleshooting

### File Upload Issues

- Ensure your Supabase storage bucket is properly configured
- Check that the policies are correctly applied
- Look for any CORS issues in the browser console

### Backend API Issues

- Verify the backend API endpoints are correctly implemented
- Check for correct handling of file URLs in the backend

If you encounter any other issues, please check the Supabase logs and frontend console for more detailed error messages.
