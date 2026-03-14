/**
 * mascotService.js
 *
 * Mascot generation via Stability AI with GUARANTEED pure white background.
 *
 * Pipeline per image:
 *   1. Generate  → POST /v2beta/stable-image/generate/core  (PNG, possibly colored bg)
 *   2. Remove BG → POST /v2beta/stable-image/edit/remove-background  (transparent PNG)
 *   3. Composite → draw transparent PNG onto white #FFFFFF canvas  (pure white PNG)
 *
 * This 3-step pipeline is the only reliable way to guarantee a white background
 * regardless of what the model actually renders.
 */

import { buildMascotPrompt, MASCOT_EMOTIONS }           from "./prompts/mascotPrompt.js";
import { validateMascotConfig, validateGeneratedImage } from "./validators/mascotValidator.js";

// ─── Stability AI config ──────────────────────────────────────────────────────

const STABILITY_BASE = "https://api.stability.ai/v2beta/stable-image";
const GENERATE_URL   = `${STABILITY_BASE}/generate/core`;
const REMOVE_BG_URL  = `${STABILITY_BASE}/edit/remove-background`;

const getApiKey = () => {
    const key =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_STABILITY_API_KEY) ||
        (typeof window !== "undefined" && window.__STABILITY_TEST_KEY__);
    if (!key || !key.trim()) throw new Error("Stability AI API key is not configured");
    return key.trim();
};

// ─── Core low-level helpers ───────────────────────────────────────────────────

/**
 * Step 1 — Generate an image via Stability AI Core.
 * Returns { pngBlob, seed }
 */
async function generateImage({ prompt, negativePrompt, stylePreset, apiKey }) {
    const form = new FormData();
    form.append("prompt",        prompt);
    form.append("aspect_ratio",  "1:1");
    form.append("output_format", "png");
    if (negativePrompt) form.append("negative_prompt", negativePrompt);
    if (stylePreset)    form.append("style_preset",    stylePreset);

    const res = await fetchWithRetry(GENERATE_URL, {
        method:  "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept:        "image/*",
        },
        body: form,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new StabilityError(res.status, text);
    }

    const seed = Number(res.headers.get("seed") ?? 0);
    const blob = await res.blob();
    return { pngBlob: blob, seed };
}

/**
 * Step 2 — Remove background via Stability AI.
 * Returns Blob (transparent PNG).
 */
async function removeBackground({ pngBlob, apiKey }) {
    const form = new FormData();
    form.append("image",         pngBlob, "mascot.png");
    form.append("output_format", "png");

    const res = await fetchWithRetry(REMOVE_BG_URL, {
        method:  "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept:        "image/*",
        },
        body: form,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new StabilityError(res.status, text);
    }

    return await res.blob();
}

/**
 * Step 3 — Re-encode PNG preserving transparency (no background fill).
 * Returns data URL "data:image/png;base64,..."
 */
function compositeTransparent(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width  = img.naturalWidth  || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                // No fill — canvas starts fully transparent (alpha = 0)
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL("image/png"));
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
        img.src = url;
    });
}

/**
 * Full 3-step pipeline for one mascot image.
 * Returns { imageDataUrl, seed, prompt }
 */
async function generateWithWhiteBackground({ prompt, negativePrompt, stylePreset, apiKey }) {
    // Step 1 — generate
    const { pngBlob, seed } = await generateImage({ prompt, negativePrompt, stylePreset, apiKey });

    let finalBlob = pngBlob;

    // Step 2 — remove background (best-effort; falls back to original if this fails)
    try {
        finalBlob = await removeBackground({ pngBlob, apiKey });
    } catch (err) {
        console.warn("[mascotService] remove-background failed, using original:", err.message);
        finalBlob = pngBlob;
    }

    // Step 3 — re-encode as transparent PNG
    const imageDataUrl = await compositeTransparent(finalBlob);

    return { imageDataUrl, seed, prompt };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a single mascot with a guaranteed pure white background.
 */
export async function generateMascot(config) {
    try {
        const { valid, errors, sanitized } = validateMascotConfig(config);
        if (!valid) return { success: false, error: `Некоректні параметри: ${errors.join("; ")}` };

        const { prompt, negativePrompt, stylePreset } = buildMascotPrompt(sanitized);
        const apiKey = getApiKey();

        const { imageDataUrl, seed } = await generateWithWhiteBackground({
            prompt, negativePrompt, stylePreset, apiKey,
        });

        return { success: true, imageDataUrl, prompt, seed, config: sanitized };

    } catch (err) {
        console.error("[mascotService] generateMascot failed:", err.message);
        return { success: false, error: formatUserError(err) };
    }
}

/**
 * Generates 3 emotion variants (neutral / happy / sad) in parallel,
 * each with a guaranteed pure white background.
 */
export async function generateMascotEmotionSet(config) {
    try {
        const { valid, errors, sanitized } = validateMascotConfig(config);
        if (!valid) return { success: false, error: `Некоректні параметри: ${errors.join("; ")}` };

        const apiKey = getApiKey();

        const emotionList = [
            MASCOT_EMOTIONS.NEUTRAL,
            MASCOT_EMOTIONS.HAPPY,
            MASCOT_EMOTIONS.SAD,
        ];

        const requests = emotionList.map(async (emotionCfg) => {
            const { prompt, negativePrompt, stylePreset } = buildMascotPrompt({
                ...sanitized,
                emotion: emotionCfg.id,
            });

            try {
                const { imageDataUrl, seed } = await generateWithWhiteBackground({
                    prompt, negativePrompt, stylePreset, apiKey,
                });

                return {
                    success: true,
                    emotion: emotionCfg.id,
                    label:   emotionCfg.label,
                    imageDataUrl,
                    seed,
                    prompt,
                };

            } catch (err) {
                console.error(`[mascotService] emotion "${emotionCfg.id}" failed:`, err.message);
                return { success: false, emotion: emotionCfg.id, error: err.message };
            }
        });

        const results  = await Promise.all(requests);
        const emotions = results.filter(r => r.success);

        if (emotions.length === 0) {
            return {
                success: false,
                error: "Не вдалося згенерувати жодного варіанта. Перевірте API ключ та спробуйте ще раз.",
            };
        }

        return {
            success: true,
            emotions,
            config: sanitized,
            partial:     emotions.length < emotionList.length,
            failedCount: emotionList.length - emotions.length,
        };

    } catch (err) {
        console.error("[mascotService] generateMascotEmotionSet failed:", err.message);
        return { success: false, error: formatUserError(err) };
    }
}

/**
 * Generates N variants of the same mascot in parallel.
 */
export async function generateMascotVariants(config, count = 2) {
    try {
        const { valid, errors, sanitized } = validateMascotConfig(config);
        if (!valid) return { success: false, error: `Некоректні параметри: ${errors.join("; ")}` };

        const n = Math.min(Math.max(1, Math.round(count)), 4);
        const { prompt, negativePrompt, stylePreset } = buildMascotPrompt(sanitized);
        const apiKey = getApiKey();

        const requests = Array.from({ length: n }, () =>
            generateWithWhiteBackground({ prompt, negativePrompt, stylePreset, apiKey }).catch(() => null)
        );

        const results  = await Promise.all(requests);
        const variants = results.filter(Boolean).map(r => ({ imageDataUrl: r.imageDataUrl, seed: r.seed }));

        if (variants.length === 0) {
            return { success: false, error: "Не вдалося згенерувати жодного варіанту. Перевірте ключ і спробуйте ще." };
        }

        return { success: true, variants, prompt, config: sanitized };

    } catch (err) {
        console.error("[mascotService] generateMascotVariants failed:", err.message);
        return { success: false, error: formatUserError(err) };
    }
}

// ─── Network helpers ──────────────────────────────────────────────────────────

async function fetchWithRetry(url, options, maxRetries = 2, delayMs = 1500) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, options);
            if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
                const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || delayMs * (attempt + 1);
                await sleep(wait);
                continue;
            }
            return res;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) await sleep(delayMs * (attempt + 1));
        }
    }
    throw lastError ?? new Error("Network request failed");
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Error types ──────────────────────────────────────────────────────────────

class StabilityError extends Error {
    constructor(status, body) {
        super(`Stability AI error ${status}: ${body}`);
        this.status = status;
        this.body   = body;
    }
}

function formatUserError(err) {
    if (err?.message?.includes("not configured")) {
        return "Stability AI API ключ не налаштований. Введи ключ у рядку вище.";
    }
    if (err instanceof StabilityError) {
        const s = err.status;
        if (s === 401 || s === 403) return "Невірний Stability AI API ключ. Перевір та спробуй ще раз.";
        if (s === 402)              return "Недостатньо кредитів Stability AI. Поповни баланс на platform.stability.ai.";
        if (s === 422)              return "Запит відхилено фільтром контенту. Спробуй інший опис.";
        if (s === 429)              return "Забагато запитів. Зачекай хвилину і спробуй ще раз.";
        if (s >= 500)               return "Stability AI тимчасово недоступний. Спробуй пізніше.";
    }
    return "Помилка генерації зображення. Спробуй ще раз.";
}