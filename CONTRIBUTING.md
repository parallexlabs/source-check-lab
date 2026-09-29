# Contributing

Thank you for helping improve Source Check Lab.

## Setup

```bash
npm ci
npm run lint
npm test
npm run eval
npm run validate:citations
npx playwright install --with-deps chromium
npm run test:browser
npm run check:site
```

Optional model download tests (local or CI with cache):

```bash
npm run test:model
npm run eval:model
```

## Practice content

- All practice documents and summaries must be labelled **SYNTHETIC**
- Every error type must appear at least twice per language in the practice manifest
- Edit practice sets directly in `web/data/practice/`, then run `npm run validate:citations` and `npm test`

## Pull requests

- Keep changes focused
- Update `CHANGELOG.md` for user-visible changes
- Ensure CI passes locally before requesting review

## Licence

Code contributions are under Apache-2.0. Written practice content is under CC BY 4.0.
