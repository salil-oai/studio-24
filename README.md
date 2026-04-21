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
- A shared password and signed HTTP-only cookie for simple access control.
- Vitest for focused unit tests.

The app is designed to run on Vercel using Node.js serverless functions. It does not use an Edge runtime for deck generation because PowerPoint generation needs Node packages and temporary file work.

## How The App Works

There are two main parts:

- The browser UI, where the user signs in, writes a prompt, and downloads a generated deck.
- The server routes, where auth, agent execution, PowerPoint generation, and Blob upload happen.

The browser never receives the OpenAI API key, Blob token, or session secret. Those stay on the server.

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
- The required server environment variables are present.

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

After the `.pptx` file is created, the server reads it and uploads it to Vercel Blob.

The upload uses:

```text
BLOB_READ_WRITE_TOKEN
```

The blob path starts with:

```text
decks/
```

The upload is public so the browser can download the file from the returned URL.

The API response looks like:

```json
{
  "title": "Studio 24",
  "slideCount": 4,
  "blobUrl": "https://...public.blob.vercel-storage.com/decks/example.pptx",
  "fileName": "studio-24-1234567890.pptx"
}
```

The UI shows a download card for the latest result. It also saves a short recent-decks list in browser local storage for convenience.

There is no database in v1. Generated deck history is not stored in the app server.

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
```

What each variable does:

- `OPENAI_API_KEY` lets the server call the OpenAI Agents SDK.
- `BLOB_READ_WRITE_TOKEN` lets the server upload generated `.pptx` files to Vercel Blob.
- `APP_PASSWORD` is the shared password for the app.
- `APP_SESSION_SECRET` signs and verifies the auth cookie.

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

Start the app:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

Use the value from `APP_PASSWORD` to sign in.

## Vercel Deployment

The app is deployed to Vercel:

```text
https://studio-24.vercel.app
```

The Vercel project needs the same four environment variables:

```text
OPENAI_API_KEY
BLOB_READ_WRITE_TOKEN
APP_PASSWORD
APP_SESSION_SECRET
```

The project also needs a connected Vercel Blob store. The Blob integration provides `BLOB_READ_WRITE_TOKEN`.

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

## Checks

Run the full local check suite before pushing or deploying:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

What these checks cover:

- `pnpm lint` checks source style and common React/Next mistakes.
- `pnpm typecheck` checks TypeScript types.
- `pnpm test` runs unit tests for auth, deck schema validation, and PPTX generation.
- `pnpm build` verifies the Next.js production build.

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

### The generated deck downloads but looks simple

That is expected in v1. The app uses simple built-in themes and layout presets. It does not import a company template or perform advanced design polish yet.

## Known V1 Limits

- Creates new decks only.
- Does not edit existing `.pptx` files.
- Does not upload or read PowerPoint templates.
- Does not store a server-side deck history.
- Uses simple themes and layout presets.
- Uses one shared password instead of per-user accounts.

## Repository Notes

This is a standalone Next.js app. It does not depend on any private local OpenAI monorepo runtime.

The PowerPoint engine is portable Node.js code based on `pptxgenjs`, which keeps the app deployable on Vercel.
