# Shared portal integration

The research site now uses the portal's database-driven public flow without login.
See [setup, smoke test and deployment instructions](docs/shared-portal-integration.md).
The older standalone setup below describes the retained legacy backend.

# tanuh_website

A simple repository that currently contains:
- A React + Vite single-page application for a questionnaire (questionnaire-app).
- An empty placeholder for a static site at the repository root (index.html, index.css, index.js).

This README consolidates setup, scripts, and structure for the whole repo.

## Overview
- questionnaire-app: A React (19.x) app bootstrapped with Vite. It renders a consent screen, a questionnaire flow, and a thank-you overlay. Final form data is logged to the browser console and is intended to be sent to a backend in the future.
- Root static site: Presently just placeholder files (empty). TODO: fill in or remove if not needed.

## Tech Stack
- Language: JavaScript (ES Modules)
- Frontend framework: React 19
- Build tool/dev server: Vite (rolldown-vite@7.x)
- Linting: ESLint (with React plugins)
- Package manager: npm (package-lock.json is present)

## Requirements
- Node.js: 18+ recommended (required by modern Vite tooling). If you use nvm:
  - nvm use 18
  - or install via: nvm install 18
- npm: 9+ recommended (bundled with Node 18)

## Getting Started
The functional app lives under questionnaire-app. From the repository root:

1) Install dependencies
- cd questionnaire-app
- npm install

2) Start the dev server
- npm run dev
- Open the printed local URL (usually http://localhost:5173) in your browser.

3) Build for production
- npm run build
- Output will be generated in questionnaire-app/dist

4) Preview the production build locally
- npm run preview

5) Lint
- npm run lint

## Entry Points
- questionnaire-app/src/main.jsx: React entry point that mounts the app to the element with id="root" in questionnaire-app/index.html.
- questionnaire-app/src/App.jsx: Top-level component orchestrating Consent → Questionnaire → ThankYou views.
- Root index.html/index.js/index.css: Currently empty placeholders. TODO: clarify whether these will host a static landing page or be removed.

## Scripts (questionnaire-app/package.json)
- dev: vite — runs the development server with HMR
- build: vite build — builds the production bundle
- preview: vite preview — serves the built bundle locally for testing
- lint: eslint . — lints the project

To run any script, first cd questionnaire-app.

## Environment Variables
- None are currently used in the codebase.
- Vite supports env vars via import.meta.env with the VITE_ prefix. Example usage pattern:
  - Define VITE_API_BASE_URL in a .env file
  - Access it in code with import.meta.env.VITE_API_BASE_URL
- TODO: Document any required environment variables once a backend or external services are integrated.

## Tests
- No tests are present in the repository.
- TODO: Add tests (e.g., with Vitest and React Testing Library) and document how to run them.

## Project Structure
- README.md — This file
- index.html — Placeholder (empty)
- index.css — Placeholder (empty)
- index.js — Placeholder (empty)
- questionnaire-app/
  - README.md — Template README from create-vite (kept for reference)
  - package.json — npm scripts and dependencies for the React app
  - package-lock.json — Lockfile (npm)
  - vite.config.js — Vite configuration (with @vitejs/plugin-react)
  - eslint.config.js — ESLint configuration
  - index.html — HTML shell for the React app (root element with id="root")
  - src/
    - main.jsx — React entry point
    - App.jsx — App shell managing flow
    - components/Consent.jsx, Questionnaire.jsx, ThankYou.jsx — UI components
    - *.css — Component and global styles
  - public/ — Static assets served as-is

## Development Notes
- The Questionnaire component currently logs form data to the console on submit. TODO: wire this to a real backend API when available.
- Some questionnaire code is scaffolded/commented; expand or refine the form as requirements evolve.

## Deployment
- TODO: Add deployment instructions (e.g., where and how the built assets are hosted — static hosting, container, or other).

## Docker Compose helper
A convenience script is provided to stop, remove, build, and start services defined in docker-compose.yml.

Usage (run from repo root):
- bash ./dc-rebuild.sh            # all services
- bash ./dc-rebuild.sh web        # specific service (e.g., "web")

Requirements:
- Docker with Compose v2 (docker compose ...)

## Apache deploy helper
An executable script is provided to install an Apache vhost .conf into the correct Apache directories, check syntax, and reload Apache.

Usage (run from repo root):
- sudo ./apache-apply-site.sh                                  # uses default conf path
- sudo ./apache-apply-site.sh deploy/apache/bc-screener-research.conf
- sudo ./apache-apply-site.sh /path/to/your-site.conf

What it does (Ubuntu/Debian with apache2):
- Ensures required Apache modules are enabled (headers, proxy, proxy_http, rewrite, ssl; tries proxy_wstunnel if available)
- Copies the given .conf to /etc/apache2/sites-available/
- Enables the site with a2ensite <name>
- Validates Apache config: apache2ctl -t
- Reloads Apache: systemctl reload apache2

Requirements:
- Debian/Ubuntu with apache2, a2ensite, apache2ctl, and systemd (systemctl)
- Root privileges (use sudo)

Note:
- The default source conf is deploy/apache/bc-screener-research.conf in this repo.
- If your repo has a differently named file (e.g., bc-screener-research_1.conf), pass its path explicitly.

## License
- TODO: Add a LICENSE file and specify the project license in this README.
