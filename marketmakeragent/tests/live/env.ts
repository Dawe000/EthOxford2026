import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LiveTestEnv {
	VENICE_API_KEY: string;
	PINECONE_API_KEY: string;
	PINECONE_INDEX_HOST: string;
	LIVE_TEST_QUERY: string;
}

interface ResolveOptions {
	env?: Record<string, string | undefined>;
	includeRootEnvFile?: boolean;
}

function parseEnvFile(content: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}
		const separatorIndex = line.indexOf('=');
		if (separatorIndex <= 0) {
			continue;
		}
		const key = line.slice(0, separatorIndex).trim();
		const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
		parsed[key] = value;
	}
	return parsed;
}

function loadRootDotEnv(): Record<string, string> {
	const currentFile = fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFile);
	const repoRoot = path.resolve(currentDir, '../../../');
	const envPath = path.join(repoRoot, '.env');
	if (!fs.existsSync(envPath)) {
		return {};
	}
	return parseEnvFile(fs.readFileSync(envPath, 'utf8'));
}

function readValue(
	key: keyof LiveTestEnv,
	envSource: Record<string, string | undefined>,
	fileSource: Record<string, string>
): string {
	const fromProcess = (envSource[key] || '').trim();
	if (fromProcess) {
		return fromProcess;
	}
	const fromFile = (fileSource[key] || '').trim();
	return fromFile;
}

export function resolveLiveTestEnv(options: ResolveOptions = {}): LiveTestEnv {
	const envSource = options.env ?? process.env;
	const includeRootEnvFile = options.includeRootEnvFile ?? true;
	const fileSource = includeRootEnvFile ? loadRootDotEnv() : {};
	const missing: string[] = [];

	const VENICE_API_KEY = readValue('VENICE_API_KEY', envSource, fileSource);
	if (!VENICE_API_KEY) {
		missing.push('VENICE_API_KEY');
	}

	const PINECONE_API_KEY = readValue('PINECONE_API_KEY', envSource, fileSource);
	if (!PINECONE_API_KEY) {
		missing.push('PINECONE_API_KEY');
	}

	const PINECONE_INDEX_HOST = readValue('PINECONE_INDEX_HOST', envSource, fileSource);
	if (!PINECONE_INDEX_HOST) {
		missing.push('PINECONE_INDEX_HOST');
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required live test environment variables: ${missing.join(', ')}. ` +
				'Set them in process env or repo-root .env.'
		);
	}

	const LIVE_TEST_QUERY =
		readValue('LIVE_TEST_QUERY', envSource, fileSource) ||
		'Find the best agent for summarizing Ethereum market sentiment.';

	return {
		VENICE_API_KEY,
		PINECONE_API_KEY,
		PINECONE_INDEX_HOST,
		LIVE_TEST_QUERY,
	};
}
