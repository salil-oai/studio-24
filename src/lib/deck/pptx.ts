import { mkdir, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import pptxgen from "pptxgenjs";
import type { DeckSpec } from "@/lib/deck/schema";

export const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;

type ThemeConfig = {
  accent: string;
  background: string;
  muted: string;
  panel: string;
  secondary: string;
  text: string;
};

const THEMES: Record<DeckSpec["theme"], ThemeConfig> = {
  executive: {
    accent: "1F6F5B",
    background: "F7F3EA",
    muted: "6B675F",
    panel: "FFFFFF",
    secondary: "D7A83D",
    text: "171412",
  },
  modern: {
    accent: "2563EB",
    background: "F8FAFC",
    muted: "64748B",
    panel: "FFFFFF",
    secondary: "10B981",
    text: "0F172A",
  },
  technical: {
    accent: "7C3AED",
    background: "F6F7FB",
    muted: "667085",
    panel: "FFFFFF",
    secondary: "0EA5E9",
    text: "101828",
  },
};

export type BuiltDeck = {
  fileName: string;
  filePath: string;
  slideCount: number;
  title: string;
};

function safeFilePart(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "studio-24-deck";
}

function addFooter(slide: pptxgen.Slide, index: number, theme: ThemeConfig) {
  slide.addText(`Studio 24 / ${index}`, {
    x: 0.55,
    y: 7.05,
    w: 2.2,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 7,
    color: theme.muted,
    margin: 0,
  });
}

function addKicker(slide: pptxgen.Slide, text: string, theme: ThemeConfig) {
  slide.addText(text.toUpperCase(), {
    x: 0.65,
    y: 0.48,
    w: 4.5,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 8,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
}

function addTitle(slide: pptxgen.Slide, title: string, theme: ThemeConfig) {
  slide.addText(title, {
    x: 0.65,
    y: 0.82,
    w: 7.8,
    h: 0.68,
    fontFace: "Aptos Display",
    fontSize: 25,
    bold: true,
    color: theme.text,
    fit: "shrink",
    margin: 0,
    breakLine: false,
  });
}

function addBulletList(
  slide: pptxgen.Slide,
  body: string[],
  theme: ThemeConfig,
  box: { x: number; y: number; w: number; h: number },
) {
  slide.addText(
    body.map((item) => ({ text: item, options: { bullet: { indent: 14 } } })),
    {
      ...box,
      fontFace: "Aptos",
      fontSize: 15,
      color: theme.text,
      breakLine: false,
      fit: "shrink",
      margin: 0.08,
      paraSpaceAfter: 7,
      valign: "top",
    },
  );
}

function addPanel(
  slide: pptxgen.Slide,
  theme: ThemeConfig,
  box: { x: number; y: number; w: number; h: number },
) {
  slide.addShape("roundRect", {
    ...box,
    rectRadius: 0.06,
    fill: { color: theme.panel, transparency: 0 },
    line: { color: "E7E1D8", transparency: 10 },
    shadow: {
      type: "outer",
      color: "D8D3CA",
      opacity: 0.16,
      blur: 1,
      angle: 45,
      offset: 1,
    },
  });
}

function addAccentRail(slide: pptxgen.Slide, theme: ThemeConfig) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.16,
    h: SLIDE_HEIGHT,
    fill: { color: theme.accent },
    line: { color: theme.accent },
  });
}

function addTitleSlide(pptx: pptxgen, spec: DeckSpec, theme: ThemeConfig) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addAccentRail(slide, theme);
  slide.addShape("arc", {
    x: 8.6,
    y: -0.6,
    w: 4.8,
    h: 4.8,
    fill: { color: theme.secondary, transparency: 8 },
    line: { color: theme.secondary, transparency: 100 },
    rotate: 18,
  });
  slide.addShape("roundRect", {
    x: 8.35,
    y: 3.25,
    w: 3.55,
    h: 1.45,
    rectRadius: 0.08,
    fill: { color: theme.panel, transparency: 4 },
    line: { color: "DED8CE", transparency: 18 },
  });
  slide.addText("AGENTIC POWERPOINT", {
    x: 0.75,
    y: 0.75,
    w: 4,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 8,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
  slide.addText(spec.title, {
    x: 0.72,
    y: 1.35,
    w: 7.6,
    h: 1.55,
    fontFace: "Aptos Display",
    fontSize: 36,
    bold: true,
    color: theme.text,
    fit: "shrink",
    margin: 0,
  });
  slide.addText(spec.subtitle || "Generated with Studio 24", {
    x: 0.76,
    y: 3.15,
    w: 6.6,
    h: 0.65,
    fontFace: "Aptos",
    fontSize: 16,
    color: theme.muted,
    fit: "shrink",
    margin: 0,
  });
  slide.addText(`${spec.slides.length} slides`, {
    x: 8.65,
    y: 3.62,
    w: 1.25,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
  slide.addText("Editable PPTX output", {
    x: 8.65,
    y: 3.92,
    w: 2.2,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: theme.text,
    margin: 0,
  });
  addFooter(slide, 1, theme);
}

function addBulletSlide(
  pptx: pptxgen,
  title: string,
  body: string[],
  index: number,
  theme: ThemeConfig,
): pptxgen.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addAccentRail(slide, theme);
  addKicker(slide, `Slide ${index}`, theme);
  addTitle(slide, title, theme);
  addPanel(slide, theme, { x: 0.78, y: 1.9, w: 7.15, h: 4.55 });
  addBulletList(slide, body, theme, { x: 1.1, y: 2.22, w: 6.52, h: 3.9 });
  slide.addShape("rect", {
    x: 8.55,
    y: 1.9,
    w: 0.08,
    h: 4.55,
    fill: { color: theme.secondary },
    line: { color: theme.secondary },
  });
  slide.addText(body[0] || title, {
    x: 8.9,
    y: 2.05,
    w: 3.1,
    h: 1.3,
    fontFace: "Aptos Display",
    fontSize: 23,
    bold: true,
    color: theme.text,
    fit: "shrink",
    margin: 0,
  });
  addFooter(slide, index, theme);
  return slide;
}

function addTwoColumnSlide(
  pptx: pptxgen,
  title: string,
  body: string[],
  index: number,
  theme: ThemeConfig,
): pptxgen.Slide {
  const slide = pptx.addSlide();
  const split = Math.ceil(body.length / 2);
  slide.background = { color: theme.background };
  addAccentRail(slide, theme);
  addKicker(slide, `Slide ${index}`, theme);
  addTitle(slide, title, theme);
  addPanel(slide, theme, { x: 0.75, y: 1.88, w: 5.55, h: 4.55 });
  addPanel(slide, theme, { x: 6.72, y: 1.88, w: 5.55, h: 4.55 });
  slide.addText("What matters", {
    x: 1.05,
    y: 2.15,
    w: 2,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
  slide.addText("How to act", {
    x: 7.02,
    y: 2.15,
    w: 2,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
  addBulletList(slide, body.slice(0, split), theme, {
    x: 1.03,
    y: 2.62,
    w: 4.95,
    h: 3.35,
  });
  addBulletList(slide, body.slice(split), theme, {
    x: 7,
    y: 2.62,
    w: 4.95,
    h: 3.35,
  });
  addFooter(slide, index, theme);
  return slide;
}

function addMetricsSlide(
  pptx: pptxgen,
  title: string,
  body: string[],
  index: number,
  theme: ThemeConfig,
): pptxgen.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addAccentRail(slide, theme);
  addKicker(slide, `Slide ${index}`, theme);
  addTitle(slide, title, theme);

  const cards = body.slice(0, 4);
  cards.forEach((item, cardIndex) => {
    const x = 0.76 + (cardIndex % 2) * 5.98;
    const y = 1.95 + Math.floor(cardIndex / 2) * 2.15;
    addPanel(slide, theme, { x, y, w: 5.45, h: 1.72 });
    slide.addText(String(cardIndex + 1).padStart(2, "0"), {
      x: x + 0.28,
      y: y + 0.25,
      w: 0.7,
      h: 0.28,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: theme.secondary,
      margin: 0,
    });
    slide.addText(item, {
      x: x + 1.02,
      y: y + 0.25,
      w: 3.95,
      h: 1.05,
      fontFace: "Aptos",
      fontSize: 14,
      bold: true,
      color: theme.text,
      fit: "shrink",
      margin: 0,
    });
  });

  if (body.length > 4) {
    addBulletList(slide, body.slice(4), theme, {
      x: 1.0,
      y: 6.0,
      w: 10.8,
      h: 0.55,
    });
  }
  addFooter(slide, index, theme);
  return slide;
}

function addContentSlide(pptx: pptxgen, spec: DeckSpec, slideIndex: number) {
  const slideSpec = spec.slides[slideIndex - 2];
  const theme = THEMES[spec.theme];
  if (!slideSpec) return;

  let slide: pptxgen.Slide;
  if (slideSpec.layout === "two_column") {
    slide = addTwoColumnSlide(
      pptx,
      slideSpec.title,
      slideSpec.body,
      slideIndex,
      theme,
    );
  } else if (slideSpec.layout === "metrics") {
    slide = addMetricsSlide(pptx, slideSpec.title, slideSpec.body, slideIndex, theme);
  } else {
    slide = addBulletSlide(pptx, slideSpec.title, slideSpec.body, slideIndex, theme);
  }

  if (slideSpec.speakerNotes) {
    slide.addNotes(slideSpec.speakerNotes);
  }
}

export async function buildPptxDeck(spec: DeckSpec): Promise<BuiltDeck> {
  const pptx = new pptxgen();
  pptx.author = "Studio 24";
  pptx.company = "Studio 24";
  pptx.subject = spec.subtitle || spec.title;
  pptx.title = spec.title;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };
  pptx.defineLayout({
    name: "STUDIO_WIDE",
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
  });
  pptx.layout = "STUDIO_WIDE";

  addTitleSlide(pptx, spec, THEMES[spec.theme]);
  for (let index = 2; index <= spec.slides.length + 1; index += 1) {
    addContentSlide(pptx, spec, index);
  }

  const outputDir = path.join(tmpdir(), "studio-24", randomUUID());
  await mkdir(outputDir, { recursive: true });
  const fileName = `${safeFilePart(spec.title)}-${Date.now()}.pptx`;
  const filePath = path.join(outputDir, fileName);

  await pptx.writeFile({ fileName: filePath });

  const fileStat = await stat(filePath);
  if (fileStat.size <= 0) {
    throw new Error("PPTX builder produced an empty file.");
  }

  return {
    fileName,
    filePath,
    slideCount: spec.slides.length + 1,
    title: spec.title,
  };
}
