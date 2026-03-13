/**
 * groqClient.js
 * Low-level Groq API wrapper.
 * Never call this directly — use aiService.js instead.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Models used across the app
export const GROQ_MODELS = {
    // Vision model for photo analysis (ingredients & step verification)
    VISION: "meta-llama/llama-4-scout-17b-16e-instruct",
    // Text model for recipe generation
    TEXT: "llama-3.3-70b-versatile",
};

const DEFAULT_OPTIONS = {
    temperature: 0.3,       // lower = more predictable, structured output
    max_tokens: 2048,
    top_p: 0.9,
};

/**
 * Core request function.
 * @param {Object} params
 * @param {string} params.model
 * @param {Array}  params.messages   - Already-built message array (system + user)
 * @param {Object} params.options    - Override temperature, max_tokens etc.
 * @param {string} params.apiKey     - Groq API key
 * @returns {Promise<string>}        - Raw text content from the model
 */
export async function groqRequest({ model, messages, options = {}, apiKey }) {
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is not configured");
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error("messages array is required and must not be empty");
    }

    const payload = {
        model,
        messages,
        temperature: options.temperature ?? DEFAULT_OPTIONS.temperature,
        max_tokens: options.max_tokens ?? DEFAULT_OPTIONS.max_tokens,
        top_p: options.top_p ?? DEFAULT_OPTIONS.top_p,
        // Never stream — we need the full response to validate it
        stream: false,
    };

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown error");
        throw new GroqAPIError(
            `Groq API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody
        );
    }

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("Groq returned empty or invalid content");
    }

    return content.trim();
}

/**
 * Parses JSON from model response.
 * Models sometimes wrap JSON in markdown code blocks — we strip those.
 */
export function parseJSONResponse(rawContent) {
    // Strip ```json ... ``` or ``` ... ```
    const stripped = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

    try {
        return JSON.parse(stripped);
    } catch {
        // Try to extract JSON object/array from surrounding text
        const jsonMatch = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch {
                throw new Error("Failed to parse JSON from model response");
            }
        }
        throw new Error("No valid JSON found in model response");
    }
}

/**
 * Retries a groqRequest up to maxRetries times on transient errors.
 */
export async function groqRequestWithRetry(params, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await groqRequest(params);
        } catch (error) {
            lastError = error;

            // Don't retry on auth errors or invalid requests
            if (error instanceof GroqAPIError) {
                if (error.status === 401 || error.status === 400 || error.status === 422) {
                    throw error;
                }
            }

            // Exponential backoff: 1s, 2s, 4s
            if (attempt < maxRetries) {
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                );
            }
        }
    }

    throw lastError;
}

/**
 * Custom error class for Groq API errors.
 */
export class GroqAPIError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name = "GroqAPIError";
        this.status = status;
        this.body = body;
    }
}

/**
 * Converts a File/Blob to base64 data URL for vision requests.
 */
export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}