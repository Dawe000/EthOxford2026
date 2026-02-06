import { AgentCapabilityCard, RankedAgent, TaskMatchRequest } from '../types';
import { VeniceService, cosineSimilarity } from './venice';
import { AgentRegistry } from './agentRegistry';

export class AgentMatcher {
	constructor(
		private veniceService: VeniceService,
		private agentRegistry: AgentRegistry
	) {}

	async matchAgents(request: TaskMatchRequest): Promise<RankedAgent[]> {
		const queryEmbedding = await this.veniceService.generateEmbedding(request.query);
		const agents = this.agentRegistry.getAll();

		const scoredAgents = await Promise.all(
			agents.map(async (agent) => {
				const agentText = this.agentToText(agent);

				if (!agent.embedding) {
					agent.embedding = await this.veniceService.generateEmbedding(agentText);
				}

				const semanticScore = cosineSimilarity(queryEmbedding, agent.embedding);
				const trustScore = this.calculateTrustScore(agent);
				const combinedScore = semanticScore * 0.5 + trustScore * 0.5;

				return {
					agent,
					score: combinedScore,
					trustScore,
					semanticScore,
				};
			})
		);

		scoredAgents.sort((a, b) => b.score - a.score);

		return scoredAgents.slice(0, 5).map((scored) => ({
			agent: scored.agent,
			score: scored.score,
			trustScore: scored.trustScore,
			reason: this.generateMatchReason(scored.semanticScore, scored.trustScore),
		}));
	}

	private agentToText(agent: AgentCapabilityCard): string {
		const domains = agent.supportedDomains?.join(', ') || '';
		const skillsText = agent.skills?.map((s) => s.name).join(', ') || '';
		return `${agent.name}. ${agent.description} Capabilities: ${domains || skillsText}`;
	}

	private calculateTrustScore(agent: AgentCapabilityCard): number {
		if (!agent.sla) {
			return 0.7;
		}
		const baseScore = 0.7;
		const stakeFactor = Math.min(parseFloat(agent.sla.minAcceptanceStake) / 1e19, 0.2);
		const speedFactor = Math.max(0, 0.1 - agent.sla.avgCompletionTimeSeconds / 36000);

		return Math.min(baseScore + stakeFactor + speedFactor, 1.0);
	}

	private generateMatchReason(semanticScore: number, trustScore: number): string {
		if (semanticScore > 0.8) {
			return 'Excellent capability match with strong trust rating';
		} else if (semanticScore > 0.6) {
			return 'Good capability match';
		} else if (trustScore > 0.8) {
			return 'High trust score with moderate capability match';
		} else {
			return 'Available agent with acceptable ratings';
		}
	}
}
