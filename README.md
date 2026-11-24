# Pug Chatbot

A lightweight AI chatbot that runs entirely in the browser — vanilla HTML, CSS and JavaScript, with no frameworks and no build step. The interface is Persian (RTL) and uses the Vazirmatn font.

**Live demo:** https://onerealparsa.github.io/pug-chatbot/

## Features

- Chat UI implemented by a single `HapoChat` class in plain JavaScript
- Responses come through a Cloudflare Worker proxy, so the OpenAI API key never appears in the frontend or this repository
- The last 100 messages are kept as conversation history in `localStorage`
- 2,000-character limit per message
- Fully responsive RTL layout

## How it works

`script.js` posts each message to a Cloudflare Worker whose URL is set in `config.workerUrl`. The Worker forwards the request to the OpenAI API and injects the API key from its own secrets — the browser only ever knows the Worker URL.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page markup |
| `style.css` | RTL, responsive styling |
| `script.js` | `HapoChat` class: UI state, message history and Worker calls |

## Setup

1. Deploy a Cloudflare Worker that proxies the OpenAI chat-completions endpoint and stores the key as a Worker secret.
2. Put your Worker URL in `config.workerUrl` in `script.js`.
3. Serve the folder statically — or push to `main` and GitHub Pages publishes it automatically (that is how the live demo above is hosted).
