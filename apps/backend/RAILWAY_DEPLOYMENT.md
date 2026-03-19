# Railway Deployment Guide

## Prerequisites
1. Railway account (free tier available)
2. GitHub repository with your code

## Environment Variables to Set in Railway

Copy these environment variables from your local `.env` file to Railway:

- `DATABASE_URL` - Your production PostgreSQL URL (Railway can provide this)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `TAIGA_USERNAME` - Your Taiga username
- `TAIGA_PASSWORD` - Your Taiga password  
- `TAIGA_PROJECT_SLUG` - Your Taiga project slug
- `TAIGA_API_URL` - Usually `https://api.taiga.io/api/v1`

## Deployment Steps

1. **Connect Repository**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Environment Variables**
   - Go to your project → Variables tab
   - Add all the environment variables listed above

3. **Railway will automatically:**
   - Detect Python project from `requirements.txt`
   - Build using the `railway.toml` configuration
   - Start server using: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Get Your Webhook URL**
   - After deployment, you'll get a URL like: `https://your-app.railway.app`
   - Your webhook endpoint will be: `https://your-app.railway.app/webhooks/taiga`

## Health Check

Test your deployment:
- Root endpoint: `https://your-app.railway.app/`
- Webhook endpoint: `https://your-app.railway.app/webhooks/taiga`

## Taiga Configuration

After deployment, update your Taiga project webhook URL to:
`https://your-app.railway.app/webhooks/taiga`