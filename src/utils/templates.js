/**
 * Recommendation Templates — urgency-aware routing actions per category.
 *
 * FIX #3: The original had three problems:
 *   1. Copy-paste bug: Feature Request and Technical both routed to
 *      "Ask user to check billing portal" (identical to Billing)
 *   2. Urgency was completely ignored — same action regardless of severity
 *   3. Category names were inconsistent with what the LLM now returns
 *      (e.g. "Billing Issue" vs the new "Billing")
 *
 * This version:
 *   - Uses the correct category names from the structured LLM response
 *   - Returns different actions based on urgency level
 *   - Is primarily a fallback; the main suggested_reply now comes from Claude
 */

/**
 * Get a recommended action based on category AND urgency.
 * When a Claude-generated suggested_reply is available, prefer that instead.
 *
 * @param {string} category - e.g. "Billing", "Technical", "Feature Request", "Account", "General"
 * @param {string} urgency  - e.g. "Critical", "High", "Medium", "Low"
 * @returns {string} Recommended next step for the support agent
 */
export function getRecommendedAction(category, urgency) {
  const level = urgency || 'Medium'

  const actions = {
    Billing: {
      Critical: 'ESCALATE IMMEDIATELY to billing-team lead. Customer may be locked out. Manually verify account status now.',
      High:     'Assign to billing-team within 1 hour. Pull invoice history and contact customer directly.',
      Medium:   'Route to billing-team. Ask customer to provide their invoice number and account email.',
      Low:      'Direct customer to the billing portal. Respond within 1 business day.',
    },
    Technical: {
      Critical: 'PAGE on-call engineer immediately. Open a P1 incident. Do not wait for business hours.',
      High:     'Escalate to tier2-engineering. Gather error logs and reproduction steps. Respond within 2 hours.',
      Medium:   'Assign to tier1-support. Request browser/device details and steps to reproduce.',
      Low:      'Route to tier1-support. Ask customer to try a browser refresh or clear cache, then follow up.',
    },
    'Feature Request': {
      Critical: 'Log in product backlog with Critical tag. Notify product-team lead for prioritization review.',
      High:     'Log in product backlog with High priority. Acknowledge customer and set expectation for review timeline.',
      Medium:   'Log in product backlog. Thank customer and confirm the request was forwarded to the product team.',
      Low:      'Log in product backlog. Send a thank-you acknowledgment; no SLA required.',
    },
    Account: {
      Critical: 'Escalate to tier1-support immediately. Verify customer identity and restore access. May indicate a breach.',
      High:     'Route to tier1-support. Respond within 2 hours with identity verification instructions.',
      Medium:   'Route to tier1-support. Guide customer through account recovery steps.',
      Low:      'Send account self-service links (password reset, 2FA setup). Follow up if unresolved in 24h.',
    },
    General: {
      Critical: 'Treat as high-priority; assign to general-support lead to triage further.',
      High:     'Assign to senior general-support agent. Respond within 4 hours.',
      Medium:   'Route to general-support. Respond within 1 business day with relevant FAQ links.',
      Low:      'Send FAQ/help-center link. Standard 1-2 business day response SLA applies.',
    },
  }

  const categoryActions = actions[category] || actions['General']
  return categoryActions[level] || categoryActions['Medium']
}

/**
 * Get all recognized categories.
 * @returns {string[]}
 */
export function getAvailableCategories() {
  return ['Billing', 'Technical', 'Feature Request', 'Account', 'General']
}

/**
 * Determines if a ticket should be escalated beyond standard routing.
 *
 * @param {string} category
 * @param {string} urgency
 * @param {string} message
 * @returns {boolean}
 */
export function shouldEscalate(category, urgency, message) {
  return urgency === 'Critical' || urgency === 'High'
}
