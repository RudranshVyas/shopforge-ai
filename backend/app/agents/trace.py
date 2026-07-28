"""Decorator that turns each agent into a traced LangGraph node.

An agent returns its state updates plus a `_trace` dict; this wrapper times the
call, pops `_trace`, and appends one entry to `agent_trace`.
"""

import time
from collections.abc import Callable
from functools import wraps

from app.agents.state import WorkflowState


def timed(agent_name: str) -> Callable:
    def decorator(fn: Callable[[WorkflowState], WorkflowState]) -> Callable:
        @wraps(fn)
        def wrapper(state: WorkflowState) -> WorkflowState:
            started = time.perf_counter()
            update = dict(fn(state))
            trace = update.pop("_trace", {})
            update["agent_trace"] = [
                *state.get("agent_trace", []),
                {
                    "agent": agent_name,
                    "summary": trace.get("summary", ""),
                    "details": trace.get("details", {}),
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            ]
            return update

        return wrapper

    return decorator
