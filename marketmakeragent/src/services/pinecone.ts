const PINECONE_API_VERSION = '2025-10';

interface PineconeQueryResponse {
	matches?: Array<{
		id?: string;
		score?: number;
		metadata?: Record<string, unknown>;
	}>;
}

export interface PineconeMatch {
	id: string;
	score: number;
	metadata?: Record<string, unknown>;
}

export class PineconeService {
	private readonly indexHost: string;

	constructor(
		private readonly apiKey: string,
		indexHost: string
	) {
		this.indexHost = indexHost.replace(/\/+$/, '');
	}

	async queryByVector(vector: number[], topK: number): Promise<PineconeMatch[]> {
		const response = await fetch(`${this.indexHost}/query`, {
			method: 'POST',
			headers: {
				'Api-Key': this.apiKey,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'X-Pinecone-API-Version': PINECONE_API_VERSION,
			},
			body: JSON.stringify({
				vector,
				topK,
				includeValues: false,
				includeMetadata: true,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Pinecone query failed: ${response.status} ${errorText}`);
		}

		const data = (await response.json()) as PineconeQueryResponse;
		if (!Array.isArray(data.matches)) {
			throw new Error('Pinecone query response missing matches array');
		}

		const matches: PineconeMatch[] = [];
		for (const match of data.matches) {
			if (typeof match.id !== 'string' || typeof match.score !== 'number') {
				continue;
			}
			matches.push({
				id: match.id,
				score: match.score,
				metadata: match.metadata,
			});
		}
		return matches;
	}
}
