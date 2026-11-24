# Hapo (هاپو) — Pug AI Chatbot

A Persian, RTL-first chat UI for an AI assistant named **Hapo**. The front-end is vanilla HTML/CSS/JavaScript (no build step) and talks to the OpenAI API through a Cloudflare Worker proxy — so the API key never lives in the client.

**Live demo:** https://onerealparsa.github.io/pug-chatbot/

## Features

- Persian RTL interface (Vazirmatn font) with light/dark theme toggle
- OpenAI integration through a Cloudflare Worker proxy (key stored server-side, not in the repo)
- Local chat history in `localStorage` (up to 100 messages), chat export, 2,000-character message limit with live counter
- Typing indicator, connection status checks and retry logic with backoff
- Responsive layout and accessible controls (`aria-label`, `role="log"`)

## Project Structure

| File | Purpose |
|---|---|
| `index.html` | Chat UI markup |
| `style.css` | RTL layout, themes and animations |
| `script.js` | `HapoChat` class: state, history, API calls, settings |

## Configuration

The Worker proxy URL is set in `script.js` (`config.workerUrl`). To use your own proxy, deploy a Cloudflare Worker that forwards chat requests to the OpenAI API and store `OPENAI_API_KEY` as a Worker secret — the key must never be exposed to the front-end.

## Deployment

The site is served with GitHub Pages from the `main` branch — no build step required.
