# Relay AI — Customer Inbox Triage

Forked from [jimenezatmit/l2assessment](https://github.com/jimenezatmit/l2assessment) and improved for the Relay AI L2 Assessment.

## Overview

An AI-powered customer support triage tool that categorizes, prioritizes, and routes incoming messages using a single structured Claude (Anthropic) call. It returns category, urgency, routing team, reasoning, and a ready-to-send reply draft — all in one JSON response.

## The 3 Bugs Fixed

### Bug 1 — Broken LLM prompt + fragile category extraction
The original prompt sent the raw ticket text with zero instructions. Category was extracted by checking if the word "billing" appeared anywhere in the AI's freeform response — so `"this is NOT a billing issue"` was still tagged **Billing**.

**Fix:** A single Claude call with a detailed system prompt that returns structured JSON directly. No substring matching needed.

### Bug 2 — Backwards urgency scorer
The original rule-based scorer:
- ALL CAPS → **reduced** urgency by −50 (distress signals should raise urgency)
- Weekend submission → **reduced** urgency −20 (off-hours are more urgent, not less)
- Question marks → **reduced** urgency −25 (questions can be critical)
- Zero content keywords

Result: `"SERVER DOWN NOW"` → Low | `"Thanks!!!"` → High

**Fix:** Keyword-first scoring (critical/high/low keyword lists); ALL CAPS now correctly escalates. Primary urgency comes from Claude's JSON.

### Bug 3 — Copy-paste template bug + urgency ignored
`Feature Request` and `Technical` both routed to "Ask user to check billing portal" (identical to Billing). Urgency was completely ignored — same action regardless of severity.

**Fix:** Per-category actions × 4 urgency levels (Critical/High/Medium/Low). Claude also provides a full suggested reply draft shown directly in the UI.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Anthropic Claude (`claude-sonnet-4-6`)
- **Runtime**: Browser-based (local development only)

## Setup

### Prerequisites

- Node.js v16+
- npm
- Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
git clone https://github.com/MichaelFehdrau0205/l2assignmentRelayAI.git
cd l2assignmentRelayAI
npm install
```

### Configure API Key

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

### Run

```bash
npm run dev
# http://localhost:5173
```

## How It Works

1. Paste a customer support message into the text area
2. Click **Analyze Message**
3. A single structured Claude call returns:
   - **Category** — Billing, Technical, Feature Request, Account, General
   - **Urgency** — Critical, High, Medium, Low
   - **Routing Team** — billing-team, tier2-engineering, tier1-support, product-team, general-support
   - **Confidence** score (0–1)
   - **Reasoning** — why each decision was made, with ticket quotes
   - **Suggested Reply** — a complete, empathetic draft the agent can send immediately
   - **Urgency Signals** — critical keywords found, tone, business impact flag
4. The **Recommended Agent Action** uses both category and urgency (4 levels each)
5. All analyses are saved to localStorage and viewable in the History tab

## Example Test Messages

### Critical — Server outage
```
OUR ENTIRE PLATFORM IS DOWN. All 200 users cannot log in. We are losing revenue every minute. This is completely unacceptable. Fix this NOW.
```

### High — Payment failure
```
I tried to update my credit card but the billing page keeps crashing. I have an invoice due tomorrow and I cannot pay it. Please help ASAP.
```

### Medium — Feature question
```
Hi, I tried the new reporting feature but it doesn't seem to export to CSV correctly. Some columns are missing. Is there a workaround?
```

### Low — Feature request
```
Love the product! When you get a chance, it would be nice to have a dark mode option. No rush — just a suggestion.
```

## Security Note

This application uses `dangerouslyAllowBrowser: true` for local development only. In production, API calls should be proxied through a secure backend server — never expose API keys in the browser.

## License

Educational purposes only.
