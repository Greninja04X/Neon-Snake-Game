# Neon Snake (GitHub Pages Ready)

A beautiful, responsive Snake game with neon glow, keyboard + touch controls, multiple lives, sounds, and a local scoreboard.

## Quick start (no build needed)
1. Create a new GitHub repository (public or private).
2. Upload these files to the repository **root** (or push via git).
3. In **Settings → Pages**, set:
   - **Source**: `Deploy from a branch` (or use the provided GitHub Actions below).
   - **Branch**: `main` (root) — then **Save**.
4. Wait for Pages to publish, then open the URL shown in the Pages settings.

> Tip: This repo also includes a GitHub Actions workflow to deploy to Pages automatically.

## Local run
Just open `index.html` in your browser.

## Features
- Keyboard (WASD/arrow keys) + on‑screen D‑pad + swipe support
- Mobile‑friendly responsive canvas
- Multiple lives with soft reset on hit
- Neon particles, theme toggle (dark default), accent color swatches
- Difficulty levels, walls toggle, sound effects
- Scoreboard (top 10) & high score saved to localStorage

## Deploy with GitHub Actions (recommended)
- The workflow on `main` will upload the site as a Pages artifact and deploy.
- Make sure **Pages** is enabled in repository settings.

If you prefer a `gh-pages` branch deployment, you can switch the trigger or use the classic Pages settings.

## License
MIT — do whatever you want, just keep the license notice.
