/**
 * mascotService.js
 *
 * Public API for mascot generation via Stability AI.
 * All UI components must import from here — never call stabilityClient or
 * mascotPrompt directly.
 *
 * Flow for generateMascot():
 *   1. Validate config        (mascotValidator.validateMascotConfig)
 *   2. Build prompt           (mascotPrompt.buildMascotPrompt)
 *   3. Call Stability AI      (stabilityClient.stabilityRequestWithRetry)
 *   4. Validate image output  (mascotValidator.validateGeneratedImage)
 *   5. Return { success, imageDataUrl, prompt, seed, config }
 */

import { stabilityRequestWithRetry, StabilityAPIError } from "./stabilityClient.js";
import { buildMascotPrompt }                            from "./prompts/mascotPrompt.js";
import { validateMascotConfig, validateGeneratedImage } from "./validators/mascotValidator.js";

// ─── API key resolution ───────────────────────────────────────────────────────

/**
 * Resolves the Stability AI API key.
 *   • Production:  VITE_STABILITY_API_KEY env var  (set in .env)
 *   • Dev/Testing: window.__STABILITY_TEST_KEY__    (set via the test bench UI)
 */
const getApiKey = () => {
    const key =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_STABILITY_API_KEY) ||
        (typeof window !== "undefined" && window.__STABILITY_TEST_KEY__);

    if (!key) throw new Error("Stability AI API key is not configured");
    return key;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a single mascot image.
 *
 * @param {Object}  config
 * @param {string}  config.type         - Mascot type id  (see MASCOT_TYPES)
 * @param {string}  config.style        - Style id        (see MASCOT_STYLES)
 * @param {string}  config.personality  - Personality id  (see MASCOT_PERSONALITIES)
 * @param {string}  config.color        - Color id        (see MASCOT_COLORS)
 * @param {string}  [config.subjectName]   - What ingredient / dish / animal (user text)
 * @param {string}  [config.extraDetails]  - Additional hints (user text)
 *
 * @returns {Promise<{
 *   success:      boolean,
 *   imageDataUrl?: string,   // "data:image/png;base64,…"  — ready for <img src>
 *   prompt?:      string,    // full positive prompt used (for debug display)
 *   seed?:        number,
 *   config?:      Object,    // sanitized config that was used
 *   error?:       string,    // user-friendly Ukrainian error message
 * }>}
 */
export async function generateMascot(config) {
    try {
        // 1. Validate & sanitize input
        const { valid, errors, sanitized } = validateMascotConfig(config);
        if (!valid) {
            return {
                success: false,
                error: `Некоректні параметри: ${errors.join("; ")}`,
            };
        }

        // 2. Build Stability AI prompt
        const { prompt, negativePrompt, stylePreset } = buildMascotPrompt(sanitized);

        // 3. Call Stability AI (with retry)
        const rawResult = await stabilityRequestWithRetry({
            prompt,
            negativePrompt,
            aspectRatio:  "1:1",
            stylePreset,
            outputFormat: "png",
            apiKey:       getApiKey(),
        });

        // 4. Validate image output
        const { valid: imgValid, imageDataUrl, seed } = validateGeneratedImage(rawResult);
        if (!imgValid) {
            return { success: false, error: "Зображення повернуто у некоректному форматі. Спробуйте ще раз." };
        }

        // 5. Return
        return {
            success: true,
            imageDataUrl,
            prompt,       // exposed so the test bench can display it
            seed,
            config: sanitized,
        };

    } catch (error) {
        console.error("[mascotService] generateMascot failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

/**
 * Generates N variants of the same mascot in parallel (different random seeds).
 * Useful for a "pick your favourite" UI.
 *
 * @param {Object} config  - Same as generateMascot
 * @param {number} count   - How many variants to generate (1–4)
 *
 * @returns {Promise<{
 *   success:   boolean,
 *   variants?: Array<{ imageDataUrl: string, seed: number }>,
 *   prompt?:   string,
 *   config?:   Object,
 *   error?:    string,
 * }>}
 */
export async function generateMascotVariants(config, count = 2) {
    try {
        const { valid, errors, sanitized } = validateMascotConfig(config);
        if (!valid) {
            return { success: false, error: `Некоректні параметри: ${errors.join("; ")}` };
        }

        const n = Math.min(Math.max(1, Math.round(count)), 4); // clamp 1–4
        const { prompt, negativePrompt, stylePreset } = buildMascotPrompt(sanitized);
        const apiKey = getApiKey();

        const requests = Array.from({ length: n }, () =>
            stabilityRequestWithRetry({ prompt, negativePrompt, aspectRatio: "1:1", stylePreset, outputFormat: "png", apiKey })
                .then(raw => validateGeneratedImage(raw))
                .catch(() => null)                         // swallow individual failures
        );

        const results  = await Promise.all(requests);
        const variants = results
            .filter(r => r?.valid)
            .map(r => ({ imageDataUrl: r.imageDataUrl, seed: r.seed }));

        if (variants.length === 0) {
            return { success: false, error: "Не вдалося згенерувати жодного варіанту. Перевірте ключ і спробуйте ще." };
        }

        return { success: true, variants, prompt, config: sanitized };

    } catch (error) {
        console.error("[mascotService] generateMascotVariants failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function formatUserError(error) {
    if (error?.message?.includes("not configured")) {
        return "Stability AI API ключ не налаштований. Введи ключ у рядку вище.";
    }
    if (error instanceof StabilityAPIError) {
        const s = error.status;
        if (s === 401 || s === 403) return "Невірний Stability AI API ключ. Перевір та спробуй ще раз.";
        if (s === 402)              return "Недостатньо кредитів Stability AI. Поповни баланс на platform.stability.ai.";
        if (s === 422)              return "Запит відхилено фільтром контенту Stability AI. Спробуй інший опис.";
        if (s === 429)              return "Забагато запитів. Зачекай хвилину і спробуй ще раз.";
        if (s >= 500)               return "Stability AI тимчасово недоступний. Спробуй пізніше.";
    }
    return "Помилка генерації зображення. Спробуй ще раз.";
}