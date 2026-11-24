# Pug Chatbot 🐶

A lightweight AI chatbot that runs entirely in the browser — vanilla HTML, CSS and JavaScript, no frameworks and no build step.

**Live demo:** https://onerealparsa.github.io/pug-chatbot/

## Features

- Chat UI implemented by a single `HapoChat` class in plain JavaScript
- Powered by a **free, key-less AI API** ([Pollinations](https://pollinations.ai)) — no signup, no API key, nothing to configure
- Optional: point the app at any OpenAI-compatible endpoint from the in-app settings
- The last 100 messages are kept as conversation history in `localStorage`
- 2,000-character limit per message
- Clean, responsive UI with dark mode, Persian voice input and chat export

## How It Works

`script.js` sends each message as an OpenAI-style `chat.completions` POST to `https://text.pollinations.ai/openai` (the free default), together with a Persian system prompt that defines the "Hapo" persona and the last few conversation turns.

If the POST request fails (network hiccup or rate limit), the app automatically retries and then falls back to Pollinations' simple GET endpoint, so a single failed request doesn't break the chat.

## Rate Limits

The free anonymous tier allows roughly one request every few seconds per IP. If you hit `429`, wait a moment and try again — or plug your own endpoint into **Settings → آدرس API سفارشی** (any OpenAI-compatible chat-completions URL works).

## Project Structure

| File | Purpose |
|---|---|
| `index.html` | Page markup and settings modal |
| `style.css` | Styling |
| `script.js` | `HapoChat` class: UI state, message history, API calls (POST + GET fallback) |

## Deployment

1. Serve the folder statically, or
2. push to `main` and GitHub Pages publishes it automatically (that is how the live demo above is hosted).

## Security Notes

- No API keys are stored in this repository and none are required — the default API is key-less.
- If you connect a custom endpoint that needs a key, keep it behind your own proxy; never put the key in this repo.
