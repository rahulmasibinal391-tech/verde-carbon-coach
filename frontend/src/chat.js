/**
 * @fileoverview Chat interface interactions, XSS security, and API communications.
 */

import { state } from './state.js';
import { getBreakdown } from './calculations.js';
import { getGeminiChatReply } from './gemini.js';
import { trackEvent } from './analytics.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Escapes characters that could trigger XSS inside innerHTML strings.
 * @param {string} str - Raw input text.
 * @returns {string} Clean HTML-safe string.
 */
export function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, (tag) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag;
  });
}

/**
 * Appends a message bubble to the chat conversation container.
 * @param {string} role - Message sender: 'verde' | 'user'.
 * @param {string} htmlContent - Content to display (escaped for user, safe HTML for Verde).
 * @param {string} [source='rule-based'] - Prompt source: 'gemini' | 'rule-based'.
 */
export function appendMessage(role, htmlContent, source = 'rule-based') {
  const container = $('#chat-messages');
  if (!container) return;

  const avatar = role === 'verde' ? '🌿' : '🧑';
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  let badgeHTML = '';
  if (role === 'verde' && source === 'gemini') {
    badgeHTML = '<span class="ai-badge" aria-label="AI generated content">AI-powered</span>';
  }

  // Create message elements safely
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'msg-avatar';
  avatarDiv.textContent = avatar;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg-bubble';
  
  if (role === 'user') {
    // Escape user input fully to prevent XSS
    bubbleDiv.textContent = htmlContent;
  } else {
    // For Verde, render HTML with optional badge
    bubbleDiv.innerHTML = badgeHTML + htmlContent;
  }

  div.appendChild(avatarDiv);
  div.appendChild(bubbleDiv);
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/**
 * Appends and returns typing indicator element.
 * @returns {HTMLElement} Reference to the typing indicator wrapper.
 */
export function showTyping() {
  const container = $('#chat-messages');
  if (!container) return null;

  const div = document.createElement('div');
  div.className = 'chat-msg verde';
  div.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="msg-bubble typing-indicator" aria-label="Verde is typing...">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

/**
 * Dispatches message to the server proxy API.
 */
export async function sendChat() {
  const input = $('#chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Render user message (appendMessage escapes it)
  appendMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  const typingEl = showTyping();

  // Try client-side Gemini chat first if key is present
  try {
    const currentBreakdown = getBreakdown(state);
    const geminiReply = await getGeminiChatReply(text, currentBreakdown, state.history);

    if (geminiReply) {
      if (typingEl) typingEl.remove();
      appendMessage('verde', geminiReply, 'gemini');
      trackEvent('chat_message', { source: 'gemini' });
      return;
    }
  } catch (err) {
    console.warn('Client-side Gemini chat failed, trying backend proxy:', err);
  }

  // Fallback to backend proxy
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        history: state.history.slice(-10) // last 10 days context
      })
    });

    const data = await response.json();
    if (typingEl) typingEl.remove();

    appendMessage('verde', data.reply, data.source || 'rule-based');
    trackEvent('chat_message', { source: data.source || 'rule-based' });
  } catch (error) {
    console.error('Chat API Error:', error);
    if (typingEl) typingEl.remove();
    
    // Hard local fallback if network is completely down
    appendMessage(
      'verde', 
      `<p>Oops, I had trouble reaching my server. Here's a quick tip: Swapping a short car drive for a walk or cycle ride cuts carbon emissions to zero immediately! 🚲</p>`, 
      'rule-based'
    );
    trackEvent('chat_message', { source: 'offline-fallback' });
  }
}

/**
 * Initializes chat control events.
 */
export function initChat() {
  const input = $('#chat-input');
  const sendBtn = $('#chat-send-btn');

  if (!input || !sendBtn) return;

  sendBtn.addEventListener('click', sendChat);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}
