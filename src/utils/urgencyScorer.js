/**
 * Urgency Scorer — keyword-aware fallback used when the LLM is unavailable.
 *
 * FIX #2: The original scorer was completely backwards:
 *   - ALL CAPS (distress signal) REDUCED urgency by -50
 *   - Weekend submissions REDUCED urgency (more urgent — no staff available)
 *   - Question marks REDUCED urgency (questions can be critical)
 *   - No content keywords at all
 *   Result: "SERVER DOWN NOW" → Low, "Thanks!!!" → High
 *
 * This version uses content-first keyword matching.
 * Primary urgency comes from Claude's JSON response; this is the fallback only.
 */

const CRITICAL_KEYWORDS = [
  'down', 'outage', 'breach', 'data loss', 'emergency', 'urgent',
  'critical', 'production', 'revenue', 'blocked', 'cannot access',
  'security', 'hack', 'compromised', 'all users', 'everyone affected',
  'not working at all', 'completely broken', 'total failure',
]

const HIGH_KEYWORDS = [
  'broken', 'not working', 'failed', 'error', 'crash', 'losing',
  'major', 'serious', 'unacceptable', 'ridiculous',
  'asap', 'immediately', 'right now', 'need help now', 'cannot continue',
  'affecting our team', 'affecting all', 'my whole team', 'losing customers',
]

const LOW_KEYWORDS = [
  'suggestion', 'feature request', 'nice to have', 'when you get a chance',
  'no rush', 'whenever', 'eventually', 'just wondering', 'curious',
  'love your product', 'great work', 'thank you', 'thanks for everything',
]

/**
 * Content-aware urgency fallback — used only when Claude API is unavailable.
 *
 * @param {string} message
 * @returns {"Critical"|"High"|"Medium"|"Low"}
 */
export function urgencyFallback(message) {
  const lower = message.toLowerCase()

  if (CRITICAL_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'Critical'
  }

  // ALL CAPS (ignoring non-letters) signals distress → escalate, not reduce
  const letters = message.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 10 && letters === letters.toUpperCase()) {
    return 'High'
  }

  if (HIGH_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'High'
  }

  if (LOW_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'Low'
  }

  return 'Medium'
}

/**
 * Legacy export kept for existing callers.
 * Delegates to urgencyFallback; primary urgency now comes from Claude.
 */
export function calculateUrgency(message) {
  return urgencyFallback(message)
}
