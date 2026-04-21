import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center shadow-2xl shadow-slate-950/40 backdrop-blur">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          AI Prompt Builder
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
          Turn your idea into a structured AI-ready specification
        </p>
        <Link
          href="/interview"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          Start Interview
        </Link>
      </section>
    </main>
  );
}
