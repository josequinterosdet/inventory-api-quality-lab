# Local validation evidence

Date: 2026-10-26 (America/Caracas).

## Observed results

| Check | Result |
| --- | --- |
| Node.js / npm | v22.14.0 / 10.9.2 |
| Locked installation | `npm ci --no-fund` succeeded; 58 packages audited, 0 vulnerabilities reported at installation time |
| Runtime and test runner | Fastify 5.12.7 / Playwright 1.64.1, resolved by package-lock.json |
| TypeScript | `npm run typecheck` passed |
| Build | `npm run build` passed |
| Discovery | 166 tests, 83 per project |
| DEV HTTP suite | 83 passed |
| PROD HTTP suite | 83 passed |
| Combined HTTP suite | 166 passed; 0 failed, 0 skipped, 0 flaky; 4 workers, no retries |
| Final combined run | 2026-10-26 10:56:21 America/Caracas, approximately 5.3 seconds |
| Restart persistence | Both environments retained their products and remained isolated after closing and recreating the application |
| OpenAPI | `npx --yes @apidevtools/swagger-cli validate openapi/inventory-api.yaml` reported valid |
| HTML report | `playwright-report/index.html` generated (native Playwright report) |
| Machine-readable report | `test-results/results.json` generated |

The OpenAPI validator was used as a one-time inspection tool and is not a project dependency. Its CLI printed a deprecation notice.

The final suites ran over real HTTP against the compiled Fastify API using `scripts/verify.mjs`, with isolated file storage. They did not use browser automation, mocked HTTP responses, or Fastify injection.

## Reproduction

```powershell
npm ci
npm run typecheck
npm run test:list
npm run verify
npm run verify:persistence
npm run report
```

To select one project after building:

```powershell
node scripts/verify.mjs --project=dev
node scripts/verify.mjs --project=prod
```

The runner automatically starts and closes the API. Each run gets new storage, and no test data is retained after successful cleanup.

## Pending external verification

- Docker CLI 28.5.1 is installed and Docker Desktop was opened, but this execution sandbox could not connect to the Docker Desktop Linux engine named pipe (`Access is denied`). Consequently, Docker image construction and container execution are **not verified** here.
- The Dockerfile and GitHub Actions workflow are prepared. The repository has no configured remote and no GitHub Actions execution was performed. CI artifacts are therefore **not yet available**.
- The project has not been published or committed by this completion task. Publishing requires choosing a destination repository and visibility.

Use the Docker commands in README.md from a terminal with access to Docker Desktop to complete container verification. The standalone HTTP test results above must not be represented as a successful Docker or CI run.
