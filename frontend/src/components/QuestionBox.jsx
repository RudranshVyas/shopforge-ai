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
    <div className="paper-card reveal p-6">
      <p className="field-label mb-1.5">File a query</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-end gap-3"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this product…"
          className="dossier-input"
        />
        <button type="submit" disabled={loading} className="btn-stamp">
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={loading}
            className="tag-btn"
            style={{ transform: `rotate(${[-1, 0.6, -0.4, 1][i % 4]}deg)` }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
