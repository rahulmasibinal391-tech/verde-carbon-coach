/**
 * @fileoverview Main Express backend proxy for Verde Carbon Coach.
 * Serves static assets, validates inputs, caches AI responses, and rate limits calls.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { rateLimit } from 'express-rate-limit';

import { getGeminiInsights, getGeminiChatReply } from './gemini.js';
import { getRuleBasedInsights, getRuleBasedChatReply } from './fallback.js';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json());

// ─── Security: Rate Limiting ───
// Restrict requests to protect Gemini quota
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 API requests per window
  message: {
    status: 429,
    message: 'Too many requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// ─── Efficiency: In-memory Cache ───
// Cache Gemini responses based on JSON-serialized breakdowns
const insightsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Periodically purges expired entries from the cache map.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of insightsCache.entries()) {
    if (value.expiresAt < now) {
      insightsCache.delete(key);
    }
  }
}, 60000); // run cleanup every minute

// ─── Endpoints ───

/**
 * POST /api/insights
 * Requests footprints analysis from Gemini or local rules fallback.
 */
app.post('/api/insights', async (req, res) => {
  const { breakdown, history } = req.body;

  // 1. Security Validation & Clamping
  if (!breakdown || typeof breakdown !== 'object') {
    return res.status(400).json({ error: 'Invalid breakdown payload structure.' });
  }

  // Ensure history is a valid list
  const sanitizedHistory = Array.isArray(history) ? history : [];

  // Sanitize numbers and clamp bounds
  const keys = ['transport', 'diet', 'energy', 'shopping', 'waste', 'flight'];
  const sanitizedBreakdown = {};

  for (const k of keys) {
    let val = parseFloat(breakdown[k]);
    if (isNaN(val) || val < 0) {
      val = 0;
    }
    // Clamp to sane maximum bounds (prevents massive loops or overflow values)
    if (val > 100000) val = 100000;
    sanitizedBreakdown[k] = val;
  }

  // 2. Efficiency Check: Cache hit search
  const cacheKey = JSON.stringify(sanitizedBreakdown);
  const cachedVal = insightsCache.get(cacheKey);
  if (cachedVal && cachedVal.expiresAt > Date.now()) {
    return res.json({ source: 'gemini', insights: cachedVal.insights });
  }

  // 3. Process Request
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    // Falls back immediately to rule-based insights if key is not configured
    const ruleInsights = getRuleBasedInsights(sanitizedBreakdown);
    return res.json({ source: 'rule-based', insights: ruleInsights });
  }

  const geminiInsights = await getGeminiInsights(sanitizedBreakdown, sanitizedHistory);

  if (geminiInsights) {
    // Store in cache
    insightsCache.set(cacheKey, {
      insights: geminiInsights,
      expiresAt: Date.now() + CACHE_TTL
    });
    return res.json({ source: 'gemini', insights: geminiInsights });
  } else {
    // Fail-safe rule-based fallback if API query crashes
    const ruleInsights = getRuleBasedInsights(sanitizedBreakdown);
    return res.json({ source: 'rule-based', insights: ruleInsights });
  }
});

/**
 * POST /api/chat
 * Coached conversation prompt forwarding endpoint.
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  // Security checks
  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  // Clamp message length to prevent quota abuse
  const trimmedMessage = message.slice(0, 1000);
  const sanitizedHistory = Array.isArray(history) ? history : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    const ruleReply = getRuleBasedChatReply(trimmedMessage);
    return res.json({ source: 'rule-based', reply: ruleReply });
  }

  const geminiReply = await getGeminiChatReply(trimmedMessage, sanitizedHistory);

  if (geminiReply) {
    return res.json({ source: 'gemini', reply: geminiReply });
  } else {
    // Rule-based fallback on API failure
    const ruleReply = getRuleBasedChatReply(trimmedMessage);
    return res.json({ source: 'rule-based', reply: ruleReply });
  }
});

// ─── Serving Client Static Assets ───
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// On Windows, pathname may start with a leading slash (like /D:/...) which path.resolve fails on.
// Let's resolve relative to process.cwd() which is safer.
const rootPath = path.resolve();
const distPath = path.join(rootPath, 'dist');
const frontendPath = path.join(rootPath, 'frontend');

const clientStaticPath = fs.existsSync(distPath) ? distPath : frontendPath;

console.log(`Serving static client files from: ${clientStaticPath}`);
app.use(express.static(clientStaticPath));

// Fallback all routes to index.html for client side routing if any
app.get('*', (req, res) => {
  res.sendFile(path.join(clientStaticPath, 'index.html'));
});

// Start the server listener
app.listen(PORT, () => {
  console.log(`Verde Carbon Coach server running on port http://localhost:${PORT}`);
});
