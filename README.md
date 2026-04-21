# Studio 24

Studio 24 is a small web app that turns a written prompt into an editable PowerPoint deck.

You type what you want the deck to cover, the app asks an OpenAI agent to plan the deck, and the server creates a real `.pptx` file that you can download and edit in PowerPoint, Keynote, Google Slides, or another presentation editor.

Live app: <https://studio-24.vercel.app>

## What This App Does

Studio 24 is built for one main workflow:

1. Sign in with a shared password.
2. Write a prompt for a deck.
3. Generate the deck.
4. Download the `.pptx` file.
5. Edit the slides normally in PowerPoint.

The output is not a screenshot or a PDF. It is an editable PowerPoint file. Text is placed in PowerPoint text boxes, and slide content is built with native PowerPoint shapes and layouts where practical.

The first version only creates new decks. It does not edit an existing uploaded deck yet.

## Stack

Studio 24 uses:

- Next.js App Router for the web app and API routes.
- TypeScript for app, server, and test code.
- `@openai/agents` for the deck-planning agent.
- `pptxgenjs` for creating editable `.pptx` files in Node.js.
- Vercel Blob for storing generated deck files.
- Local filesystem storage for generated decks during local development.
- Hosted Postgres, such as Neon through Vercel Marketplace, for recent deck history.
- Local Postgres for development.
- Vercel Sandbox for isolated sub-agent runs in deployed environments.
- Docker for the same isolated sub-agent worker during local development.
- A shared password and signed HTTP-only cookie for simple access control.
- Vitest for focused unit tests.

The app is designed to run on Vercel using Node.js serverless functions. It does not use an Edge runtime for deck generation because PowerPoint generation needs Node packages and temporary file work.

## How The App Works

There are two main parts:

- The browser UI, where the user signs in, writes a prompt, and downloads a generated deck.
- The server routes, where auth, agent execution, PowerPoint generation, Blob upload, and deck-history reads happen.

The browser never receives the OpenAI API key, Blob token, database URL, or session secret. Those stay on the server.

### 1. Sign In

The app uses one shared password.

When a user submits the password, the browser calls:

```text
POST /api/auth
```

The server compares the submitted password against `APP_PASSWORD`.

If the password is correct, the server creates a signed session token and stores it in an HTTP-only session cookie.

The cookie lasts 12 hours. Browser JavaScript cannot read it. In production it is also marked secure, so it is only sent over HTTPS.

The app also supports signing out with:

```text
DELETE /api/auth
```

That clears the cookie.

### 2. Submit A Deck Prompt

After sign-in, the user writes a deck prompt in the main text area.

The browser sends the prompt to:

```text
POST /api/decks/generate
```

The request body is:

```json
{
  "prompt": "Create a 6-slide executive update about..."
}
```

The server checks three things before generating a deck:

- The auth cookie is valid.
- The prompt is valid JSON and is between 8 and 8000 characters.
- The required generation environment variables are present.

If any of those checks fail, the route returns an error and does not call OpenAI or write a file.

### 3. The Agent Plans The Deck

The server creates a Studio 24 deck agent with the OpenAI Agents SDK.

The agent is told to turn the user prompt into a concise deck specification. The app gives the agent one tool:

```text
create_pptx_deck
```

The agent must call this tool exactly once. The tool input is validated with a strict schema before any file is generated.

The agent uses model:

```text
crest-alpha
```

### 4. The Tool Receives A Deck Spec

The tool receives a structured deck specification. The shape is:

```ts
{
  title: string;
  subtitle: string | null;
  theme: "executive" | "modern" | "technical";
  slides: Array<{
    title: string;
    body: string[];
    speakerNotes: string | null;
    layout: "title" | "bullets" | "two_column" | "metrics";
  }>;
}
```

The deck must have 3 to 10 content slides. Studio 24 also adds a cover slide, so a 3-slide deck spec becomes a 4-slide `.pptx` file.

`subtitle` and `speakerNotes` are nullable instead of optional because the OpenAI tool schema is strict. If the agent does not need a subtitle or notes, it sends `null`.

### 5. The Server Builds The PowerPoint

The PowerPoint file is built with `pptxgenjs`.

The builder:

- Creates a 16:9 PowerPoint deck.
- Adds a cover slide.
- Applies one of the simple built-in themes.
- Renders each slide using one of the supported layouts.
- Adds text boxes, shapes, panels, footer text, and speaker notes.
- Writes the `.pptx` file to temporary server storage.

The temporary file is only an intermediate step. It is not meant to be permanent storage.

### 6. The Deck Is Uploaded To Vercel Blob

After the `.pptx` file is created, the server stores it.

In production, the server reads the file and uploads it to Vercel Blob.

The upload uses:

```text
BLOB_READ_WRITE_TOKEN
```

The blob path starts with:

```text
decks/
```

The upload is public so the browser can download the file from the returned URL.

In local development, the server can skip Vercel Blob and copy the file into:

```text
public/generated/decks
```

Those files are served by Next.js at:

```text
/generated/decks/{fileName}
```

This lets you generate and download decks locally without using Blob storage.

The API response looks like:

```json
{
  "title": "Studio 24",
  "slideCount": 4,
  "blobUrl": "https://...public.blob.vercel-storage.com/decks/example.pptx",
  "fileName": "studio-24-1234567890.pptx"
}
```

The UI shows a download card for the latest result.

### 7. The Deck Metadata Is Saved To Postgres

After the file is uploaded to Vercel Blob, the app tries to save a small history record in Postgres.

The database record stores:

- Deck title.
- Slide count.
- Blob download URL.
- File name.
- Creation time.

The `.pptx` file itself is not stored in the database. The database only stores metadata and the Blob URL.

Studio 24 uses `DATABASE_URL` to connect to Postgres. A Neon Postgres database from Vercel Marketplace is the intended hosted setup.

If `DATABASE_URL` is not configured, deck generation still works, but the Recent decks panel has no persistent server-side history.

### 8. Sandboxed Sub-Agent Smoke Flow

Studio 24 now has a sandbox runtime for agent and sub-agent work.

The first sandboxed flow is intentionally small. It runs a test sub-agent, returns a short result, and proves that the app can safely start isolated agent work before the full deck-generation flow is moved into that boundary.

The host app does this:

- Checks the same signed auth cookie.
- Builds a small sandbox job.
- Chooses the sandbox driver.
- Sends only the safe job input and model env vars.
- Receives structured JSON back from the sandbox.
- Keeps Blob, Postgres, app password, and session secrets on the host.

Local development uses Docker:

```text
SANDBOX_DRIVER=docker
```

Vercel deployment uses Vercel Sandbox:

```text
SANDBOX_DRIVER=vercel
```

If `SANDBOX_DRIVER` is not set, the app chooses Docker outside Vercel and Vercel Sandbox inside Vercel.

The sandbox gets only:

```text
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_BASE_URL
```

The sandbox does not receive:

```text
BLOB_READ_WRITE_TOKEN
DATABASE_URL
APP_PASSWORD
APP_SESSION_SECRET
VERCEL_OIDC_TOKEN
```

That means generated files and database writes stay host-side. The sandbox is disposable.

Vercel Sandbox snapshots are used like Docker images. A snapshot pre-installs the worker dependencies so production does not need to install packages from scratch on every run.

## API Routes

### `POST /api/auth`

Signs in with the shared password.

Input:

```json
{
  "password": "..."
}
```

Success response:

```json
{
  "ok": true
}
```

Side effect:

- Sets the signed session cookie.

Common errors:

- `400` if the body is invalid.
- `401` if the password is wrong.
- `500` if auth is not configured.

### `DELETE /api/auth`

Signs out.

Success response:

```json
{
  "ok": true
}
```

Side effect:

- Clears the signed session cookie.

### `POST /api/decks/generate`

Generates a new deck.

Input:

```json
{
  "prompt": "Create a deck about..."
}
```

Success response:

```json
{
  "title": "Deck title",
  "slideCount": 4,
  "blobUrl": "https://...",
  "fileName": "deck-file-name.pptx"
}
```

Common errors:

- `401` if the user is not signed in.
- `400` if the prompt is missing, too short, too long, or invalid JSON.
- `500` if OpenAI, PPTX generation, or Blob upload fails.

This route explicitly uses the Node.js runtime:

```ts
export const runtime = "nodejs";
export const maxDuration = 300;
```

The 300-second max duration gives the agent and PowerPoint generation enough room for slower deck requests.

### `GET /api/decks/recent`

Returns recent generated decks from Postgres.

Success response:

```json
{
  "configured": true,
  "decks": [
    {
      "id": "deck-history-id",
      "title": "Deck title",
      "slideCount": 4,
      "blobUrl": "https://...",
      "fileName": "deck-file-name.pptx",
      "createdAt": "2026-04-21T04:00:00.000Z"
    }
  ]
}
```

Common errors:

- `401` if the user is not signed in.
- `500` if the database is configured but cannot be reached.

### `POST /api/sandbox/smoke`

Runs a sandboxed sub-agent smoke test.

Input:

```json
{
  "mode": "mock",
  "prompt": "Optional short task for the sub-agent"
}
```

`mode` can be:

- `mock` to test container startup, file transfer, output parsing, and secret isolation without calling OpenAI.
- `live` to run a real Agents SDK sub-agent with `OPENAI_API_KEY`.

Success response:

```json
{
  "ok": true,
  "driver": "docker",
  "durationMs": 1234,
  "subAgentResult": {
    "mode": "mock",
    "model": "crest-alpha",
    "outputText": "Mock sandbox sub-agent received...",
    "sdkLoaded": true,
    "forbiddenEnvPresent": []
  }
}
```

Common errors:

- `401` if the user is not signed in.
- `400` if the JSON body, mode, or prompt is invalid.
- `500` if Docker, Vercel Sandbox, the worker, or the live model call fails.

## Environment Variables

Create `.env.local` for local development:

```bash
cp .env.example .env.local
```

Fill in these variables:

```text
OPENAI_API_KEY=
BLOB_READ_WRITE_TOKEN=
APP_PASSWORD=
APP_SESSION_SECRET=
DATABASE_URL=postgres://salil@localhost:5432/studio24
DECK_STORAGE_DRIVER=local
LOCAL_DECK_STORAGE_DIR=public/generated/decks
LOCAL_DECK_PUBLIC_BASE_URL=/generated/decks
SANDBOX_DRIVER=docker
SANDBOX_SNAPSHOT_ID=
SANDBOX_TIMEOUT_MS=120000
SANDBOX_DOCKER_IMAGE=studio-24-agent-sandbox:local
OPENAI_MODEL=crest-alpha
```

What each variable does:

- `OPENAI_API_KEY` lets the server call the OpenAI Agents SDK.
- `BLOB_READ_WRITE_TOKEN` lets the server upload generated `.pptx` files to Vercel Blob. It is required when `DECK_STORAGE_DRIVER` is `vercel-blob`.
- `APP_PASSWORD` is the shared password for the app.
- `APP_SESSION_SECRET` signs and verifies the auth cookie.
- `DATABASE_URL` connects the app to Postgres for recent deck history.
- `DECK_STORAGE_DRIVER` chooses where generated deck files go. Use `local` on your laptop and `vercel-blob` on Vercel.
- `LOCAL_DECK_STORAGE_DIR` is the local folder where generated `.pptx` files are copied.
- `LOCAL_DECK_PUBLIC_BASE_URL` is the browser URL prefix for those local files.
- `SANDBOX_DRIVER` chooses the sandbox backend. Use `docker` locally and `vercel` on Vercel.
- `SANDBOX_SNAPSHOT_ID` points Vercel Sandbox at a prepared snapshot with worker dependencies installed.
- `SANDBOX_TIMEOUT_MS` caps sandbox startup and worker runtime.
- `SANDBOX_DOCKER_IMAGE` names the local Docker image for the sandbox worker.
- `OPENAI_MODEL` chooses the model used by the sandbox smoke sub-agent. It defaults to `crest-alpha`.

Do not commit `.env.local`. It contains secrets and is ignored by git.

## Local Development

Install dependencies:

```bash
pnpm install
```

Create your local env file:

```bash
cp .env.example .env.local
```

Set the local database URL in `.env.local`:

```text
DATABASE_URL=postgres://salil@localhost:5432/studio24
```

Set local deck file storage in `.env.local`:

```text
DECK_STORAGE_DRIVER=local
LOCAL_DECK_STORAGE_DIR=public/generated/decks
LOCAL_DECK_PUBLIC_BASE_URL=/generated/decks
```

Create and check the local Postgres database:

```bash
pnpm db:setup
```

That command creates the `studio24` database if needed and creates the `deck_history` table.

Start the app:

```bash
pnpm dev:local
```

Open:

```text
http://localhost:3000
```

Use the value from `APP_PASSWORD` to sign in.

Local generated `.pptx` files are written under `public/generated/decks`. That folder is ignored by git and by Vercel deploys.

Build the local sandbox image:

```bash
pnpm sandbox:docker:build
```

Run the Docker sandbox smoke test without calling OpenAI:

```bash
pnpm sandbox:smoke:docker
```

Run the Docker sandbox smoke test with a real Agents SDK model call:

```bash
pnpm sandbox:smoke:docker:live
```

The smoke worker writes output into a temporary host directory, then the runner reads the result and deletes the directory. Set `SANDBOX_KEEP_JOB_DIR=1` only when debugging.

## Vercel Deployment

The app is deployed to Vercel:

```text
https://studio-24.vercel.app
```

The Vercel project needs these environment variables:

```text
OPENAI_API_KEY
BLOB_READ_WRITE_TOKEN
APP_PASSWORD
APP_SESSION_SECRET
DATABASE_URL
SANDBOX_DRIVER
SANDBOX_SNAPSHOT_ID
SANDBOX_TIMEOUT_MS
OPENAI_MODEL
```

The project also needs a connected Vercel Blob store. The Blob integration provides `BLOB_READ_WRITE_TOKEN`.

On Vercel, leave `DECK_STORAGE_DRIVER` unset or set it to:

```text
vercel-blob
```

For deck history, connect a hosted Postgres database. The intended setup is Neon Postgres through Vercel Marketplace. After the database is connected to the Vercel project, make sure `DATABASE_URL` is available in the production environment.

For sandboxed sub-agents, set:

```text
SANDBOX_DRIVER=vercel
```

Production Vercel Sandbox runs should also set:

```text
SANDBOX_SNAPSHOT_ID=snap_...
```

Create that snapshot from a local machine that is linked to the Vercel project:

```bash
pnpm sandbox:snapshot:create
```

The command creates a Vercel Sandbox, installs the worker dependencies, saves a snapshot, and prints the `SANDBOX_SNAPSHOT_ID` value to add in Vercel project env vars.

Run a Vercel Sandbox smoke test without calling OpenAI:

```bash
pnpm sandbox:smoke:vercel
```

Run a Vercel Sandbox smoke test with a real Agents SDK model call:

```bash
pnpm sandbox:smoke:vercel:live
```

Helpful Vercel docs:

- [Vercel Sandbox concepts](https://vercel.com/docs/vercel-sandbox/concepts)
- [Vercel Sandbox snapshots](https://vercel.com/docs/vercel-sandbox/concepts/snapshots)
- [Vercel Sandbox SDK reference](https://vercel.com/docs/vercel-sandbox/sdk-reference)
- [Vercel Sandbox firewall](https://vercel.com/docs/vercel-sandbox/concepts/firewall)

The repo includes `.vercelignore` so local env files and build artifacts are not uploaded during CLI deploys:

```text
.env*
!.env.example
.next
node_modules
```

### GitHub Actions Deployment

The repo includes a GitHub Actions workflow at:

```text
.github/workflows/vercel-production.yml
```

The workflow runs on every push to `main`. It can also be started manually from the GitHub Actions tab.

The workflow does the same production deployment flow that works from a local terminal:

1. Checks out the repository.
2. Installs the Vercel CLI.
3. Pulls the production Vercel project settings.
4. Builds the app with `vercel build --prod`.
5. Deploys the prebuilt output with `vercel deploy --prebuilt --prod`.

The workflow needs these GitHub repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

`VERCEL_TOKEN` should be a Vercel access token that can deploy this project.

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` identify the Vercel team and project. They are available in the local `.vercel/project.json` file after running `vercel link`, or in the Vercel project settings.

Do not commit `.vercel`, `.env.local`, or any secret values. The workflow reads its deployment credentials from GitHub secrets.

If any of those three secrets are missing, the workflow stops before calling Vercel and prints a clear GitHub Actions error.

## Checks

Run the full local check suite before pushing or deploying:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm sandbox:docker:build
pnpm sandbox:smoke:docker
```

What these checks cover:

- `pnpm lint` checks source style and common React/Next mistakes.
- `pnpm typecheck` checks TypeScript types.
- `pnpm test` runs unit tests for auth, deck schema validation, and PPTX generation.
- `pnpm build` verifies the Next.js production build.
- `pnpm sandbox:docker:build` builds the local sandbox image.
- `pnpm sandbox:smoke:docker` verifies the local isolated worker path without an OpenAI call.

Use the live smoke checks when you specifically want to verify model calls:

```bash
pnpm sandbox:smoke:docker:live
pnpm sandbox:smoke:vercel:live
```

## Troubleshooting

### The app says the password is invalid

Check `APP_PASSWORD`.

For local development, check `.env.local`.

For Vercel, check the Vercel project environment variables. If you change an environment variable on Vercel, redeploy the app so the new value is used.

### The app says authentication is required

The session cookie may be missing, expired, or signed with an old `APP_SESSION_SECRET`.

Sign in again. If that does not work, check that `APP_SESSION_SECRET` exists and is the same for the running deployment.

### Deck generation fails before calling OpenAI

Check the prompt. It must be valid JSON from the client request and must be between 8 and 8000 characters.

Also check that the user is signed in.

### OpenAI returns a tool schema error

The deck tool uses a strict schema. Optional fields should be represented as nullable values in the schema. For this app, `subtitle` and `speakerNotes` are `string | null`.

If you add new fields to the deck spec, make sure the schema remains compatible with strict tool calling.

### Blob upload fails

Check `BLOB_READ_WRITE_TOKEN`.

Make sure the Vercel project has a connected Blob store and the token is available to the environment you deployed.

### Recent decks do not appear

Check `DATABASE_URL`.

Make sure the Vercel project has a hosted Postgres database connected and that the production deployment can read the database environment variable.

The app creates the `deck_history` table automatically the first time it reads or writes deck history.

### Docker sandbox smoke fails

First build the image:

```bash
pnpm sandbox:docker:build
```

Then run:

```bash
pnpm sandbox:smoke:docker
```

For live sub-agent calls, check `OPENAI_API_KEY`.

### Vercel Sandbox smoke fails

Check that the Vercel project is linked and that the local env has Vercel Sandbox auth.

For production, check `SANDBOX_SNAPSHOT_ID`. The app requires a snapshot in production so it does not install worker dependencies from scratch on every request.

If the snapshot is stale, recreate it:

```bash
pnpm sandbox:snapshot:create
```

Then update `SANDBOX_SNAPSHOT_ID` in Vercel and redeploy.

### The sandbox says forbidden env vars are present

The worker returns `forbiddenEnvPresent` so tests can prove secret isolation.

That list should be empty. If it is not empty, the host is passing storage, database, auth, or Vercel auth secrets into the sandbox and the env whitelist should be fixed before using the sandbox for real work.

### The generated deck downloads but looks simple

That is expected in v1. The app uses simple built-in themes and layout presets. It does not import a company template or perform advanced design polish yet.

## Known V1 Limits

- Creates new decks only.
- Does not edit existing `.pptx` files.
- Does not upload or read PowerPoint templates.
- Stores only recent deck metadata, not full project history or per-user history.
- Uses simple themes and layout presets.
- Uses one shared password instead of per-user accounts.
- The sandbox flow is currently a sub-agent smoke test. Full deck generation still runs host-side until the sandbox boundary is proven stable.

## Repository Notes

This is a standalone Next.js app. It does not depend on any private local OpenAI monorepo runtime.

The PowerPoint engine is portable Node.js code based on `pptxgenjs`, which keeps the app deployable on Vercel.
