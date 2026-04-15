# TriggerBot 🚀

> **API Scheduler & Cool-Down Manager** — Keep your APIs warm. Never let a cold start ruin your UX again.

A Next.js + Supabase app to schedule HTTP triggers at custom intervals, with retry logic, logs, and analytics. Perfect for keeping Render, Railway, or any back-end from going into sleep/cool-down mode.

## ✨ Features

- 🔐 **Auth** — Email/password login & signup via Supabase Auth
- 📡 **Monitors** — Schedule GET/POST/PUT/PATCH/DELETE triggers on any URL
- ⏱️ **Smart Intervals** — From 1 minute to 24 hours
- 🔁 **Retry Logic** — Automatic retries with exponential back-off
- 📋 **Logs** — Full execution history with status codes & response times
- 📊 **Analytics** — Per-monitor success rates and visual run history
- ▶️ **Manual Trigger** — Fire any monitor on demand
- ⏸️ **Pause/Resume** — Temporarily disable monitors without deleting them
- ⚡ **Vercel Cron** — Runs every minute via /api/cron

## 🛠️ Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Framework       | Next.js 15 (App Router)          |
| Database + Auth | Supabase                         |
| Styling         | Vanilla CSS (dark glassmorphism) |
| Icons           | Lucide React                     |
| Deployment      | Vercel                           |

## 🚀 Getting Started

### 1. Create a Supabase project

Go to https://supabase.com → New project.

### 2. Run the schema

In your Supabase dashboard → SQL Editor, paste the contents of supabase/schema.sql and run it.

### 3. Configure environment variables

Copy .env.local and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=your_random_secret
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 🔧 Deployment

The vercel.json calls /api/cron every minute automatically.
Add CRON_SECRET to Vercel env vars for security.

## 🗃️ Database Schema

```
monitors
  id, user_id, name, url, method, headers, body
  interval_seconds, retry_count, timeout_seconds
  status (active | paused | error)
  last_triggered_at, next_trigger_at

monitor_logs
  id, monitor_id, success, status_code
  response_time_ms, error_message, triggered_at
```

## 📁 Structure

```
src/app/
  api/cron/        - Cron job (every minute)
  api/trigger/     - Manual trigger
  dashboard/       - Overview, Monitors, Logs, Analytics, Settings
  login/ signup/
src/components/
  Sidebar, MonitorModal
src/lib/
  supabase/, types.ts
supabase/schema.sql
vercel.json
```
