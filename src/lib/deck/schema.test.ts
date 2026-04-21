import { describe, expect, it } from "vitest";
import { generateDeckRequestSchema, parseDeckSpec } from "@/lib/deck/schema";

describe("deck schema", () => {
  it("rejects empty prompts", () => {
    expect(generateDeckRequestSchema.safeParse({ prompt: "  " }).success).toBe(
      false,
    );
  });

  it("rejects decks with too many slides", () => {
    const slide = {
      title: "A slide",
      body: ["A useful point"],
      speakerNotes: null,
      layout: "bullets",
    };

    expect(() =>
      parseDeckSpec({
        title: "Too long",
        subtitle: null,
        theme: "modern",
        slides: Array.from({ length: 11 }, () => slide),
      }),
    ).toThrow();
  });
});
