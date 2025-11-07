# Environment Variables Setup

This document lists all the environment variables needed for the new search architecture with Upstash QStash.

## Required Environment Variables

### Upstash QStash (NEW - Required for background job processing)
```
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your_qstash_token_here
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key_here
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key_here
```

**How to get these values:**
1. Go to [Upstash Console](https://console.upstash.io/)
2. Create a new QStash account (or use existing)
3. Navigate to QStash section
4. Copy the Token and Signing Keys from the dashboard

### Site URL (Required for QStash webhooks)
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Important:** 
- For local development: `http://localhost:3000`
- For production: Your actual domain (e.g., `https://app.heyhire.com`)
- QStash will call webhooks at this URL + `/api/queue/scrape-candidate` and `/api/queue/score-candidate`

### Existing Variables (Already configured)
```
# Database
DATABASE_URL=your_neon_postgres_url

# Auth
BETTER_AUTH_SECRET=your_secret
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_key

# Serper.dev
SERPER_API_KEY=your_serper_key

# RapidAPI
RAPIDAPI_KEY=your_rapidapi_key
```

## Setup Steps

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Add QStash credentials:**
   - Sign up at https://console.upstash.io/
   - Create a QStash instance
   - Copy all QStash variables to your `.env` file

3. **Update NEXT_PUBLIC_SITE_URL:**
   - For local development, keep as `http://localhost:3000`
   - For production deployment, update to your actual domain

4. **Test QStash webhooks:**
   ```bash
   bun run dev
   ```
   
   The following endpoints should be accessible:
   - `http://localhost:3000/api/queue/scrape-candidate` (POST)
   - `http://localhost:3000/api/queue/score-candidate` (POST)

## QStash Local Development

For local development, you'll need to expose your local server to the internet for QStash to reach your webhooks:

### Option 1: Using ngrok (Recommended)
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Expose your local server
ngrok http 3000

# Copy the HTTPS URL and update NEXT_PUBLIC_SITE_URL in .env
NEXT_PUBLIC_SITE_URL=https://your-ngrok-id.ngrok.io
```

### Option 2: Using Upstash Dev Mode
Upstash QStash has a development mode that delays job execution, allowing you to test locally without exposing your server.

## Verifying Setup

Run these commands to verify everything is configured:

```bash
# Check environment variables are loaded
bun run env:check

# Test database connection
bun drizzle-kit studio

# Test the complete flow (once implemented)
# 1. Start the dev server
bun run dev

# 2. Create a search
# 3. Check QStash dashboard for queued jobs
# 4. Verify candidates are being scraped and scored
```

## Troubleshooting

### QStash jobs not executing
- Verify `NEXT_PUBLIC_SITE_URL` is accessible from the internet
- Check QStash dashboard for failed jobs and error messages
- Ensure signing keys are correct

### Webhooks receiving 401/403 errors
- Verify `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are set
- Check the `verifySignatureAppRouter` is properly wrapping the route handlers

### Candidates stuck in "pending" status
- Check QStash dashboard to see if jobs are queued
- Verify `RAPIDAPI_KEY` is valid and has remaining credits
- Check application logs for scraping errors


