import { useState } from "react";

const SUGGESTIONS = [
  "Summarize customer sentiment",
  "Is the battery good?",
  "Most common complaints?",
  "Show reviews mentioning overheating",
];

export default function QuestionBox({ onAsk, loading }) {
  const [question, setQuestion] = useState("");

  function ask(text) {
    if (!text.trim() || loading) return;
    setQuestion(text);
    onAsk(text);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this product…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={loading}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
