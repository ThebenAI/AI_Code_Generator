import { NextResponse } from "next/server";
import OpenAI from "openai";

type ImproveRequestBody = {
  answers?: string[];
  interviewAnswers?: string[];
  language?: string;
  currentCode?: string;
  generatedCode?: string;
  feedback?: string;
  versionNumber?: number;
};

type ImprovedOutput = {
  versionNumber: number;
  summaryOfChanges: string;
  improvedCode: string;
};

const OPENAI_MODEL = "gpt-4o-mini";
const OUTPUT_SCHEMA = {
  name: "code_improvement",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      versionNumber: { type: "number" },
      summaryOfChanges: { type: "string" },
      improvedCode: { type: "string" },
    },
    required: ["versionNumber", "summaryOfChanges", "improvedCode"],
  },
} as const;

function buildAnswerContext(answers: string[]) {
  return answers
    .map((answer, index) => {
      const safeAnswer = answer?.trim() || "No answer provided.";
      return `Answer ${index + 1}: ${safeAnswer}`;
    })
    .join("\n\n");
}

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

function isImprovedOutput(value: unknown): value is ImprovedOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = ["versionNumber", "summaryOfChanges", "improvedCode"];

  if (keys.length !== allowedKeys.length) {
    return false;
  }

  if (!keys.every((key) => allowedKeys.includes(key))) {
    return false;
  }

  return (
    typeof candidate.versionNumber === "number" &&
    Number.isFinite(candidate.versionNumber) &&
    typeof candidate.summaryOfChanges === "string" &&
    typeof candidate.improvedCode === "string"
  );
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

  let body: ImproveRequestBody;
  try {
    body = (await request.json()) as ImproveRequestBody;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
        details: isDevelopment ? getErrorMessage(error) : undefined,
      },
      { status: 400 },
    );
  }

  const answers = body.answers ?? body.interviewAnswers ?? [];
  const language = body.language?.trim() || "TypeScript";
  const currentCode = body.currentCode?.trim() ?? body.generatedCode?.trim();
  const feedback = body.feedback?.trim();
  const currentVersionNumber =
    typeof body.versionNumber === "number" && Number.isFinite(body.versionNumber)
      ? body.versionNumber
      : 1;
  const nextVersionNumber = currentVersionNumber + 1;

  if (!answers.length || !currentCode || !feedback) {
    return NextResponse.json(
      {
        error:
          "Please provide answers, selected language, current code, and improvement feedback.",
      },
      { status: 400 },
    );
  }

  const answerContext = buildAnswerContext(answers);

  const prompt = `
You are a senior software engineer improving existing code.

Use this context:
- Language: ${language}
- Interview answers:
${answerContext}

Current code (version ${currentVersionNumber}):
${currentCode}

User improvement feedback:
${feedback}

Return JSON with:
- versionNumber: must be exactly ${nextVersionNumber}
- summaryOfChanges: concise explanation of what changed and why
- improvedCode: updated, production-friendly, readable, well-formatted code in the requested language

Rules:
- Return valid JSON only (no markdown, no extra text)
- Keep the code practical and beginner-friendly
- Ensure the improvedCode stays in ${language}
- Return complete code only, not partial fragments
- Preserve the original requirements from interview answers while applying feedback precisely
`;

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You return structured JSON code improvements.",
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

    if (!isImprovedOutput(parsed)) {
      return NextResponse.json(
        {
          error: "Model output did not match required schema.",
          details: isDevelopment ? "Missing or invalid required fields." : undefined,
          raw: isDevelopment ? rawContent : undefined,
        },
        { status: 502 },
      );
    }

    if (parsed.versionNumber !== nextVersionNumber) {
      return NextResponse.json(
        {
          error: "Model output returned an unexpected version number.",
          details: isDevelopment
            ? `Expected versionNumber ${nextVersionNumber}, received ${parsed.versionNumber}.`
            : undefined,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const exactMessage = getErrorMessage(error);
    console.error("[api/improve] OpenAI request failed:", error);

    return NextResponse.json(
      {
        error: isDevelopment ? exactMessage : "Failed to improve generated code",
        details: isDevelopment ? exactMessage : undefined,
      },
      { status: 502 },
    );
  }
}
