# Hands Off Web Agency — Setup Guide

Hackathon setup for the Cursor Hands Off London pipeline: hunt leads → generate sites → WhatsApp outreach → PayPal checkout.

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Environment variables

Copy the example and fill in the blanks:

```bash
cp .env.example .env
```

The project **auto-detects** which keys you have and picks providers accordingly.

### Already configured (from your `.env`)

| Key | Used for |
|-----|----------|
| `OPENROUTER_API_KEY` | Site HTML generation (LLM) |
| `MANUS_API_KEY` | Full site build + hosted deploy on Manus |
| `VERCEL_TOKEN` | Fallback deploy when Manus not used |
| `PAYPAL_CLIENT_ID` / `SECRET` | Sandbox checkout |
| `WASSIST_API_KEY` | Wassist API + outbound auth fallback |

### Still needed

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_URL` | [supabase.com](https://supabase.com) → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (service_role key) — or use publishable key for hackathon |
| `WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID` | Wassist → approved outreach template |
| `WASSIST_AGENT_ID` | Alternative: Wassist agent UUID for session messages (no templates needed) |
| `WEBHOOK_BASE_URL` | Your Vercel URL after deploy |

### Provider priority

| Phase | Auto-selection |
|-------|----------------|
| **Build** | `MANUS_API_KEY` → Manus build + publish. Else `OPENROUTER_API_KEY` → HTML + `VERCEL_TOKEN` deploy |
| **LLM** | OpenRouter → Anthropic → OpenAI (first key found wins) |
| **WhatsApp** | Outbound template if configured. Else `WASSIST_AGENT_ID` session message |

**PayPal sandbox accounts** (for testing checkout yourself):

| Role | Email | Password |
|------|-------|----------|
| Personal (buyer) | `sb-tny6d51323626@personal.example.com` | See `mydocs/paypal-sandbox-kit.csv` |
| Business (seller) | `sb-pykov51323622@business.example.com` | See `mydocs/paypal-sandbox-kit.csv` |

---

## 3. Supabase database

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the full contents of `supabase/schema.sql`
3. Copy **Project URL** and **service_role key** into `.env`
4. Update the two seed leads with phone numbers you control:

```sql
update leads set phone = '+44YOURNUMBER' where name = 'Camden Corner Cafe';
```

---

## 4. Lead hunting (no Outscraper — free sources)

Outscraper was replaced with two **free** options:

### Option A: CSV import (recommended for demo — instant, no API)

Edit `mydocs/leads.csv` with real or test leads:

```csv
name,full_address,phone,niche,site
Your Business,12 Example St London,+447700900000,cafe,
```

Leave `site` empty for businesses with no website.

```bash
npm run hunt -- --source csv
```

### Option B: OpenStreetMap Overpass API (free, live)

Queries OpenStreetMap for London businesses with a phone number and no website tag. No API key needed.

```bash
npm run hunt -- --source overpass --query "cafes in Shoreditch, London"
```

### Option C: Supabase seeds (fallback)

Pre-loaded in `schema.sql`. Skip the hunt step entirely:

```bash
npm run hunt -- --seed
```

---

## 5. Wassist WhatsApp setup

### Create two approved templates

**Template A — Outreach** (variables: name, deployment_url):

> Hi {{1}}, I noticed you don't have a website. I built this for you: {{2}}. Interested?

**Template B — Payment** (variable: paypal_link):

> Great! Claim your site here: {{1}}

Copy each template's outbound endpoint ID into `.env`.

### Register BYOA webhook

1. Deploy to Vercel first (step 6)
2. In Wassist, create a **Bring Your Own Agent** with webhook URL:
   ```
   https://YOUR-APP.vercel.app/api/wassist
   ```
3. Deploy the agent to your WhatsApp number

---

## 6. Deploy to Vercel

The repo includes a **landing page** at `/` with a live dashboard fed by `/api/leads`.

```bash
npm i -g vercel
vercel login
vercel --prod
```

After deploy:
- **Landing page:** `https://YOUR-APP.vercel.app/`
- **Live dashboard:** scroll to "What the agents did" or visit `/#dashboard`
- **Leads API:** `https://YOUR-APP.vercel.app/api/leads`

Set `WEBHOOK_BASE_URL` in `.env` to your production URL (e.g. `https://cursorhand-hack.vercel.app`).

Redeploy if you change env vars:

```bash
vercel env pull .env.local   # optional: sync Vercel env
vercel --prod
```

Add all `.env` values to Vercel project settings → Environment Variables (the webhook runs serverless and needs Supabase + PayPal keys there too).

---

## 7. Rehearsal commands

Run each phase individually first:

```bash
# 1. Load leads (pick one)
npm run hunt -- --source csv
npm run hunt -- --source overpass --query "plumbers in Camden, London"
npm run hunt -- --seed

# 2. Generate + deploy one site
npm run build

# 3. Send WhatsApp outreach
npm run approach

# 4. Full semi-auto demo
npm run pipeline -- --source csv
```

Then on your phone: reply **YES** to the WhatsApp message → PayPal link arrives → complete sandbox checkout.

Mark paid manually if needed:

```bash
npm run payday -- --lead-id <uuid>
```

---

## 8. Demo day script (5 min)

| Time | Action |
|------|--------|
| 0:00 | `npm run pipeline -- --source csv` |
| 0:30 | Show Supabase — leads go `NEW` → `SITE_READY` |
| 1:30 | Open generated Vercel site URL on phone |
| 2:00 | WhatsApp outreach arrives |
| 2:30 | Reply "YES" → PayPal link via webhook |
| 3:30 | Complete PayPal sandbox checkout |
| 4:30 | Supabase shows `PAID` |

**If hunt fails live:** `npm run pipeline -- --seed` then `build` + `approach` only.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Hunt returns 0 Overpass results | Use `--source csv` or `--seed` |
| Build fails | Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` |
| Deploy fails | Run `vercel login`, set `VERCEL_TOKEN` |
| WhatsApp not sending | Templates must be approved; check `WASSIST_OUTBOUND_SECRET` |
| Webhook not firing | Confirm BYOA URL matches deployed `/api/wassist` |
| PayPal link broken | Verify `PAYPAL_CLIENT_ID` / `SECRET` in Vercel env vars |
| YES not detected | Reply with "yes", "yeah", "interested", or "sure" |

---

## File reference

```
mydocs/
  paypal-sandbox-kit.csv   # PayPal sandbox credentials (already in .env)
  leads.csv                # Your hunt leads (CSV mode)

public/
  index.html               # Landing page + live dashboard
  style.css
  dashboard.js

api/
  wassist.ts               # WhatsApp YES → PayPal webhook
  leads.ts                 # Dashboard data API

supabase/schema.sql        # Database schema + seed leads
prompts/site-generation.md # LLM prompt for site HTML
```
