import assert from 'node:assert/strict';
import test from 'node:test';
import { VeniceService } from '../../src/services/venice';
import { PineconeService } from '../../src/services/pinecone';
import { resolveLiveTestEnv } from './env';

let cachedEmbedding: number[] | null = null;

async function getLiveEmbedding(): Promise<number[]> {
	if (cachedEmbedding) {
		return cachedEmbedding;
	}
	const env = resolveLiveTestEnv();
	const veniceService = new VeniceService(env.VENICE_API_KEY);
	cachedEmbedding = await veniceService.generateEmbedding(env.LIVE_TEST_QUERY);
	return cachedEmbedding;
}

test('live: env validation', () => {
	assert.throws(
		() => resolveLiveTestEnv({ env: {}, includeRootEnvFile: false }),
		/Missing required live test environment variables:/
	);
});

test('live: Venice embedding smoke', async () => {
	const embedding = await getLiveEmbedding();
	assert.ok(Array.isArray(embedding), 'Embedding must be an array');
	assert.ok(embedding.length > 0, 'Embedding must be non-empty');
	for (const value of embedding.slice(0, 20)) {
		assert.equal(typeof value, 'number', 'Embedding values must be numeric');
		assert.ok(Number.isFinite(value), 'Embedding values must be finite');
	}
});

test('live: Pinecone query smoke', async () => {
	const env = resolveLiveTestEnv();
	const embedding = await getLiveEmbedding();
	const pineconeService = new PineconeService(env.PINECONE_API_KEY, env.PINECONE_INDEX_HOST);
	const matches = await pineconeService.queryByVector(embedding, 5);

	assert.ok(Array.isArray(matches), 'Pinecone matches must be an array');

	if (matches.length === 0) {
		throw new Error(
			"No Pinecone matches found. Run 'npm run sync:agent-vectors' from repo root, then retry."
		);
	}

	for (const match of matches) {
		assert.equal(typeof match.id, 'string', 'Each match id must be a string');
		assert.ok(match.id.length > 0, 'Each match id must be non-empty');
		assert.equal(typeof match.score, 'number', 'Each match score must be a number');
		assert.ok(Number.isFinite(match.score), 'Each match score must be finite');
	}
});
