/**
 * @fileoverview Wraps Google Gemini API calls for generating personalized footprint coaching.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Returns a configured Gemini generative model or null if the key is missing.
 * @param {string} [systemInstruction] - System coaching directives.
 * @returns {Object|null} Generative model instance or null.
 */
function getModel(systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });
  } catch (error) {
    console.error('Failed to initialize GoogleGenerativeAI:', error);
    return null;
  }
}

/**
 * Calls Gemini to generate personalized daily insights.
 * @param {Object} breakdown - Today's calculated footprint breakdown.
 * @param {Array.<Object>} history - Recent history logs context (7-14 days).
 * @returns {Promise<string|null>} Generated insights HTML or null on failure.
 */
export async function getGeminiInsights(breakdown, history) {
  const systemInstruction = `
    You are a personal carbon coach named Verde. Your job is to help users understand, track, and reduce their daily carbon footprint through simple, personalized, and actionable insights.
    
    Benchmarks Reference:
    - Global 1.5°C target: 6.3 kg CO2e/day per person
    - India national average: 5.2 kg CO2e/day per person

    Always structure your response exactly as follows:
    1. Give their total in kg CO2e and tell them where they stand vs the two benchmarks — in one warm, non-judgmental sentence.
    2. Identify their single biggest contributor and suggest one specific, actionable, and personalized reduction tip for tomorrow based on their history or current activities.
    3. Offer a brief word of encouragement.

    Formatting:
    - Output raw HTML snippet only (do not wrap in markdown \`\`\`html code blocks).
    - Use standard tag elements: <p>, <strong>, etc.
    - Wrap the reduction tip inside a <div class="insight-tip">...</div>.
    - Wrap the encouragement in a <p class="insight-encourage">...</p>.
  `;

  const model = getModel(systemInstruction);
  if (!model) return null;

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  const prompt = `
    Today's Carbon Footprint Breakdown (total: ${total.toFixed(1)} kg CO2e):
    ${JSON.stringify(breakdown, null, 2)}

    User's History (last 14 days):
    ${JSON.stringify(history, null, 2)}

    Analyze today's emissions and their history logs. Provide a warm, personalized coaching response.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (e) {
    console.error('Gemini Insights generation error:', e);
    return null;
  }
}

/**
 * Calls Gemini to generate a response in the coaching chat view.
 * @param {string} message - User typed message text.
 * @param {Array.<Object>} history - Recent log history.
 * @returns {Promise<string|null>} Chat response HTML or null.
 */
export async function getGeminiChatReply(message, history) {
  const systemInstruction = `
    You are a personal carbon coach named Verde. Your job is to help users understand, track, and reduce their daily carbon footprint through simple, personalized, and actionable insights.

    Benchmarks Reference:
    - Global 1.5°C target: 6.3 kg CO2e/day per person
    - India national average: 5.2 kg CO2e/day per person
    
    When a user shares activities, estimate emissions using:
    - Car: 0.21 kg CO2e/km | Motorbike: 0.11 | Bus/Metro: 0.04 | Flight: 90 kg/hr
    - Diet — Vegan: 1.5 kg/day | Vegetarian: 2.5 | Mixed: 4.5 | Meat-heavy: 7.5
    - AC/Heating: 0.82 kg/hr | Devices: 0.05 kg/hr
    - Shopping — Small item: 3.5 kg | Electronics: 15 kg | Appliance: 40 kg
    - Food waste: none = +0 | a little = +0.3 | a lot = +0.8 kg

    Response Structure for logs:
    - Give their total in kg CO2e and tell them where they stand vs the benchmarks in one warm, non-judgmental sentence.
    - Identify their single biggest contributor and suggest one specific reduction tip for tomorrow.
    - Offer a brief word of encouragement.

    Formatting:
    - Output raw HTML snippet (do not wrap in markdown \`\`\`html blocks).
    - Use standard tag elements: <p>, <strong>, etc.
  `;

  const model = getModel(systemInstruction);
  if (!model) return null;

  const prompt = `
    User history context: ${JSON.stringify(history)}
    User message: "${message}"
    
    Respond as Verde. If they shared activities, estimate footprint and follow structure. Otherwise, answer their climate question.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (e) {
    console.error('Gemini Chat generation error:', e);
    return null;
  }
}
