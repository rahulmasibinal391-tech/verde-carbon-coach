/**
 * @fileoverview Client-side Gemini API integration with response caching.
 * Provides AI-powered carbon coaching insights and chat replies.
 */

/** @type {{ hash: string, result: string, timestamp: number } | null} */
let insightCache = null;

/** @type {{ hash: string, result: string, timestamp: number } | null} */
let chatCache = null;

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the Gemini API key from the window global, or empty string.
 * @returns {string} API key or ''.
 */
function getApiKey() {
  return window.GEMINI_API_KEY || '';
}

/**
 * Generates a deterministic hash string from a breakdown object for cache keying.
 * @param {Object} obj - The object to hash.
 * @returns {string} JSON-serialized hash key.
 */
function hashObject(obj) {
  return JSON.stringify(obj);
}

/**
 * Checks if a cache entry is still valid (within TTL).
 * @param {{ hash: string, result: string, timestamp: number } | null} cache - Cache entry.
 * @param {string} hash - Current hash to compare.
 * @returns {string|null} Cached result if valid, null otherwise.
 */
function getCachedResult(cache, hash) {
  if (!cache) return null;
  if (cache.hash !== hash) return null;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null;
  return cache.result;
}

/**
 * Calls the Gemini API to generate personalized carbon coaching insights.
 * Returns null if no API key is set or the call fails — triggering rule-based fallback.
 *
 * @param {Object} breakdown - Emissions breakdown: { transport, diet, energy, shopping, waste, flight }.
 * @param {Array<{ date: string, total: number, breakdown: Object }>} history - Last 14 days of entries.
 * @param {{ targetDays: number, daysUnder: number }} weeklyGoal - Weekly goal progress.
 * @returns {Promise<string|null>} AI-generated insight HTML or null.
 */
export async function getGeminiInsight(breakdown, history, weeklyGoal) {
  const API_KEY = getApiKey();
  if (!API_KEY) return null;

  const total = (breakdown.transport || 0) + (breakdown.diet || 0) +
    (breakdown.energy || 0) + (breakdown.shopping || 0) +
    (breakdown.waste || 0) + (breakdown.flight || 0);

  // Check cache first
  const cacheHash = hashObject(breakdown);
  const cached = getCachedResult(insightCache, cacheHash);
  if (cached) return cached;

  const last7 = history.slice(-7);
  const last7Avg = last7.length > 0
    ? last7.reduce((s, e) => s + e.total, 0) / last7.length
    : 0;

  const prompt = `You are Verde, a warm personal carbon coach for Indian users.
The user's carbon footprint today is ${total.toFixed(1)} kg CO2e.
Breakdown: Transport ${(breakdown.transport || 0).toFixed(1)}kg, Diet ${(breakdown.diet || 0).toFixed(1)}kg, Energy ${(breakdown.energy || 0).toFixed(1)}kg, Shopping ${(breakdown.shopping || 0).toFixed(1)}kg, Food Waste ${(breakdown.waste || 0).toFixed(1)}kg, Flights ${(breakdown.flight || 0).toFixed(1)}kg.
Their 7-day average is ${last7Avg.toFixed(1)} kg CO2e.
India average: 5.2 kg/day. 1.5°C climate target: 6.3 kg/day.
Weekly goal: stay under 5.2 kg for ${weeklyGoal.targetDays || 5} days. Currently achieved: ${weeklyGoal.daysUnder || 0} days.

Write a SHORT (3 sentences max), warm, specific coaching message that:
1. Names their exact biggest emission source and today's number
2. Gives ONE concrete action for tomorrow with estimated savings in kg
3. References their trend vs last week (better/worse/same)
Do NOT use generic advice. Be specific to their numbers. Use a friendly tone with Indian context (dal, metro, auto-rickshaw, etc). Format with <p> tags.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
        })
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (text) {
      // Cache the successful result
      insightCache = { hash: cacheHash, result: text, timestamp: Date.now() };
    }

    return text;
  } catch (err) {
    console.error('Gemini insight error:', err);
    return null;
  }
}

/**
 * Calls the Gemini API to generate a chat reply based on the user's message
 * and current carbon data context.
 *
 * @param {string} userMessage - The user's chat message text.
 * @param {Object} currentBreakdown - Current emissions: { transport, diet, energy, shopping, waste, flight }.
 * @param {Array<{ date: string, total: number }>} history - Recent history entries.
 * @returns {Promise<string|null>} AI chat reply text or null.
 */
export async function getGeminiChatReply(userMessage, currentBreakdown, history) {
  const API_KEY = getApiKey();
  if (!API_KEY) return null;

  // Check cache (keyed by user message + breakdown combo)
  const cacheHash = hashObject({ msg: userMessage, bd: currentBreakdown });
  const cached = getCachedResult(chatCache, cacheHash);
  if (cached) return cached;

  const total = (currentBreakdown.transport || 0) + (currentBreakdown.diet || 0) +
    (currentBreakdown.energy || 0) + (currentBreakdown.shopping || 0) +
    (currentBreakdown.waste || 0) + (currentBreakdown.flight || 0);

  const last7 = history.slice(-7);
  const last7Avg = last7.length > 0
    ? last7.reduce((s, e) => s + e.total, 0) / last7.length
    : 0;

  const prompt = `You are Verde, a warm personal carbon coach for Indian users.
Current user data — Today's total: ${total.toFixed(1)} kg CO2e. Transport: ${(currentBreakdown.transport || 0).toFixed(1)}kg, Diet: ${(currentBreakdown.diet || 0).toFixed(1)}kg, Energy: ${(currentBreakdown.energy || 0).toFixed(1)}kg, Shopping: ${(currentBreakdown.shopping || 0).toFixed(1)}kg, Waste: ${(currentBreakdown.waste || 0).toFixed(1)}kg, Flights: ${(currentBreakdown.flight || 0).toFixed(1)}kg.
7-day average: ${last7Avg.toFixed(1)} kg. India average: 5.2 kg/day.
User's message: "${userMessage}"
Reply in 2-3 sentences max. Be specific, warm, and actionable. Use Indian context (dal, metro, auto-rickshaw, cooler, etc). Never give generic advice. Format as plain text (no HTML tags).`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.8 }
        })
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (text) {
      chatCache = { hash: cacheHash, result: text, timestamp: Date.now() };
    }

    return text;
  } catch (err) {
    console.error('Gemini chat error:', err);
    return null;
  }
}
