# Defect record

No open product defect was observed in the final local HTTP run (166 passing tests). This statement is limited to the exercised scenarios, not a claim of exhaustive correctness.

## Corrected during completion

| ID | Finding | Correction and regression evidence |
| --- | --- | --- |
| INV-001 | Two-decimal prices such as 0.29 could be rejected because binary floating-point error exceeded an absolute epsilon. | Scale tolerance to the amount; POST and PUT test 0.29, 19.99, and 99999.99. |
| INV-002 | SKU lookup and write were separate asynchronous operations, permitting competing requests to claim the same SKU. | Serialize the complete mutation and uniqueness check; concurrent POST/PUT tests require exactly one successful claimant. |
| INV-003 | Extra input properties were silently accepted despite `additionalProperties: false`. | Reject unknown keys; shared POST/PUT input-contract tests assert 400 and unchanged data. |
| INV-004 | The response used `allOf` with a closed input schema, which excluded id and timestamps from any valid Product response. | Define the complete closed response schema explicitly and assert its keys and value constraints. |
| INV-005 | Concurrent initial reads could create separate in-memory catalogs; writes exposed changes before persistence succeeded. | Share the initial load promise, mutate a copy, and publish only after atomic file replacement. Concurrent requests and restart verification exercise persistence. |
| INV-006 | Unsupported collection filters returned empty success responses. | Define and implement 400 for invalid filters; test unknown and empty values. |
| INV-007 | JavaScript UTF-16 length rejected valid names containing 80 supplementary Unicode characters. | Count Unicode code points; POST/PUT regression tests use 80 package symbols. |

These findings were identified through code/contract review; the table does not claim that every original defect was independently reproduced before editing. Regression results were observed after correction.

## Automation corrections

- Fix ESM import extensions and unused imports so strict TypeScript validation passes.
- Remove the unconditional JSON Content-Type header. Fastify rejected bodyless DELETE requests with 400; the corrected HTTP suite passes.
- Assert cleanup responses are 204 or 404 instead of silently discarding errors.
- Share the POST/PUT input matrix and remove duplicate scenarios.
- Add a locked dependency manifest and a self-contained HTTP verification command.

## Environment observations

A separate-process localhost run failed with ETIMEDOUT inside the execution sandbox. Running the HTTP server and Playwright as one verification session succeeded. Docker access remained blocked by the sandbox's named-pipe permissions; this is not an API defect. See VALIDATION.md.
