import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildPptxDeck } from "@/lib/deck/pptx";

describe("pptx builder", () => {
  it("creates a non-empty pptx with the expected slide count", async () => {
    const deck = await buildPptxDeck({
      title: "Studio 24 Test Deck",
      subtitle: "Generated in tests",
      theme: "executive",
      slides: [
        {
          title: "Why now",
          body: ["Demand is high", "The workflow is clear"],
          speakerNotes: null,
          layout: "bullets",
        },
        {
          title: "How it works",
          body: ["Agent plans", "Tool creates", "Blob stores"],
          speakerNotes: null,
          layout: "two_column",
        },
        {
          title: "Launch checks",
          body: ["Auth", "Generation", "Download"],
          speakerNotes: null,
          layout: "metrics",
        },
      ],
    });

    const file = await stat(deck.filePath);
    expect(deck.slideCount).toBe(4);
    expect(deck.fileName.endsWith(".pptx")).toBe(true);
    expect(file.size).toBeGreaterThan(1000);
  });
});
