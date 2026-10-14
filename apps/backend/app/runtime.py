"""Generic LangGraph runtime for Universal Business Core.

This is the KEEP contract: LangGraph as a mechanism, not the old agro graph.
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class CoreState(TypedDict):
	message: str
	output: str


def _reply(state: CoreState) -> CoreState:
	return {"message": state["message"], "output": f"core:{state['message']}"}


def build_core_graph():
	graph = StateGraph(CoreState)
	graph.add_node("reply", _reply)
	graph.add_edge(START, "reply")
	graph.add_edge("reply", END)
	return graph.compile()


_GRAPH = build_core_graph()


def invoke_core(message: str) -> str:
	result = _GRAPH.invoke({"message": message, "output": ""})
	return str(result.get("output", ""))
