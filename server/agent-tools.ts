import { executeFurrowAgentTool, FURROW_AGENT_TOOLS } from '../verticals/agriculture/ai/furrow-agent-tools.js';
import type { AgentActionRecord, AgentToolContext } from './agent-types.js';

export class ToolsAgent {
	public getToolsConfig() {
		return FURROW_AGENT_TOOLS;
	}

	public async executeTool(
		name: string,
		argsJson: string,
		ctx: AgentToolContext
	): Promise<{ result: string; action: AgentActionRecord }> {
		// Delegation to existing tool implementations
		return executeFurrowAgentTool(name, argsJson, ctx);
	}
}
