import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const VENICE_API_BASE = 'https://api.venice.ai/api/v1';
const VENICE_EMBEDDING_MODEL = 'text-embedding-bge-m3';
const PINECONE_API_VERSION = '2025-10';

function parseEnvFile(content) {
	const parsed = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const separator = trimmed.indexOf('=');
		if (separator < 0) {
			continue;
		}
		const key = trimmed.slice(0, separator).trim();
		const rawValue = trimmed.slice(separator + 1).trim();
		parsed[key] = rawValue.replace(/^['"]|['"]$/g, '');
	}
	return parsed;
}

function loadRootEnv(rootDir) {
	const envPath = path.join(rootDir, '.env');
	if (!fs.existsSync(envPath)) {
		return {};
	}
	return parseEnvFile(fs.readFileSync(envPath, 'utf8'));
}

function requireEnvValue(name, fallback) {
	const value = process.env[name] || fallback || '';
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function cardToEmbeddingText(card) {
	const skillNames = Array.isArray(card.skills)
		? card.skills.map((skill) => skill?.name).filter(Boolean).join(', ')
		: '';
	const skillDescriptions = Array.isArray(card.skills)
		? card.skills.map((skill) => skill?.description).filter(Boolean).join(' ')
		: '';
	const skillTags = Array.isArray(card.skills)
		? Array.from(
				new Set(card.skills.flatMap((skill) => (Array.isArray(skill?.tags) ? skill.tags : [])))
		  ).join(', ')
		: '';
	const capabilitySummary = skillTags || skillNames;

	return `${card.name || ''}. ${card.description || ''} Capabilities: ${capabilitySummary}. Skills: ${skillDescriptions}`.trim();
}

async function createEmbedding(text, veniceApiKey) {
	const response = await fetch(`${VENICE_API_BASE}/embeddings`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${veniceApiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: VENICE_EMBEDDING_MODEL,
			input: text,
			encoding_format: 'float',
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Venice embeddings request failed: ${response.status} ${errorText}`);
	}

	const payload = await response.json();
	const vector = payload?.data?.[0]?.embedding;
	if (!Array.isArray(vector)) {
		throw new Error('Venice embeddings response missing vector');
	}
	return vector;
}

async function upsertVectors(indexHost, pineconeApiKey, vectors) {
	const trimmedHost = indexHost.replace(/\/+$/, '');
	const batchSize = 50;

	for (let i = 0; i < vectors.length; i += batchSize) {
		const batch = vectors.slice(i, i + batchSize);
		const response = await fetch(`${trimmedHost}/vectors/upsert`, {
			method: 'POST',
			headers: {
				'Api-Key': pineconeApiKey,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'X-Pinecone-API-Version': PINECONE_API_VERSION,
			},
			body: JSON.stringify({ vectors: batch }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Pinecone upsert failed: ${response.status} ${errorText}`);
		}

		console.log(`Upserted ${batch.length} vectors (${i + batch.length}/${vectors.length})`);
	}
}

async function main() {
	const scriptPath = fileURLToPath(import.meta.url);
	const scriptDir = path.dirname(scriptPath);
	const rootDir = path.resolve(scriptDir, '../..');
	const cardsDir = path.join(rootDir, 'exampleagents', 'agent-cards');
	const envFromRootFile = loadRootEnv(rootDir);

	const veniceApiKey = requireEnvValue('VENICE_API_KEY', envFromRootFile.VENICE_API_KEY);
	const pineconeApiKey = requireEnvValue('PINECONE_API_KEY', envFromRootFile.PINECONE_API_KEY);
	const pineconeIndexHost = requireEnvValue(
		'PINECONE_INDEX_HOST',
		envFromRootFile.PINECONE_INDEX_HOST
	);

	const cardFiles = fs
		.readdirSync(cardsDir)
		.filter((name) => /^agent-\d+\.json$/.test(name))
		.sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

	if (cardFiles.length === 0) {
		throw new Error('No agent card files found in exampleagents/agent-cards');
	}

	console.log(`Building embeddings for ${cardFiles.length} agent cards...`);
	const vectors = [];

	for (const fileName of cardFiles) {
		const filePath = path.join(cardsDir, fileName);
		const raw = fs.readFileSync(filePath, 'utf8');
		const card = JSON.parse(raw);
		const agentId = (fileName.match(/^agent-(\d+)\.json$/) || [])[1];
		if (!agentId) {
			throw new Error(`Unable to extract agent ID from ${fileName}`);
		}

		const embeddingText = cardToEmbeddingText(card);
		const embedding = await createEmbedding(embeddingText, veniceApiKey);
		vectors.push({
			id: agentId,
			values: embedding,
			metadata: {
				agentId,
				name: card.name || `Agent ${agentId}`,
				description: card.description || '',
			},
		});
		console.log(`Embedded agent ${agentId} (${fileName})`);
	}

	await upsertVectors(pineconeIndexHost, pineconeApiKey, vectors);
	console.log(`Pinecone sync complete. Total vectors upserted: ${vectors.length}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
