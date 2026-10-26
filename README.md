# Inventory API Quality Lab

An original REST API and an API-only quality engineering portfolio built with **Fastify, TypeScript, and Playwright Test**. The repository includes the application under test, its OpenAPI contract, test automation, and a Docker-based GitHub Actions workflow.

The suite contains **83 scenarios per environment, 166 tests in total**. The same tests run against isolated `dev` and `prod` catalogs. These names represent local lab namespaces, not real production infrastructure.

## Run the complete demo

Requirements: Node.js 22 and npm. Browser installation is unnecessary.

```powershell
npm ci
npm run typecheck
npm run verify
npm run verify:persistence
npm run report
```

`verify` builds the API, starts it on an available loopback port, runs both Playwright projects over HTTP, and closes the server. It uses a fresh temporary directory under `data/`, removed afterward. No running Docker container or manually started server is required for this route.

The HTML report is generated in `playwright-report/`. `npm run report` opens it. Failures remain failures: retries are zero, and the suite has no skipped or expected-failure cases.

## Run with Docker

Docker Desktop must be running with Linux containers. From the repository root:

```powershell
npm ci
docker build -t inventory-api-quality-lab:local .
docker run -d --name inventory-api-quality-lab -p 3000:3000 -v inventory-lab-data:/app/data inventory-api-quality-lab:local
```

Wait for `http://127.0.0.1:3000/health` to return `{"status":"ok"}`, then:

```powershell
npm run test:dev
npm run test:prod
npm test
npm run report
```

Remove the container after reviewing the results:

```powershell
docker rm -f inventory-api-quality-lab
```

The named volume retains data across container replacement. Use a different container name or port if these are already in use. Never remove a container belonging to another application.

For a server without Docker, run `npm run build` then `npm start` in one terminal and the tests in another.

## API contract

The source of truth is [`openapi/inventory-api.yaml`](openapi/inventory-api.yaml).

| Operation | Successful response | Documented errors |
| --- | --- | --- |
| `GET /health` | 200 | — |
| `GET /api/{environment}/products` | 200 | 400 for an invalid status filter |
| `POST /api/{environment}/products` | 201 | 400, 409 |
| `GET /api/{environment}/products/{id}` | 200 | 404 |
| `PUT /api/{environment}/products/{id}` | 200 | 400, 404, 409 |
| `DELETE /api/{environment}/products/{id}` | 204 | 401, 404 |

Unknown environment prefixes return 404. Collection reads accept `?status=draft`, `active`, or `archived` and sort by SKU.

Product input requires all five fields:

```json
{
  "name": "Warehouse widget",
  "sku": "WIDGET-001",
  "price": 19.99,
  "stock": 20,
  "status": "active"
}
```

- `name`: 1–80 Unicode code points; whitespace-only values are rejected.
- `sku`: 4–20 uppercase letters, digits, or hyphens; unique within its environment.
- `price`: 0.01–99999.99, at most two decimal places.
- `stock`: integer from 0 to 10000.
- `status`: `draft`, `active`, or `archived`.
- Unknown input properties are rejected. PUT replaces all input fields and preserves the UUID and creation timestamp.

DELETE requires `Authorization: Bearer inventory-lab-delete-token` by default. This is a public demo value, not a secret. Set `DELETE_TOKEN` on both the API and test processes to override it. Other operations intentionally do not require authentication.

## Test design and coverage

| File | Responsibility |
| --- | --- |
| `tests/health.spec.ts` | HTTP health response |
| `tests/get-products.spec.ts` | Collection, retrieval, status filters, missing IDs |
| `tests/post-products.spec.ts` | Creation, boundaries, duplicate SKU, input contract |
| `tests/put-products.spec.ts` | Replacement, persisted reads, conflicts, input contract |
| `tests/delete-products.spec.ts` | Authentication, deletion, subsequent reads, missing IDs |
| `tests/environment-isolation.spec.ts` | Cross-environment reads, updates, deletes, and SKU reuse |
| `tests/concurrency.spec.ts` | Competing creates and updates for the same SKU |
| `tests/support/input-contract.ts` | Shared invalid-input matrix and decimal regression cases for POST/PUT |
| `tests/support/inventory.ts` | API client, UUID data, response assertions, authenticated cleanup |

Tests use native `APIRequestContext` requests, independent data, and `finally` cleanup. Schema assertions check response keys, UUIDs, dates, numeric ranges, status values, and SKU format. Rejected updates are checked for unchanged stored data. Concurrency tests assert correctness under contention; they are not performance benchmarks.

`npm run verify:persistence` separately starts and closes two application instances with the same directory, verifying through HTTP that both catalogs survive restart and remain isolated.

## Architecture and tradeoffs

```text
HTTP request → Fastify route → input validation → per-environment store → JSON file
Playwright projects ────────────────────────────→ dev / prod HTTP namespaces
```

The store serializes the complete check-and-write mutation per environment. This prevents duplicate SKUs during concurrent requests and avoids lost updates. It writes a temporary file and renames it before publishing the updated in-memory catalog; initial catalog loading is shared among concurrent callers.

This intentionally small lab uses file persistence for a **single API process**. Do not run multiple processes against the same data directory. It is not a production inventory platform: there is no distributed locking, account management, database, or production authorization model. Atomic replacement does not promise durability against every power-loss scenario.

## Configuration

| Variable | Default | Used by |
| --- | --- | --- |
| `PORT` | `3000` | API server |
| `HOST` | `0.0.0.0` | API server |
| `DATA_DIR` | `./data` | API server |
| `DELETE_TOKEN` | `inventory-lab-delete-token` | API and tests |
| `API_BASE_URL` | `http://127.0.0.1:3000` | Tests against an existing server |

`.env.example` documents available settings. Environment files are not loaded automatically; export the variables in your shell or pass them with Docker `--env-file`. `verify` chooses its own temporary directory and base URL.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile the API to `dist/` |
| `npm run dev` | Start the TypeScript server |
| `npm start` | Start the compiled server |
| `npm run typecheck` | Check source, tests, and configuration |
| `npm run test:list` | Discover all 166 tests |
| `npm run verify` | Build and run both environments with an isolated local server |
| `npm run verify:persistence` | Verify persistence across app restart |
| `npm run test:dev` / `npm run test:prod` | Test one environment on an existing server |
| `npm test` | Test both environments on an existing server |
| `npm run report` | Serve the native Playwright HTML report |

## CI and validation evidence

[The workflow](.github/workflows/api-e2e.yml) creates independent `API E2E - dev` and `API E2E - prod` jobs on separate Ubuntu runners. Each installs locked dependencies, checks types, builds its own Docker image, polls health with a deadline, and runs its project. `fail-fast: false` preserves the other job when one fails. Reports upload with `if: always()` as `playwright-report-dev` and `playwright-report-prod`; failed jobs print container logs.

See [`VALIDATION.md`](VALIDATION.md) for observed local results and remaining Docker/CI verification, and [`BUGS.md`](BUGS.md) for corrected defects. A configured workflow is not evidence of a successful GitHub Actions run.
