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
    <div className="card p-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-center gap-2.5"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this product…"
          className="field"
        />
        <button type="submit" disabled={loading} className="btn">
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={loading} className="chip">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
