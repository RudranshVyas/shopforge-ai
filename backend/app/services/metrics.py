"""In-memory counters. Deliberately not persisted -- no store, no token accounting."""

from collections import deque
from threading import Lock


class Metrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self.total_queries = 0
        self.llm_calls = 0
        self.fallbacks = 0
        self.citation_pass = 0
        self.citation_drop = 0
        self.latencies: deque[float] = deque(maxlen=100)

    def record_query(self, latency_ms: float, llm_called: bool, fallback_used: bool) -> None:
        with self._lock:
            self.total_queries += 1
            self.llm_calls += int(llm_called)
            self.fallbacks += int(fallback_used)
            self.latencies.append(latency_ms)

    def record_citations(self, passed: int, dropped: int) -> None:
        with self._lock:
            self.citation_pass += passed
            self.citation_drop += dropped

    def snapshot(self) -> dict:
        with self._lock:
            total = self.total_queries or 1
            citations = (self.citation_pass + self.citation_drop) or 1
            return {
                "total_queries": self.total_queries,
                "llm_calls": self.llm_calls,
                "fallbacks": self.fallbacks,
                "citation_pass": self.citation_pass,
                "citation_drop": self.citation_drop,
                "avg_latency_ms": (
                    round(sum(self.latencies) / len(self.latencies), 1) if self.latencies else 0.0
                ),
                "llm_call_rate": round(self.llm_calls / total, 3),
                "fallback_rate": round(self.fallbacks / total, 3),
                "citation_pass_rate": round(self.citation_pass / citations, 3),
            }

    def reset(self) -> None:
        with self._lock:
            self.__init__()


metrics = Metrics()
