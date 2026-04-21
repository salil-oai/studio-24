import { Agent, run, tool } from "@openai/agents";
import { buildPptxDeck } from "@/lib/deck/pptx";
import { deckSpecSchema, parseDeckSpec } from "@/lib/deck/schema";
import { uploadDeckToBlob, type StoredDeck } from "@/lib/deck/storage";

const MODEL = "crest-alpha";

function buildAgentInstructions() {
  return [
    "You are Studio 24, a deck-generation agent for editable PowerPoint files.",
    "Turn the user's request into a concise, useful 3-10 slide deck spec.",
    "Call create_pptx_deck exactly once with the final deck spec.",
    "Use title slides, bullet slides, two-column slides, and metric-card slides as appropriate.",
    "Keep body bullets specific, short, and suitable for direct presentation use.",
    "Do not invent precise numbers, dates, customer names, or citations unless the user supplied them.",
    "Use null for subtitle or speakerNotes when they are not needed.",
    "Use speaker notes only for brief presenter guidance.",
  ].join("\n");
}

function buildUserPrompt(prompt: string) {
  return [
    "Create a new editable PowerPoint deck from this request.",
    "The deck must be self-contained and suitable for download as a .pptx.",
    "",
    prompt,
  ].join("\n");
}

export async function generateDeckWithAgent(prompt: string): Promise<StoredDeck> {
  let createdDeck: StoredDeck | null = null;

  const createPptxDeckTool = tool({
    name: "create_pptx_deck",
    description:
      "Create an editable PowerPoint deck from a validated deck specification and upload it for download.",
    parameters: deckSpecSchema,
    strict: true,
    async execute(input) {
      const spec = parseDeckSpec(input);
      const deck = await buildPptxDeck(spec);
      createdDeck = await uploadDeckToBlob(deck);
      return createdDeck;
    },
  });

  const agent = new Agent({
    name: "Studio 24 Deck Agent",
    instructions: buildAgentInstructions(),
    model: MODEL,
    tools: [createPptxDeckTool],
  });

  const result = await run(agent, buildUserPrompt(prompt), {
    maxTurns: 6,
  });

  if (!createdDeck) {
    throw new Error(
      `The deck agent finished without creating a deck. Final output: ${String(
        result.finalOutput ?? "",
      ).slice(0, 240)}`,
    );
  }

  return createdDeck;
}
