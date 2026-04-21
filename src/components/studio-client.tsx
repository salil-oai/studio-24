"use client";

import {
  Download,
  FileText,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type DeckResult = {
  title: string;
  slideCount: number;
  blobUrl: string;
  fileName: string;
};

type ApiError = {
  error?: string;
};

const EXAMPLE_PROMPTS = [
  "Create a 6-slide executive update on launching a Vercel-ready AI product for sales teams. Include market context, workflow, risks, and next steps.",
  "Create a technical deck explaining how an agent turns a user prompt into an editable PowerPoint file using tools, validation, and storage.",
  "Create a modern product strategy deck for Studio 24, focused on prompt-to-PowerPoint generation for busy operators.",
];

function readRecentDecks(): DeckResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("studio24.recentDecks");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeRecentDecks(decks: DeckResult[]) {
  try {
    window.localStorage.setItem(
      "studio24.recentDecks",
      JSON.stringify(decks.slice(0, 4)),
    );
  } catch {
    // Recent decks are a convenience only.
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}

export function StudioClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0]);
  const [result, setResult] = useState<DeckResult | null>(null);
  const [recentDecks, setRecentDecks] = useState<DeckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecentDecks(readRecentDecks());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const promptLength = prompt.trim().length;
  const canGenerate = authenticated && promptLength >= 8 && !isGenerating;

  const statusText = useMemo(() => {
    if (!authenticated) return "Private prototype";
    if (isGenerating) return "Generating deck";
    return "Ready";
  }, [authenticated, isGenerating]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
    setResult(null);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (response.status === 401) {
        setAuthenticated(false);
      }
      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const deck = (await response.json()) as DeckResult;
      setResult(deck);
      const nextRecent = [
        deck,
        ...recentDecks.filter((item) => item.blobUrl !== deck.blobUrl),
      ].slice(0, 4);
      setRecentDecks(nextRecent);
      writeRecentDecks(nextRecent);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Deck generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function useExamplePrompt() {
    const currentIndex = EXAMPLE_PROMPTS.indexOf(prompt);
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    setPrompt(EXAMPLE_PROMPTS[nextIndex % EXAMPLE_PROMPTS.length]);
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{statusText}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-stone-950 sm:text-3xl">
              Studio 24
            </h1>
          </div>
          {authenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </header>

        <div className="grid flex-1 gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            {!authenticated ? (
              <form onSubmit={handleLogin} className="max-w-md">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-900">
                  <Lock className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-semibold text-stone-950">
                  Sign in to generate decks
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  This prototype uses a shared password before it calls the
                  OpenAI API or writes files to Vercel Blob.
                </p>
                <label className="mt-6 block text-sm font-medium text-stone-700">
                  Password
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-stone-950 outline-none ring-emerald-700 transition focus:border-emerald-700 focus:ring-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isLoggingIn || password.length === 0}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  Continue
                </button>
              </form>
            ) : (
              <form onSubmit={handleGenerate}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-950">
                      Generate an editable PowerPoint
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Describe the audience, narrative, and useful sections.
                      The agent will plan a 3-10 slide deck and produce a
                      downloadable .pptx.
                    </p>
                  </div>
                  <div className="hidden rounded-md bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600 sm:block">
                    {promptLength} chars
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={12}
                  className="mt-5 min-h-72 w-full resize-y rounded-md border border-stone-300 bg-[#fffdf8] p-4 text-base leading-7 text-stone-950 outline-none ring-emerald-700 transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2"
                  placeholder="Create a 6-slide executive deck about..."
                />

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={!canGenerate}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <WandSparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isGenerating ? "Generating" : "Generate deck"}
                  </button>
                  <button
                    type="button"
                    onClick={useExamplePrompt}
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Example
                  </button>
                </div>
              </form>
            )}

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-900">
                      Deck ready
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-stone-950">
                      {result.title}
                    </h3>
                    <p className="mt-1 text-sm text-stone-600">
                      {result.slideCount} editable slides
                    </p>
                  </div>
                  <a
                    href={result.blobUrl}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download .pptx
                  </a>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-stone-500">
                V1 scope
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                <li>Standalone web app deployed to Vercel.</li>
                <li>Prompt to editable PowerPoint generation.</li>
                <li>Private shared-password access.</li>
                <li>Vercel Blob download links.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-stone-500">
                Recent decks
              </h2>
              <div className="mt-4 space-y-3">
                {recentDecks.length === 0 ? (
                  <p className="text-sm leading-6 text-stone-500">
                    Generated decks will appear here for this browser.
                  </p>
                ) : (
                  recentDecks.map((deck) => (
                    <a
                      key={deck.blobUrl}
                      href={deck.blobUrl}
                      className="block rounded-md border border-stone-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span className="block text-sm font-medium text-stone-900">
                        {deck.title}
                      </span>
                      <span className="mt-1 block text-xs text-stone-500">
                        {deck.slideCount} slides
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
