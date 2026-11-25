# Opaad

**Think ahead. Work with confidence.**
The AI copilot for executive and personal assistants: plan the day, draft in your executive's voice, keep to-dos, notes and reminders, and send the end-of-day report with proof.

## What v1 does

| Area | What works |
|---|---|
| Onboarding | You, one executive (name, role, how you address them, pronoun), 5 of 24 working traits, a writing sample, privacy, reminders |
| Today | Greeting, week, today's brief, Plan my day, To do / Notes / Reminders cards, time-blocked plan with "Now", outstanding items |
| Tasks | To do / Notes / Reminders tabs, grouped by Overdue / Today / Coming up / No date / Done today, inline add (Enter keeps adding), detail page with due time, tag, notes and evidence (photo, video, file) |
| Quick add | The + button fans out Evidence, To do, Reminder, Note; the card grows out of the button; the item lands with Undo |
| Ask Opaad (agent) | Opens over any screen from the top-right button; Back returns you where you were. Answers plus proposed actions (to-dos, reminders, notes, a day plan, a message draft, tonight's report, a preference to remember). Nothing changes until you approve; everything can be undone |
| Report | Built from today's work, editable, rewrite in the executive's style, choose which proof to attach, share to WhatsApp (with files where the phone allows), email or copy. Opaad never sends anything itself |
| Executive | Up to 5 executives, each with their own traits, writing samples, learned preferences (removable), never-suggest rules; delete everything about one |
| Alerts | Overdue, due within two hours, tonight's report, what Opaad learned, free-plan usage |
| Plans | Free: everything plus 3 AI requests. Paid (unlimited AI) is not built yet |
| Data | Stored on the device (IndexedDB). Export and delete-all in Settings. Installable as an app (PWA) |

**Not in v1** (by design or still to build): accounts and sync across devices, email reminders, push when the app is closed, payments, reading WhatsApp/email/calendars (never), sending messages on the user's behalf (never).

## Stack

React 19 + TypeScript (strict) · Vite · Tailwind CSS 4 · React Router 7 · Zod · idb-keyval · lucide-react.
AI: OpenRouter chat completions with tool calling, called from a Vercel Function (`api/agent.js`, bundled from `server/`). The key never reaches the browser.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (the AI route needs `vercel dev` or a deployment)
npm test             # unit tests: store logic, report, alerts, agent server
npm run build        # type-check, build the web app to dist/, bundle api/agent.js
npm run build:preview  # the claude.ai preview build (Claude answers instead of OpenRouter)
```

## Deploy (Vercel)

1. Import this repository in Vercel (framework: Vite, build command `npm run build`, output `dist`).
2. In Project Settings → Environment Variables add `OPENROUTER_API_KEY` (from openrouter.ai/keys). In OpenRouter's privacy settings, turn off training on your data.
3. Deploy. `GET /api/agent` returns `{ "configured": true }` when the key is set.

## Google Calendar connector

The assistant connects their own Google account; calendars their executives share with them appear in Settings, where they pick one per executive. Today shows that calendar's meetings, the agent sees today's and tomorrow's events, and an event the agent proposes is written to Google only after the assistant approves it (Undo deletes it). The access token stays in browser memory for about an hour; nothing about it is stored.

Setup, once:
1. Google Cloud console: create a project and enable the **Google Calendar API**.
2. **Google Auth Platform → Branding / Audience**: app name Opaad, your support email, audience **External**, status **Testing**. Add each tester's Google address under **Test users** (up to 100 while testing).
3. **Data access**: add the scopes `calendar.calendarlist.readonly` and `calendar.events`.
4. **Clients → Create client → Web application**. Authorized JavaScript origins: `https://opaad.vercel.app` and `http://localhost:5173`. No redirect URI is needed.
5. Copy the client ID into Vercel as `VITE_GOOGLE_CLIENT_ID` (all environments) and redeploy. It is public by design; there is no client secret in this flow.

Before opening to everyone, Google must verify the app because `calendar.events` is a sensitive scope: a privacy policy on the Opaad domain, a homepage, and a short demo video.

## How the agent stays safe

- The model only **proposes** actions as tool calls. The server validates them with Zod and drops anything malformed; the app runs nothing until the assistant taps Approve, and every change can be undone.
- The system prompt forbids fabricated records (fake receipts, forged letters, false statements to auditors) and claiming anything was sent.
- Requests go to OpenRouter with `provider.data_collection: "deny"`.

## Project layout

```
src/app          router, layout, sidebar
src/features     onboarding, today, tasks (quick add, inline add, detail), ask (agent UI), report, executive, alerts, settings
src/lib          model (Zod schemas), agent client + shared prompt/tools, report builder, alerts, dates, device (share, notify, voice)
src/store        state, persistence, pure logic (tested)
server           agent server code and tests → bundled to api/agent.js
```
