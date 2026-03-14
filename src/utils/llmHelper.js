import Anthropic from '@anthropic-ai/sdk';
import { urgencyFallback } from './urgencyScorer';

/**
 * LLM Helper for customer support triage
 * Uses a single structured Claude call returning JSON with category, urgency,
 * routing team, reasoning, and a ready-to-send reply draft.
 *
 * FIX #1: Replaced zero-instruction Groq prompt + fragile keyword extraction
 *         with a single Claude call that returns structured JSON directly.
 *         The old code: sent the raw ticket as-is, then searched the AI's
 *         freeform reply for the word "billing" — so "this is NOT a billing
 *         issue" would still be tagged Billing. Now Claude is told exactly
 *         what to return and we parse it as JSON.
 */

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Required for browser-based calls
});

const ANALYSIS_PROMPT = `You are a customer support ticket analyzer for Relay AI, a customer operations platform. Analyze the ticket below and respond with ONLY valid JSON — no markdown, no explanation, no extra text.

Ticket:
<ticket>
{ticket_text}
</ticket>

Metadata:
- Submitted: {submission_time}
- Day of week: {day_of_week}
- Is weekend: {is_weekend}

Return this exact JSON structure:
{
  "category": "<one of: Billing, Technical, Feature Request, Account, General>",
  "urgency": "<one of: Critical, High, Medium, Low>",
  "routing_team": "<one of: billing-team, tier2-engineering, tier1-support, product-team, general-support>",
  "confidence": <0.0 to 1.0>,
  "reasoning": {
    "category_reason": "<why this category>",
    "urgency_reason": "<why this urgency — cite specific words/phrases from ticket>",
    "routing_reason": "<why this team>"
  },
  "suggested_reply": "<a complete, empathetic reply draft the agent can send immediately>",
  "urgency_signals": {
    "critical_keywords_found": ["<list any: down, outage, breach, data loss, urgent, emergency, etc.>"],
    "tone": "<one of: panicked, frustrated, neutral, polite, angry>",
    "business_impact_mentioned": <true or false>
  }
}

Urgency guidelines (apply in order):
- Critical: System down, data loss, security breach, complete service failure, revenue blocked
- High:     Major feature broken, significant workflow blocked, angry/frustrated tone, business impact stated
- Medium:   Partial issue, workaround exists, general question about broken feature
- Low:      General question, feature request, compliment, minor inconvenience

Category guidelines:
- Billing:          Payment, invoice, charge, refund, subscription, pricing, cancel
- Technical:        Bug, error, crash, not working, broken, performance, outage, server down
- Feature Request:  Suggestion, would be nice, can you add, wish, enhancement, improve
- Account:          Login, password, access, permissions, profile, 2FA
- General:          Everything else

Routing guidelines:
- billing-team:       Billing category
- tier2-engineering:  Technical with Critical or High urgency
- tier1-support:      Technical with Medium or Low urgency, Account issues
- product-team:       Feature Request
- general-support:    General category`;

/**
 * Analyze a customer support ticket using Claude.
 * Returns structured data: category, urgency, routing_team, reasoning, suggested_reply.
 *
 * @param {string} message - The customer support message
 * @returns {Promise<object>} Full structured analysis result
 */
export async function categorizeMessage(message) {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[now.getDay()];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const submissionTime = now.toLocaleString();

  const prompt = ANALYSIS_PROMPT
    .replace('{ticket_text}', message)
    .replace('{submission_time}', submissionTime)
    .replace('{day_of_week}', dayOfWeek)
    .replace('{is_weekend}', String(isWeekend));

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
    // Strip any accidental markdown fences the model might add
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      category: parsed.category || 'General',
      urgency: parsed.urgency || urgencyFallback(message),
      routing_team: parsed.routing_team || 'general-support',
      confidence: parsed.confidence ?? 0.5,
      reasoning: parsed.reasoning?.category_reason || '',
      urgency_reason: parsed.reasoning?.urgency_reason || '',
      routing_reason: parsed.reasoning?.routing_reason || '',
      suggested_reply: parsed.suggested_reply || '',
      urgency_signals: parsed.urgency_signals || {},
    };
  } catch (error) {
    console.warn('Claude API failed, using keyword fallback:', error.message);
    return getFallbackAnalysis(message);
  }
}

/**
 * Keyword-based fallback when Claude API is unavailable.
 */
function getFallbackAnalysis(message) {
  const lower = message.toLowerCase();

  let category = 'General';
  if (/bill|payment|charge|invoice|subscription|refund|pricing|cancel/.test(lower)) {
    category = 'Billing';
  } else if (/bug|error|crash|not working|broken|down|outage|server|slow/.test(lower)) {
    category = 'Technical';
  } else if (/feature|suggest|improve|wish|enhancement|would be great|would be nice/.test(lower)) {
    category = 'Feature Request';
  } else if (/login|password|access|permission|account|profile|2fa/.test(lower)) {
    category = 'Account';
  }

  const urgency = urgencyFallback(message);

  const routingMap = {
    Billing: 'billing-team',
    Technical: urgency === 'Critical' || urgency === 'High' ? 'tier2-engineering' : 'tier1-support',
    'Feature Request': 'product-team',
    Account: 'tier1-support',
    General: 'general-support',
  };

  const replyMap = {
    Billing: "Thank you for reaching out. I'm sorry to hear about the billing issue — our billing team has been notified and will contact you within 1 business day. In the meantime, you can review your invoices in the billing portal.",
    Technical: "We apologize for the inconvenience. Our engineering team has been alerted and is investigating this issue. We'll provide an update as soon as possible.",
    'Feature Request': "Thank you for the great suggestion! We've forwarded your feedback to our product team. We appreciate you helping us improve Relay AI.",
    Account: "Our support team is ready to help you regain access. Please verify your identity when a team member reaches out to you.",
    General: "Thank you for contacting Relay AI support. A team member will review your message and respond shortly.",
  };

  return {
    category,
    urgency,
    routing_team: routingMap[category] || 'general-support',
    confidence: 0.6,
    reasoning: `Fallback keyword analysis. Category detected as ${category}.`,
    urgency_reason: 'Determined by local urgency keyword analysis (Claude API unavailable).',
    routing_reason: `Routed to ${routingMap[category]} based on category and urgency.`,
    suggested_reply: replyMap[category] || 'A support agent will be in touch shortly.',
    urgency_signals: { critical_keywords_found: [], tone: 'neutral', business_impact_mentioned: false },
  };
}
