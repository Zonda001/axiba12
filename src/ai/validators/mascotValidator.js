/**
 * mascotValidator.js
 * Validates mascot generation configuration (input) and image result (output).
 */

import {
    MASCOT_TYPES,
    MASCOT_STYLES,
    MASCOT_PERSONALITIES,
    MASCOT_COLORS,
} from "../prompts/mascotPrompt.js";

// ─── Input validator ──────────────────────────────────────────────────────────

/**
 * Validates and normalizes a mascot generation config before sending to the API.
 *
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[], sanitized: Object|null }}
 */
export function validateMascotConfig(config) {
    const errors = [];

    if (!config || typeof config !== "object") {
        return { valid: false, errors: ["Invalid config — expected object"], sanitized: null };
    }

    // ── type ─────────────────────────────────────────────────────────────────
    const validTypeIds = Object.values(MASCOT_TYPES).map(t => t.id);
    if (!config.type || !validTypeIds.includes(config.type)) {
        errors.push(`type must be one of: ${validTypeIds.join(" | ")}`);
    }

    // ── style ─────────────────────────────────────────────────────────────────
    const validStyleIds = Object.values(MASCOT_STYLES).map(s => s.id);
    if (!config.style || !validStyleIds.includes(config.style)) {
        errors.push(`style must be one of: ${validStyleIds.join(" | ")}`);
    }

    // ── personality ───────────────────────────────────────────────────────────
    const validPersonalityIds = Object.values(MASCOT_PERSONALITIES).map(p => p.id);
    if (!config.personality || !validPersonalityIds.includes(config.personality)) {
        errors.push(`personality must be one of: ${validPersonalityIds.join(" | ")}`);
    }

    // ── color ─────────────────────────────────────────────────────────────────
    const validColorIds = MASCOT_COLORS.map(c => c.id);
    if (!config.color || !validColorIds.includes(config.color)) {
        errors.push(`color must be one of: ${validColorIds.join(" | ")}`);
    }

    // ── subjectName (optional free text) ─────────────────────────────────────
    if (config.subjectName !== undefined && config.subjectName !== null) {
        if (typeof config.subjectName !== "string") {
            errors.push("subjectName must be a string");
        } else if (config.subjectName.length > 100) {
            errors.push("subjectName must be 100 characters or less");
        }
    }

    // ── extraDetails (optional free text) ─────────────────────────────────────
    if (config.extraDetails !== undefined && config.extraDetails !== null) {
        if (typeof config.extraDetails !== "string") {
            errors.push("extraDetails must be a string");
        } else if (config.extraDetails.length > 200) {
            errors.push("extraDetails must be 200 characters or less");
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, sanitized: null };
    }

    const sanitized = {
        type:         config.type,
        style:        config.style,
        personality:  config.personality,
        color:        config.color,
        subjectName:  String(config.subjectName   ?? "").trim().slice(0, 100),
        extraDetails: String(config.extraDetails  ?? "").trim().slice(0, 200),
    };

    return { valid: true, errors: [], sanitized };
}

// ─── Output validator ─────────────────────────────────────────────────────────

/**
 * Validates the raw result object from stabilityClient and converts the base64
 * image string to a proper data URL ready for use in <img src={…}>.
 *
 * Stability AI returns plain base64 (no "data:..." prefix) when
 * `Accept: application/json` is used.
 *
 * @param {Object} result - { image: string, seed: number, finishReason: string }
 * @returns {{ valid: boolean, imageDataUrl: string|null, seed: number, finishReason: string }}
 */
export function validateGeneratedImage(result) {
    if (!result || typeof result !== "object") {
        return { valid: false, imageDataUrl: null, seed: 0, finishReason: "ERROR" };
    }

    if (typeof result.image !== "string" || result.image.length < 500) {
        return { valid: false, imageDataUrl: null, seed: 0, finishReason: "ERROR" };
    }

    // Build proper data URL
    const dataUrl = result.image.startsWith("data:")
        ? result.image
        : `data:image/png;base64,${result.image}`;

    // Sanity-check: decoded base64 must be a plausible image size (> 1 KB)
    try {
        const base64Part = dataUrl.split(",")[1] ?? "";
        const byteLength = Math.floor((base64Part.length * 3) / 4);
        if (byteLength < 1024) {
            return { valid: false, imageDataUrl: null, seed: 0, finishReason: "ERROR" };
        }
    } catch {
        return { valid: false, imageDataUrl: null, seed: 0, finishReason: "ERROR" };
    }

    return {
        valid:        true,
        imageDataUrl: dataUrl,
        seed:         result.seed        ?? 0,
        finishReason: result.finishReason ?? "SUCCESS",
    };
}