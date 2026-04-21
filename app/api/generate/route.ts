import { NextResponse } from "next/server";
import OpenAI from "openai";

type GenerateRequestBody = {
  questions?: string[];
  answers?: string[];
  interviewAnswers?: string[];
  language?: string;
};

type GeneratedOutput = {
  solutionSummary: string;
  language: string;
  implementationNotes: string[];
  generatedCode: string;
};

const OPENAI_MODEL = "gpt-4o-mini";
const OUTPUT_SCHEMA = {
  name: "project_specification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      solutionSummary: { type: "string" },
      language: { type: "string" },
      implementationNotes: {
        type: "array",
        items: { type: "string" },
      },
      generatedCode: { type: "string" },
    },
    required: [
      "solutionSummary",
      "language",
      "implementationNotes",
      "generatedCode",
    ],
  },
} as const;

function buildInterviewContext(questions: string[], answers: string[]) {
  return questions
    .map((question, index) => {
      const answer = answers[index]?.trim() || "No answer provided.";
      return `Q${index + 1}: ${question}\nA${index + 1}: ${answer}`;
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateGeneratedOutput(value: unknown): value is GeneratedOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = [
    "solutionSummary",
    "language",
    "implementationNotes",
    "generatedCode",
  ];

  if (keys.length !== allowedKeys.length) {
    return false;
  }

  if (!keys.every((key) => allowedKeys.includes(key))) {
    return false;
  }

  return (
    typeof candidate.solutionSummary === "string" &&
    typeof candidate.language === "string" &&
    isStringArray(candidate.implementationNotes) &&
    typeof candidate.generatedCode === "string"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    console.log("[api/generate] OPENAI_API_KEY loaded:", Boolean(apiKey));
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing" },
      { status: 500 },
    );
  }

  const client = new OpenAI({ apiKey });

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 400 },
    );
  }

  const questions = body.questions ?? [];
  const answers = body.answers ?? body.interviewAnswers ?? [];
  const requestedLanguage = body.language?.trim() || "TypeScript";

  if (!questions.length || !answers.length) {
    return NextResponse.json(
      { error: "Please provide interview questions and interview answers." },
      { status: 400 },
    );
  }

  const interviewContext = buildInterviewContext(questions, answers);

  const prompt = `
You are a senior software engineer who turns interview answers into implementation plans and production-friendly code.

Based on this interview data, generate structured JSON with these keys:
- solutionSummary: concise implementation overview in plain language
- language: exactly match the requested language
- implementationNotes: array of practical implementation notes
- generatedCode: complete, readable, well-formatted, production-friendly code in the chosen language

Interview data:
${interviewContext}

Chosen language:
${requestedLanguage}

Rules:
- Return valid JSON only (no markdown, no extra text)
- Keep output practical and implementation-ready
- Keep implementationNotes focused on important decisions and trade-offs
- The generatedCode must be directly usable as a starting point
- Language mapping is strict:
  - ABAP => generate ABAP code and ABAP conventions
  - SQL => generate SQL statements
  - Python => generate Python code
  - JavaScript => generate JavaScript code
  - TypeScript => generate TypeScript code
`;

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You create structured software implementation outputs in JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
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

    if (!validateGeneratedOutput(parsed)) {
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

    console.error("[api/generate] OpenAI request failed:", error);

    return NextResponse.json(
      {
        error: isDevelopment ? exactMessage : "Failed to generate AI output",
        details: isDevelopment ? exactMessage : undefined,
      },
      { status: 502 },
    );
  }
}
