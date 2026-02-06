import { VeniceEmbeddingRequest, VeniceEmbeddingResponse } from '../types';

const VENICE_API_BASE = 'https://api.venice.ai/api/v1';
const EMBEDDING_MODEL = 'text-embedding-bge-m3';

export class VeniceService {
	constructor(private apiKey: string) {}

	async generateEmbedding(text: string): Promise<number[]> {
		const request: VeniceEmbeddingRequest = {
			model: EMBEDDING_MODEL,
			input: text,
			encoding_format: 'float',
		};

		const response = await fetch(`${VENICE_API_BASE}/embeddings`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			throw new Error(`Venice API error: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as VeniceEmbeddingResponse;

		if (!data.data || data.data.length === 0) {
			throw new Error('No embedding returned from Venice API');
		}

		return data.data[0].embedding;
	}

	async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
		return Promise.all(texts.map((text) => this.generateEmbedding(text)));
	}
}

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error('Vectors must have same dimension');
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
