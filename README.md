# Studio 24

Studio 24 is a Vercel-ready Next.js app that uses the OpenAI Agents SDK to generate editable PowerPoint decks from prompts.

## Stack

- Next.js App Router and TypeScript
- OpenAI Agents SDK JS
- PptxGenJS for editable `.pptx` output
- Vercel Blob for generated deck storage
- Shared-password access with a signed HTTP-only cookie

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill in:

- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `APP_PASSWORD`
- `APP_SESSION_SECRET`

Then run:

```bash
pnpm dev
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Notes

The PowerPoint route uses the Node.js runtime and a 300-second max duration so it can generate temporary files before uploading the final deck to Vercel Blob. Existing deck editing is intentionally out of scope for v1.
