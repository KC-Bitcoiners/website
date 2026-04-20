# Issue #36: Email Newsletter - Investigation & Recommendations

## Current State

The newsletter signup form (`src/components/NewsletterForm.tsx`) is **UI-only**. Subscriptions are stored in `localStorage` on the user's browser and never sent to any server. The form renders on the homepage (`src/pages/index.tsx`) with configurable heading/description from `config.json`.

**Key findings:**
- Form collects `name` and `email`
- Data is saved to `localStorage` under key `"newsletter-subscriptions"` as a JSON array
- No API endpoint or backend service receives the data
- No email provider integration (Mailchimp, Buttondown, etc.)
- The success message says "You've been added to our mailing list" but nothing actually happens
- The config has `newsletterConfig` with heading/description but no backend config

## Recommended Approaches (ranked by simplicity)

### Option 1: Buttondown (Recommended)
Buttondown is a simple email newsletter service with a generous free tier (1,000 subscribers).
- Add a `BUTTONDOWN_API_TOKEN` env variable
- Create a Next.js API route at `src/pages/api/newsletter/subscribe.ts`
- POST to `https://api.buttondown.com/v1/subscribers`
- Minimal code changes (~30 lines)

### Option 2: Nostr-native approach
Since this is a Nostr-native project, consider using NIP-28 public channels for "newsletter" delivery:
- Subscribers follow a specific pubkey/channel
- No email needed -- subscribers get updates via their Nostr client
- Could keep the email form as a bridge (email -> Nostr notification)

### Option 3: Mailchimp / ConvertKit
Traditional email marketing platforms. More features but heavier integration:
- Mailchimp free tier: 500 contacts, 1,000 sends/month
- Requires API key + audience ID in config
- More complex integration but battle-tested

### Option 4: Self-hosted (Listmonk)
If privacy is a priority, self-host Listmonk:
- Full-featured newsletter platform
- Runs as a Docker container
- PostgreSQL backend
- Free but requires infrastructure

## Proposed Implementation (Option 1 - Buttondown)

### Files to create:
1. `src/pages/api/newsletter/subscribe.ts` - API endpoint
2. Update `src/components/NewsletterForm.tsx` - POST to API instead of localStorage

### Config additions (`config.json`):
```json
{
  "newsletter": {
    "provider": "buttondown",
    "heading": "Stay Updated",
    "description": "Get the latest KC Bitcoiners news delivered to your inbox."
  }
}
```

### API Route:
```typescript
// src/pages/api/newsletter/subscribe.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const token = process.env.BUTTONDOWN_API_TOKEN;
  if (!token) return res.status(500).json({ error: "Newsletter not configured" });

  try {
    const response = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, metadata: { name } }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      return res.status(response.status).json({ error: data.detail || "Subscription failed" });
    }
    
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

## Blockers

- **Needs a decision** from maintainers on which email provider to use
- **Needs an API token** configured as env variable
- Current localStorage behavior should be removed once backend is in place

## Minimal Fix (can do now)

If the form is live and collecting "subscribers" that go nowhere, we should at minimum:
1. Add a disclaimer that the service is "coming soon"
2. Or hide the form until a backend is connected

This avoids misleading users into thinking they've actually subscribed.
