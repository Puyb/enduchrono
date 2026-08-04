# AGENTS.md

## Overview
- Monorepo with 4 Fastify services: `chrono`, `classements`, `web`, `sim`
- Each service is an independent Node app (no shared workspace tooling)
- Communication:
  - `sim` -> UDP -> `chrono`
  - `chrono` -> HTTP + WebSocket -> `classements`
  - `web` -> HTTP -> `classements`

## Run Commands (source of truth: docker-compose)
- Full prod stack (with simulator):
  - `docker-compose --profile prod up --build`
- Dev mode (auto-reload, no manual installs needed):
  - `docker-compose --profile dev up`

Ports (dev):
- classements API: `http://localhost:3000`
- chrono API: `http://localhost:3001`
- sim API: `http://localhost:3002`
- web API: `http://localhost:3003`
- UIs:
  - classements: `http://localhost:8080`
  - sim: `http://localhost:8081`
  - web: `http://localhost:8082`

## Service Conventions
- All backends use Fastify CLI:
  - dev: `fastify start -w ... app.js`
  - start: `fastify start ... app.js`
- SQLite via `knex` in each service
- Persistent data stored in `*/data` (mounted by docker)

## Testing
- Services with tests: `chrono`, `classements`, `web`
- Run tests via docker (preferred):
  - `docker compose --profile dev up chrono-test`
  - `docker compose --profile dev up classements-test`
- Direct:
  - `cd chrono && npm test`
  - `cd classements && npm test`
- Test pattern: `test/**/*.test.js` (mocha)

## Important Gotchas
- Do not run services directly on host expecting networking to work; docker service names (`chrono`, `classements`, etc.) are relied on
- Env vars define service discovery (e.g. `CHRONO_HOST`, `CLASSEMENTS_HOST`)
- UI apps require `NODE_OPTIONS=--openssl-legacy-provider` (already set in docker)
- File watching ignores `data` and `ui` directories; changes there won't trigger reload

## Where to Look First
- Entry points: `*/app.js`
- HTTP routes/plugins: auto-loaded via `@fastify/autoload`
- DB logic: typically under service-local modules using `knex`

## Documentation
- Functional specification: `docs/specifications.md`
- Technical architecture: `docs/architecture_technique.md`

When making changes, consult these documents to understand:
- overall system behavior and constraints
- data flow between services
- business rules (duplicates, rankings, corrections)

## When Making Changes
- Prefer validating via full docker stack instead of running a single service
- If touching inter-service behavior, test with `sim` running (UDP flow is critical)
- Avoid changing ports or env names without updating docker-compose
