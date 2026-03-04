import { loadConfig } from '../../core/config.js';
import { getOpenaiKey } from '../../keychain/api-keys.js';
import type { OperationInputById } from '../../protocol/v3/operations.js';

export async function executeAudioTranscribe(
    input: OperationInputById['audio.transcribe']
): Promise<{ text: string; provider: string }> {
    const config = await loadConfig();

    // Decide which provider to use. Fallback to LMX.
    const providerName = input.provider || 'lmx';

    if (providerName !== 'lmx' && providerName !== 'openai') {
        throw new Error(`Provider ${providerName} is not configured or available.`);
    }

    // Convert base64 audio to Blob/File to send
    const audioBuffer = Buffer.from(input.audioBase64, 'base64');
    const blob = new Blob([audioBuffer], { type: `audio/${input.audioFormat || 'webm'}` });

    // Let's use standard fetch to the provider's /v1/audio/transcriptions endpoint
    // getProvider returns a class with apiBase, apiKey, etc.
    // For LMX: http://host:port/v1/audio/transcriptions

    if (providerName === 'lmx') {
        const lmxUrl = `http://${config.connection.host || 'localhost'}:${config.connection.port || 1234}/v1/audio/transcriptions`;
        const formData = new FormData();
        formData.append('file', blob, `audio.${input.audioFormat || 'webm'}`);
        formData.append('model', 'mlx-community/whisper-base');
        if (input.language) {
            formData.append('language', input.language);
        }

        const res = await fetch(lmxUrl, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`LMX Transcription failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as { text: string };
        return { text: data.text, provider: 'lmx' };
    }

    if (providerName === 'openai') {
        const key = await getOpenaiKey();
        if (!key) {
            throw new Error('OpenAI API key is missing or not configured in keychain.');
        }
        const openaiUrl = 'https://api.openai.com/v1/audio/transcriptions';
        const formData = new FormData();
        formData.append('file', blob, `audio.${input.audioFormat || 'webm'}`);
        formData.append('model', 'whisper-1');
        if (input.language) {
            formData.append('language', input.language);
        }

        const res = await fetch(openaiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
            }, body: formData,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI Transcription failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as { text: string };
        return { text: data.text, provider: 'openai' };
    }

    throw new Error(`Provider ${providerName} does not support transcription yet.`);
}

export async function executeAudioTTS(
    input: OperationInputById['audio.tts']
): Promise<{ audioBase64: string; provider: string; format: string }> {
    const config = await loadConfig();
    const providerName = input.provider || 'lmx';

    if (providerName !== 'lmx' && providerName !== 'openai') {
        throw new Error(`Provider ${providerName} does not support TTS yet.`);
    }

    // const provider = getProvider(providerName, config); // Removed as per instructions

    // if (!provider) { // Removed as per instructions
    //     throw new Error(`Provider ${providerName} is not configured or available.`); // Removed as per instructions
    // } // Removed as per instructions

    if (providerName === 'lmx') {
        const lmxUrl = `http://${config.connection.host || 'localhost'}:${config.connection.port || 1234}/v1/audio/speech`;

        const res = await fetch(lmxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mlx-audio/kokoro-82m',
                input: input.text,
                voice: input.voice || 'af_heart',
                response_format: 'wav'
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`LMX TTS failed (${res.status}): ${text}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { audioBase64: base64, provider: 'lmx', format: 'wav' };
    }

    if (providerName === 'openai') {
        const key = await getOpenaiKey();
        if (!key) {
            throw new Error('OpenAI API key is missing or not configured in keychain.');
        }
        const openaiUrl = 'https://api.openai.com/v1/audio/speech';

        const res = await fetch(openaiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            }, body: JSON.stringify({
                model: 'tts-1',
                input: input.text,
                voice: input.voice || 'alloy',
                response_format: 'mp3'
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI TTS failed (${res.status}): ${text}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { audioBase64: base64, provider: 'openai', format: 'mp3' };
    }

    throw new Error(`Provider ${providerName} does not support TTS yet.`);
}
