/**
 * groqClient.js
 * Low-level Groq API wrapper.
 * Never call this directly — use aiService.js instead.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODELS = {
    VISION: "meta-llama/llama-4-scout-17b-16e-instruct",
    TEXT:   "llama-3.3-70b-versatile",
};

const DEFAULT_OPTIONS = {
    temperature: 0.3,
    max_tokens:  8192,   // raised default; callers can still override downward
    top_p:       0.9,
};

/**
 * Core request function.
 */
export async function groqRequest({ model, messages, options = {}, apiKey }) {
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error("messages array is required and must not be empty");
    }

    const payload = {
        model,
        messages,
        temperature: options.temperature ?? DEFAULT_OPTIONS.temperature,
        max_tokens:  options.max_tokens  ?? DEFAULT_OPTIONS.max_tokens,
        top_p:       options.top_p       ?? DEFAULT_OPTIONS.top_p,
        stream:      false,
    };

    const response = await fetch(GROQ_API_URL, {
        method:  "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${apiKey}`,
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

    const data    = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("Groq returned empty or invalid content");
    }

    // Warn (don't throw) if the model hit the token limit — partial JSON
    const finishReason = data?.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
        console.warn("[groqClient] finish_reason=length — response was truncated. Consider raising max_tokens.");
    }

    return content.trim();
}

/**
 * Parses JSON from model response.
 *
 * Strategy (most-to-least strict):
 *  1. Strip markdown fences, try direct parse
 *  2. Find the outermost [...] or {...} and parse that
 *  3. Find the LAST complete JSON array/object (handles trailing garbage)
 */
export function parseJSONResponse(rawContent) {
    if (typeof rawContent !== "string") throw new Error("rawContent must be a string");

    // Step 1 — strip markdown fences
    const stripped = rawContent
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/m, "")
        .trim();

    // Step 2 — direct parse
    try {
        return JSON.parse(stripped);
    } catch { /* continue */ }

    // Step 3 — extract outermost array first (recipes always return an array)
    const arrayMatch = findOutermostBracket(stripped, "[", "]");
    if (arrayMatch) {
        try { return JSON.parse(arrayMatch); } catch { /* continue */ }
    }

    // Step 4 — extract outermost object
    const objectMatch = findOutermostBracket(stripped, "{", "}");
    if (objectMatch) {
        try { return JSON.parse(objectMatch); } catch { /* continue */ }
    }

    // Step 5 — try to find and parse the LAST valid JSON array in the string
    //          (handles "Here are your recipes:\n[...]" preamble text)
    const lastArrayIdx = stripped.lastIndexOf("[");
    if (lastArrayIdx !== -1) {
        const candidate = stripped.slice(lastArrayIdx);
        try { return JSON.parse(candidate); } catch { /* continue */ }

        // If still failing, the JSON was truncated — try to close it gracefully
        const repaired = attemptRepair(candidate);
        if (repaired) {
            try { return JSON.parse(repaired); } catch { /* continue */ }
        }
    }

    throw new Error("Failed to parse JSON from model response");
}

/**
 * Finds the substring that starts at the first occurrence of `open`
 * and ends at the matching closing bracket.
 */
function findOutermostBracket(str, open, close) {
    const start = str.indexOf(open);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape   = false;

    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape)          { escape = false; continue; }
        if (ch === "\\")     { escape = true;  continue; }
        if (ch === '"')      { inString = !inString; continue; }
        if (inString)        continue;
        if (ch === open)     depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0) return str.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Very simple repair: if JSON is truncated mid-array, try to close it.
 * Only handles the common case of truncation inside a recipe object.
 */
function attemptRepair(truncated) {
    // Count unclosed braces / brackets
    let braces   = 0;
    let brackets = 0;
    let inString = false;
    let escape   = false;

    for (const ch of truncated) {
        if (escape)        { escape = false; continue; }
        if (ch === "\\")   { escape = true;  continue; }
        if (ch === '"')    { inString = !inString; continue; }
        if (inString)      continue;
        if (ch === "{")    braces++;
        else if (ch === "}") braces--;
        else if (ch === "[") brackets++;
        else if (ch === "]") brackets--;
    }

    if (braces < 0 || brackets < 0) return null; // already over-closed

    // Strip trailing incomplete field (last comma or partial key/value)
    let repaired = truncated.trimEnd();
    // Remove trailing comma before we close
    repaired = repaired.replace(/,\s*$/, "");

    // Close any open braces then brackets
    repaired += "}".repeat(braces) + "]".repeat(brackets);
    return repaired;
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

            if (error instanceof GroqAPIError) {
                if ([401, 400, 422].includes(error.status)) throw error;
            }

            if (attempt < maxRetries) {
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                );
            }
        }
    }

    throw lastError;
}

export class GroqAPIError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name   = "GroqAPIError";
        this.status = status;
        this.body   = body;
    }
}

export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}