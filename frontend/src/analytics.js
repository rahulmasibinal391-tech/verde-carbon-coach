/**
 * @fileoverview Google Analytics 4 event tracking helper.
 * Safely wraps gtag to avoid errors if the analytics script is blocked or missing.
 */

/**
 * Tracks a custom event in Google Analytics 4.
 *
 * @param {string} name - Event name (e.g., 'log_activity', 'get_insights', 'goal_achieved', 'chat_message').
 * @param {Object} [params] - Event parameters (e.g., category, value, source).
 */
export function trackEvent(name, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  } else {
    // Graceful dry run log in development / fallback mode
    console.log(`[Analytics Event]: ${name}`, params);
  }
}
