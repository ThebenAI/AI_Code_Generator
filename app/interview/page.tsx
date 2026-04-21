"use client";

import { useState } from "react";

const questions = [
  {
    id: "goal",
    question: "What is the purpose and goal of the code?",
    placeholder: "Describe the main problem this code should solve.",
    exampleAnswer:
      "Create a code that can be used for an algorithm to derive certain information from a database.",
  },
  {
    id: "context",
    question: "What background information or business context is relevant?",
    placeholder: "Share important business context and user roles.",
    exampleAnswer:
      "Business logic is needed to link several tables for a certain purpose.",
  },
  {
    id: "inputs",
    question: "What inputs are available for the code?",
    placeholder: "List the request fields, files, parameters, or inputs.",
    exampleAnswer:
      "Input parameters are (...) and are needed to derive certain information from a database.",
  },
  {
    id: "output",
    question: "What output is expected?",
    placeholder: "Explain the expected response format and fields.",
    exampleAnswer:
      "Return generated code in the chosen language and derive field information matching to the input parameters and the business context.",
  },
  {
    id: "features",
    question: "Please describe the required functionality and features in detail.",
    placeholder: "List key features and required behavior in plain language.",
    exampleAnswer:
      "Support initial code generation, iterative improvement from feedback, version history, and copy-to-clipboard for each version.",
  },
  {
    id: "data-sources",
    question: "Which tables, fields, APIs, or data sources are involved?",
    placeholder: "Name all important tables, fields, and external systems.",
    exampleAnswer:
      "Use OpenAI API for generation, plus optional schema metadata like orders(order_id, customer_id, total_amount, created_at).",
  },
  {
    id: "rules",
    question: "What core business rules or validations must be enforced?",
    placeholder: "Describe hard rules that the code must always follow.",
    exampleAnswer:
      "Always return valid JSON matching the schema, keep code in the selected language, and reject requests with missing required inputs.",
  },
  {
    id: "storage",
    question: "What storage or database operations are required?",
    placeholder: "Explain reads, writes, updates, deletes, and transaction needs.",
    exampleAnswer:
      "No persistent database writes are required initially; keep version history in frontend state during the current session.",
  },
  {
    id: "quality",
    question:
      "What quality expectations should the code meet (e.g. performance, readability, maintainability, documentation)?",
    placeholder: "Set expectations for code quality and performance.",
    exampleAnswer:
      "Keep modules small and readable, include clear error handling, avoid unnecessary complexity, and optimize for maintainable code paths.",
  },
  {
    id: "constraints",
    question:
      "Are there any technical constraints, naming conventions, standards, or language-specific requirements?",
    placeholder: "List conventions, style guides, and technical constraints.",
    exampleAnswer:
      "Use TypeScript strict mode, camelCase naming, Next.js route handlers, and OpenAI JSON schema response format for stable parsing.",
  },
];

const languageOptions = ["ABAP", "SQL", "Python", "JavaScript", "TypeScript"] as const;

type GeneratedOutput = {
  solutionSummary: string;
  language: string;
  implementationNotes: string[];
  generatedCode: string;
};

type ImprovedOutput = {
  versionNumber: number;
  summaryOfChanges: string;
  improvedCode: string;
};

type CodeVersion = {
  versionNumber: number;
  code: string;
  feedback: string;
  summaryOfChanges: string;
};

type DataSourceSuggestion = {
  matches: string[];
  importantFields: string[];
  reasoning: string;
  validationNotes: string;
};

function isGeneratedOutput(value: unknown): value is GeneratedOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.solutionSummary === "string" &&
    typeof candidate.language === "string" &&
    Array.isArray(candidate.implementationNotes) &&
    candidate.implementationNotes.every((item) => typeof item === "string") &&
    typeof candidate.generatedCode === "string"
  );
}

function isImprovedOutput(value: unknown): value is ImprovedOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.versionNumber === "number" &&
    typeof candidate.summaryOfChanges === "string" &&
    typeof candidate.improvedCode === "string"
  );
}

function isDataSourceSuggestion(value: unknown): value is DataSourceSuggestion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.matches) &&
    candidate.matches.every((item) => typeof item === "string") &&
    Array.isArray(candidate.importantFields) &&
    candidate.importantFields.every((item) => typeof item === "string") &&
    typeof candidate.reasoning === "string" &&
    typeof candidate.validationNotes === "string"
  );
}

export default function InterviewPage() {
  const [selectedLanguage, setSelectedLanguage] =
    useState<(typeof languageOptions)[number]>("TypeScript");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string>("");
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedOutput | null>(
    null,
  );
  const [codeVersions, setCodeVersions] = useState<CodeVersion[]>([]);
  const [improvementFeedback, setImprovementFeedback] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [improveStatus, setImproveStatus] = useState("");
  const [isOptimizationFinished, setIsOptimizationFinished] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isImprovedCodeCopied, setIsImprovedCodeCopied] = useState(false);
  const [showDataSourceHelper, setShowDataSourceHelper] = useState(false);
  const [dataSourceDescription, setDataSourceDescription] = useState("");
  const [isSuggestingDataSources, setIsSuggestingDataSources] = useState(false);
  const [dataSourceStatus, setDataSourceStatus] = useState("");
  const [dataSourceSuggestion, setDataSourceSuggestion] =
    useState<DataSourceSuggestion | null>(null);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === questions.length - 1;
  const isSummaryStep = stepIndex >= questions.length;
  const isDataSourceQuestion = !isSummaryStep && questions[stepIndex].id === "data-sources";

  const handleChangeAnswer = (value: string) => {
    setAnswers((prevAnswers) =>
      prevAnswers.map((answer, index) =>
        index === stepIndex ? value : answer,
      ),
    );
  };

  const goBack = () => {
    if (isSummaryStep) {
      setStepIndex(questions.length - 1);
      return;
    }

    if (!isFirstStep) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const goNext = () => {
    if (isLastStep) {
      setStepIndex(questions.length);
      return;
    }

    setStepIndex((prev) => prev + 1);
  };

  const generateAiOutput = async () => {
    setIsGenerating(true);
    setGenerateStatus("");
    setIsCodeCopied(false);
    setIsImprovedCodeCopied(false);
    setImprovementFeedback("");
    setImproveStatus("");
    setCodeVersions([]);
    setIsOptimizationFinished(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questions: questions.map((item) => item.question),
          answers,
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;

        throw new Error(
          errorBody?.details || errorBody?.error || "Failed to generate AI output.",
        );
      }

      const data = (await response.json()) as unknown;

      if (!isGeneratedOutput(data)) {
        throw new Error("No structured result returned from API.");
      }

      setGeneratedOutput(data);
      setCodeVersions([
        {
          versionNumber: 1,
          code: data.generatedCode,
          feedback: "Initial generation from interview answers.",
          summaryOfChanges: data.solutionSummary,
        },
      ]);
      setGenerateStatus("AI output generated.");
    } catch (error) {
      setGeneratedOutput(null);
      setCodeVersions([]);
      setGenerateStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong while sending answers.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPrompt = async () => {
    const latestVersion = codeVersions[codeVersions.length - 1];

    if (!latestVersion?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestVersion.code);
      setIsCodeCopied(true);
    } catch {
      setGenerateStatus("Could not copy code. Please copy it manually.");
    }
  };

  const improveCode = async () => {
    const latestVersion = codeVersions[codeVersions.length - 1];

    if (!latestVersion?.code) {
      setImproveStatus("Generate code first before requesting improvements.");
      return;
    }

    if (!improvementFeedback.trim()) {
      setImproveStatus("Please enter improvement feedback first.");
      return;
    }

    setIsImproving(true);
    setImproveStatus("");
    setIsOptimizationFinished(false);
    setIsCodeCopied(false);
    setIsImprovedCodeCopied(false);

    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers,
          language: selectedLanguage,
          currentCode: latestVersion.code,
          feedback: improvementFeedback,
          versionNumber: latestVersion.versionNumber,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;

        throw new Error(
          errorBody?.details || errorBody?.error || "Failed to improve code.",
        );
      }

      const data = (await response.json()) as unknown;

      if (!isImprovedOutput(data)) {
        throw new Error("No structured improvement result returned from API.");
      }

      setCodeVersions((prevVersions) => [
        ...prevVersions,
        {
          versionNumber: data.versionNumber,
          code: data.improvedCode,
          feedback: improvementFeedback.trim(),
          summaryOfChanges: data.summaryOfChanges,
        },
      ]);
      setImprovementFeedback("");
      setImproveStatus("Improved code generated.");
    } catch (error) {
      setImproveStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong while improving code.",
      );
    } finally {
      setIsImproving(false);
    }
  };

  const copyImprovedCode = async () => {
    const latestVersion = codeVersions[codeVersions.length - 1];

    if (!latestVersion?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestVersion.code);
      setIsImprovedCodeCopied(true);
    } catch {
      setImproveStatus("Could not copy improved code. Please copy it manually.");
    }
  };

  const finishOptimization = () => {
    if (!codeVersions.length) {
      return;
    }

    setIsOptimizationFinished(true);
    setImproveStatus("Great - code optimization is complete.");
  };

  const suggestDataSources = async () => {
    if (!dataSourceDescription.trim()) {
      setDataSourceStatus("Please describe the business objects or data first.");
      return;
    }

    setIsSuggestingDataSources(true);
    setDataSourceStatus("");

    try {
      const response = await fetch("/api/suggest-data-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessDescription: dataSourceDescription }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;

        throw new Error(
          errorBody?.details ||
            errorBody?.error ||
            "Failed to suggest tables and fields.",
        );
      }

      const data = (await response.json()) as unknown;

      if (!isDataSourceSuggestion(data)) {
        throw new Error("No structured suggestions returned from API.");
      }

      setDataSourceSuggestion(data);
      setDataSourceStatus("Suggestions generated.");
    } catch (error) {
      setDataSourceSuggestion(null);
      setDataSourceStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong while suggesting data sources.",
      );
    } finally {
      setIsSuggestingDataSources(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-14 text-slate-100">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
        {isSummaryStep ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Interview Summary
            </h1>
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm font-semibold text-slate-300">
                Chosen Language
              </p>
              <p className="mt-1 text-slate-100">{selectedLanguage}</p>
            </div>
            <div className="mt-6 space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                >
                  <p className="text-sm font-semibold text-slate-300">
                    Question {index + 1}
                  </p>
                  <p className="mt-1 font-medium">{question.question}</p>
                  <p className="mt-2 whitespace-pre-wrap text-slate-300">
                    {answers[index].trim() || "No answer provided."}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={generateAiOutput}
                disabled={isGenerating}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : "Generate AI Output"}
              </button>
            </div>
            {generateStatus ? (
              <p className="mt-3 text-sm text-slate-300">{generateStatus}</p>
            ) : null}
            {generatedOutput ? (
              <div className="mt-8 space-y-4 border-t border-slate-700 pt-8">
                {codeVersions.length ? (
                  <div className="rounded-xl border border-blue-700/60 bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-blue-300">
                        Latest Version (v{codeVersions[codeVersions.length - 1].versionNumber})
                      </h2>
                      <button
                        type="button"
                        onClick={copyPrompt}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                      >
                        {isCodeCopied ? "Copied" : "Copy Latest Code"}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {codeVersions[codeVersions.length - 1].summaryOfChanges}
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">
                      {codeVersions[codeVersions.length - 1].code}
                    </pre>
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <h2 className="text-sm font-semibold text-blue-300">
                    Solution Summary
                  </h2>
                  <p className="mt-2 text-slate-200">
                    {generatedOutput.solutionSummary}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <h2 className="text-sm font-semibold text-blue-300">
                    Chosen Language
                  </h2>
                  <p className="mt-2 text-slate-200">
                    {generatedOutput.language}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <h2 className="text-sm font-semibold text-blue-300">
                    Implementation Notes
                  </h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                    {generatedOutput.implementationNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-blue-300">
                      Generated Code
                    </h2>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                    >
                      {isCodeCopied ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">
                    {codeVersions.length
                      ? codeVersions[codeVersions.length - 1].code
                      : generatedOutput.generatedCode}
                  </pre>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <h2 className="text-sm font-semibold text-blue-300">
                    Improve the generated code
                  </h2>
                  <textarea
                    value={improvementFeedback}
                    onChange={(event) => setImprovementFeedback(event.target.value)}
                    placeholder="Describe what you want improved (performance, readability, edge cases, etc.)"
                    rows={4}
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={improveCode}
                      disabled={isImproving || isOptimizationFinished}
                      className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isImproving ? "Improving..." : "Improve Code"}
                    </button>
                    <button
                      type="button"
                      onClick={finishOptimization}
                      disabled={!codeVersions.length || isOptimizationFinished}
                      className="rounded-xl border border-green-500 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Code is correct
                    </button>
                  </div>
                  {improveStatus ? (
                    <p className="mt-3 text-sm text-slate-300">{improveStatus}</p>
                  ) : null}
                </div>

                {codeVersions.length > 1 ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <h2 className="text-sm font-semibold text-blue-300">Version History</h2>
                    <div className="mt-3 space-y-3">
                      {codeVersions
                        .slice(0, -1)
                        .reverse()
                        .map((version) => (
                          <div
                            key={version.versionNumber}
                            className="rounded-lg border border-slate-700 bg-slate-950/40 p-3"
                          >
                            <p className="text-sm font-semibold text-slate-200">
                              v{version.versionNumber}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              <span className="font-semibold">Feedback:</span>{" "}
                              {version.feedback}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              <span className="font-semibold">Changes:</span>{" "}
                              {version.summaryOfChanges}
                            </p>
                          </div>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-blue-300">
                        Latest Improved Code
                      </h3>
                      <button
                        type="button"
                        onClick={copyImprovedCode}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                      >
                        {isImprovedCodeCopied ? "Copied" : "Copy Improved Code"}
                      </button>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">
                      {codeVersions[codeVersions.length - 1].code}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-blue-300">
              Question {stepIndex + 1} of {questions.length}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              {questions[stepIndex].question}
            </h1>
            <p className="mt-3 rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
              Example answer: {questions[stepIndex].exampleAnswer}
            </p>
            <div className="mt-5">
              <label
                htmlFor="language-select"
                className="mb-2 block text-sm font-semibold text-slate-300"
              >
                Programming Language
              </label>
              <select
                id="language-select"
                value={selectedLanguage}
                onChange={(event) =>
                  setSelectedLanguage(
                    event.target.value as (typeof languageOptions)[number],
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {languageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={answers[stepIndex]}
              onChange={(event) => handleChangeAnswer(event.target.value)}
              placeholder={questions[stepIndex].placeholder}
              rows={6}
              className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {isDataSourceQuestion ? (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                <button
                  type="button"
                  onClick={() => setShowDataSourceHelper((prev) => !prev)}
                  className="text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                >
                  Need help identifying tables and fields?
                </button>

                {showDataSourceHelper ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-300">
                      Describe the business objects or data you need, and the app
                      will propose possible tables and fields as a starting point.
                    </p>
                    <textarea
                      value={dataSourceDescription}
                      onChange={(event) =>
                        setDataSourceDescription(event.target.value)
                      }
                      placeholder="Example: I need customer profile data, order totals, order status, and payment dates for monthly reporting."
                      rows={4}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={suggestDataSources}
                      disabled={isSuggestingDataSources}
                      className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSuggestingDataSources
                        ? "Suggesting..."
                        : "Suggest tables and fields"}
                    </button>
                    {dataSourceStatus ? (
                      <p className="text-sm text-slate-300">{dataSourceStatus}</p>
                    ) : null}
                    {dataSourceSuggestion ? (
                      <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                          Proposed suggestions - please validate with your schema
                        </p>
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-blue-300">
                            Suggested Matches
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-200">
                            {dataSourceSuggestion.matches.map((match) => (
                              <li key={match}>{match}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-blue-300">
                            Important Fields
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-200">
                            {dataSourceSuggestion.importantFields.map((field) => (
                              <li key={field}>{field}</li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          <span className="font-semibold">Reasoning:</span>{" "}
                          {dataSourceSuggestion.reasoning}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          <span className="font-semibold">Validation notes:</span>{" "}
                          {dataSourceSuggestion.validationNotes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={isFirstStep}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                {isLastStep ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
