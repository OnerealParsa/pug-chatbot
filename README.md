# Pug Chatbot 🐶

A lightweight AI chatbot that runs entirely in the browser — vanilla HTML, CSS and JavaScript, no frameworks and no build step.

**Live demo:** https://onerealparsa.github.io/pug-chatbot/

## Features

- Chat UI implemented by a single `HapoChat` class in plain JavaScript
- Responses come through a Cloudflare Worker proxy, so the OpenAI API key never appears in the frontend or this repository
- The last 100 messages are kept as conversation history in `localStorage`
- 2,000-character limit per message
- Clean, responsive UI

## How It Works

`script.js` posts each message to a Cloudflare Worker whose URL is set in `config.workerUrl`. The Worker forwards the request to the OpenAI API and injects the API key from its own secrets — the browser only ever knows the Worker URL.

## Project Structure

| File | Purpose |
|---|---|
| `index.html` | Page markup |
| `style.css` | Styling |
| `script.js` | `HapoChat` class: UI state, message history and Worker calls |

## Setup

1. Deploy a Cloudflare Worker that proxies the OpenAI chat-completions endpoint and stores the key as a Worker secret.
2. Put your Worker URL in `config.workerUrl` in `script.js`.
3. Serve the folder statically — or push to `main` and GitHub Pages publishes it automatically (that is how the live demo above is hosted).

## Security Notes

- No API keys are stored in this repository. The OpenAI key lives only in the Cloudflare Worker's secrets.
