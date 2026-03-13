/**
 * inputSanitizer.js
 * First line of defense: sanitizes ALL user-provided text before it
 * ever reaches a prompt. User input is NEVER interpreted as instructions.
 */

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|directions?|context)/i,
    /forget\s+(everything|all|what|your)/i,
    /you\s+are\s+now\s+(a|an|the)/i,
    /act\s+as\s+(a|an|the|if)/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /roleplay\s+as/i,
    /new\s+(instructions?|rules?|prompt|task|role|persona)/i,
    /system\s*:/i,
    /\[system\]/i,
    /\[assistant\]/i,
    /\[user\]/i,
    /<\s*system\s*>/i,
    /disregard\s+(your|all|previous)/i,
    /override\s+(your|all|previous|the)/i,
    /bypass\s+(your|all|the|safety)/i,
    /jailbreak/i,
    /do\s+anything\s+now/i,
    /dan\s+mode/i,
    /developer\s+mode/i,
    /give\s+me\s+\d+\s*(points?|балів|бали|балів)/i,
    /add\s+\d+\s*(points?|балів|бали)/i,
    /grant\s+(me|us)\s+\d+/i,
    // Ukrainian-specific injection patterns
    /ігноруй\s+(всі\s+)?(попередні|минулі)\s+(інструкції|правила)/i,
    /забудь\s+(все|всі|про)/i,
    /ти\s+тепер\s+(є|будеш)/i,
    /нові\s+інструкції/i,
    /додай\s+мені\s+\d+\s*(балів|балів)/i,
];

const MAX_TEXT_LENGTH = 500;
const MAX_INGREDIENT_NAME_LENGTH = 50;

/**
 * Checks if string contains prompt injection attempt
 */
export function containsInjection(text) {
    if (typeof text !== "string") return false;
    return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitizes free-form user text (e.g. recipe request comment).
 * Returns { safe: boolean, sanitized: string, reason?: string }
 */
export function sanitizeUserComment(rawText) {
    if (typeof rawText !== "string") {
        return { safe: false, sanitized: "", reason: "invalid_type" };
    }

    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
        return { safe: true, sanitized: "" };
    }

    if (trimmed.length > MAX_TEXT_LENGTH) {
        return {
            safe: false,
            sanitized: "",
            reason: "too_long",
            message: `Коментар не може перевищувати ${MAX_TEXT_LENGTH} символів`,
        };
    }

    if (containsInjection(trimmed)) {
        return {
            safe: false,
            sanitized: "",
            reason: "injection_detected",
            message: "Некоректний запит. Опишіть страву або побажання звичайними словами.",
        };
    }

    // Strip any characters that could break JSON or template strings
    const sanitized = trimmed
        .replace(/[`]/g, "'")          // backticks → single quotes
        .replace(/\$\{[^}]*\}/g, "")  // remove template literals
        .replace(/<!--[\s\S]*?-->/g, "") // remove HTML comments
        .replace(/<[^>]+>/g, "")      // strip HTML tags
        .replace(/\\/g, "\\\\")       // escape backslashes
        .replace(/"/g, '\\"');         // escape double quotes

    return { safe: true, sanitized };
}

/**
 * Sanitizes a list of ingredient names that user selected/deselected.
 * Each ingredient name must be short, no special commands.
 */
export function sanitizeIngredientList(ingredients) {
    if (!Array.isArray(ingredients)) {
        return { safe: false, sanitized: [], reason: "invalid_type" };
    }

    if (ingredients.length > 100) {
        return { safe: false, sanitized: [], reason: "too_many_ingredients" };
    }

    const sanitized = [];

    for (const item of ingredients) {
        if (typeof item !== "string") continue;

        const trimmed = item.trim();

        if (trimmed.length === 0 || trimmed.length > MAX_INGREDIENT_NAME_LENGTH) continue;

        if (containsInjection(trimmed)) continue; // silently drop injected items

        // Only allow letters (any language), numbers, spaces, hyphens, dots
        const cleaned = trimmed.replace(/[^\p{L}\p{N}\s\-.,()]/gu, "").trim();

        if (cleaned.length > 0) {
            sanitized.push(cleaned);
        }
    }

    return { safe: true, sanitized };
}

/**
 * Sanitizes step description for cooking verification.
 * This is system-generated so just validates structure.
 */
export function sanitizeStepDescription(step) {
    if (typeof step !== "string") {
        return { safe: false, sanitized: "", reason: "invalid_type" };
    }

    const trimmed = step.trim().slice(0, 200); // hard cap
    return { safe: true, sanitized: trimmed };
}