import { z } from "zod";

export const deckThemeSchema = z.enum(["executive", "modern", "technical"]);
export const slideLayoutSchema = z.enum([
  "title",
  "bullets",
  "two_column",
  "metrics",
]);

export const deckSlideSchema = z.object({
  title: z.string().trim().min(1).max(90),
  body: z.array(z.string().trim().min(1).max(180)).min(1).max(8),
  speakerNotes: z.string().trim().max(1200).optional(),
  layout: slideLayoutSchema,
});

export const deckSpecSchema = z.object({
  title: z.string().trim().min(1).max(90),
  subtitle: z.string().trim().max(180).optional(),
  theme: deckThemeSchema,
  slides: z.array(deckSlideSchema).min(3).max(10),
});

export const generateDeckRequestSchema = z.object({
  prompt: z.string().trim().min(8).max(8000),
});

export type DeckSpec = z.infer<typeof deckSpecSchema>;
export type DeckTheme = z.infer<typeof deckThemeSchema>;
export type SlideLayout = z.infer<typeof slideLayoutSchema>;

export function parseDeckSpec(input: unknown): DeckSpec {
  return deckSpecSchema.parse(input);
}
