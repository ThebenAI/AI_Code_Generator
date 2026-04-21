import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";

type SuggestRequestBody = {
  businessDescription?: string;
};

type SuggestionOutput = {
  matches: string[];
  importantFields: string[];
  reasoning: string;
  validationNotes: string;
};

const OPENAI_MODEL = "gpt-4o-mini";
const KB_PATH = path.join(process.cwd(), "app", "data", "sap-data-sources.json");
const OUTPUT_SCHEMA = {
  name: "data_source_suggestions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      matches: {
        type: "array",
        items: { type: "string" },
      },
      importantFields: {
        type: "array",
        items: { type: "string" },
      },
      reasoning: { type: "string" },
      validationNotes: { type: "string" },
    },
    required: ["matches", "importantFields", "reasoning", "validationNotes"],
  },
} as const;

type KnowledgeBaseEntry = {
  objectName: string;
  objectType: string;
  domain: string;
  description: string;
  fields: string[];
  keywords: string[];
};

function cleanJsonResponse(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSuggestionOutput(value: unknown): value is SuggestionOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = ["matches", "importantFields", "reasoning", "validationNotes"];

  if (keys.length !== allowedKeys.length) {
    return false;
  }

  if (!keys.every((key) => allowedKeys.includes(key))) {
    return false;
  }

  return (
    isStringArray(candidate.matches) &&
    isStringArray(candidate.importantFields) &&
    typeof candidate.reasoning === "string" &&
    typeof candidate.validationNotes === "string"
  );
}

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_*]+/g)
    .filter((token) => token.length >= 3);
}

function scoreEntry(entry: KnowledgeBaseEntry, descriptionTokens: Set<string>) {
  let score = 0;
  const combined = [
    entry.objectName,
    entry.objectType,
    entry.domain,
    entry.description,
    ...entry.fields,
    ...entry.keywords,
  ]
    .join(" ")
    .toLowerCase();

  for (const token of descriptionTokens) {
    if (combined.includes(token)) {
      score += 1;
    }
  }

  return score;
}

async function loadKnowledgeBase() {
  const raw = await readFile(KB_PATH, "utf8");
  const parsed = JSON.parse(raw) as KnowledgeBaseEntry[];
  return parsed;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing" },
      { status: 500 },
    );
  }

  const client = new OpenAI({ apiKey });

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
        details: isDevelopment ? getErrorMessage(error) : undefined,
      },
      { status: 400 },
    );
  }

  const businessDescription = body.businessDescription?.trim();

  if (!businessDescription) {
    return NextResponse.json(
      { error: "Please provide a business description." },
      { status: 400 },
    );
  }

  let knowledgeBase: KnowledgeBaseEntry[];
  try {
    knowledgeBase = await loadKnowledgeBase();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load local SAP knowledge base.",
        details: isDevelopment ? getErrorMessage(error) : undefined,
      },
      { status: 500 },
    );
  }

  const tokens = new Set(normalizeTokens(businessDescription));
  const topMatches = knowledgeBase
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.entry);

  const fallbackMatches =
    topMatches.length > 0 ? topMatches : knowledgeBase.slice(0, 4);

  const knowledgeSnippet = fallbackMatches
    .map(
      (entry) =>
        `- ${entry.objectName} (${entry.objectType}, domain: ${entry.domain})\n  Description: ${entry.description}\n  Fields: ${entry.fields.join(", ")}\n  Keywords: ${entry.keywords.join(", ")}`,
    )
    .join("\n\n");

  const prompt = `
You are a pragmatic SAP data architect helping a beginner identify likely data sources.

Business description:
${businessDescription}

Local SAP knowledge-base matches (proposals, not guaranteed facts):
${knowledgeSnippet}

Return structured JSON with:
- matches: likely SAP tables/CDS views/object names to investigate first
- importantFields: likely key fields to validate in those objects
- reasoning: short explanation of why these are relevant
- validationNotes: clear note that these are proposals and must be validated against the real schema

Rules:
- Return valid JSON only (no markdown, no extra text)
- Keep suggestions practical, concise, and easy to understand
- Clearly distinguish proposals from validated facts
- Prioritize standard SAP objects first, but mention custom Z* extension path when relevant
`;

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You return structured JSON data-source suggestions.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: OUTPUT_SCHEMA,
      },
    });

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "OpenAI response did not include content." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(cleanJsonResponse(rawContent)) as unknown;

    if (!isSuggestionOutput(parsed)) {
      return NextResponse.json(
        {
          error: "Model output did not match required schema.",
          details: isDevelopment ? "Missing or invalid required fields." : undefined,
          raw: isDevelopment ? rawContent : undefined,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const exactMessage = getErrorMessage(error);
    console.error("[api/suggest-data-sources] OpenAI request failed:", error);

    return NextResponse.json(
      {
        error: isDevelopment
          ? exactMessage
          : "Failed to suggest tables and fields",
        details: isDevelopment ? exactMessage : undefined,
      },
      { status: 502 },
    );
  }
}
