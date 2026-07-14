import fs from 'fs';
import { SYSTEM_PROMPT } from './constants.js';
import { getHistory, addMessage } from './conversationStore.js';

const config = JSON.parse(fs.readFileSync(new URL('../../config.json', import.meta.url)));

const MODEL_NAME = 'gemini-3.1-flash-lite';
const MAX_RETRIES = 2;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryDelayMs(errorText, fallbackMs) {
	try {
		const parsed = JSON.parse(errorText);
		const retryInfo = parsed?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
		const delayStr = retryInfo?.retryDelay;
		if (delayStr) {
			const seconds = parseFloat(delayStr.replace('s', ''));
			if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000) + 500;
		}
	} catch {}
	return fallbackMs;
}

async function callGemini(contents) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${config.geminiApiKey}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			contents: contents,
			systemInstruction: {
				parts: [{ text: SYSTEM_PROMPT }]
			},
			generationConfig: {
				maxOutputTokens: 800,
			}
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		const err = new Error(`Gemini API hatası (${response.status}): ${errorText}`);
		err.status = response.status;
		err.rawBody = errorText;
		throw err;
	}

	return response.json();
}

export async function askGemini(userId, question) {
	if (!config.geminiApiKey || config.geminiApiKey.startsWith('BURAYA')) {
		throw new Error('config.json içinde geçerli bir "geminiApiKey" tanımlanmamış.');
	}

	const history = getHistory(userId);
	const contents = history.map(msg => ({
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: msg.content }]
	}));

	contents.push({
		role: 'user',
		parts: [{ text: question }]
	});

	let data;
	let lastError;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			data = await callGemini(contents);
			lastError = null;
			break;
		} catch (error) {
			lastError = error;

			if (error.status !== 429 && error.status !== 503) {
				throw error;
			}

			if (attempt === MAX_RETRIES) {
				break;
			}

			const backoffMs = parseRetryDelayMs(error.rawBody, 1000 * (attempt + 1));
			console.warn(`[askGemini] ${error.status} alındı, ${backoffMs}ms sonra tekrar denenecek (deneme ${attempt + 1}/${MAX_RETRIES})...`);
			await sleep(backoffMs);
		}
	}
//Error kısımı inceleyebilirsiniz hanımlarr
	if (lastError) {
		if (lastError.status === 429) {
			throw new Error(
				`Gemini API kota hatası (429). Bu genellikle API key'in bağlı olduğu Google Cloud projesinde ${MODEL_NAME} için kotanın 0 veya tükenmiş olduğu anlamına gelir. ` +
				`AI Studio (aistudio.google.com/apikey) üzerinden key'in doğru projeye ait olduğunu ve ive Language API'nin etkin olduğunu kontrol edin. Orijinal hata: ${lastError.rawBody}Generat`
			);
		}
		throw lastError;
	}

	const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() 
		|| 'Bir cevap üretemedim, lütfen tekrar dener misin?';

	addMessage(userId, 'user', question);
	addMessage(userId, 'assistant', answer);

	return answer;
}