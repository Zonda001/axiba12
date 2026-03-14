/**
 * stabilityClient.js
 * Low-level Stability AI API wrapper.
 * Never call this directly — use mascotService.js instead.
 *
 * API docs: https://platform.stability.ai/docs/api-reference
 */

const STABILITY_API_BASE = "https://api.stability.ai/v2beta/stable-image/generate";

export const STABILITY_ENGINES = {
    CORE:  "core",   // Best quality/speed/cost balance (~$0.03/image)
    SD3:   "sd3",    // Highest quality Stable Diffusion 3 (~$0.065/image)
    ULTRA: "ultra",  // Ultra quality (~$0.08/image)
};

/**
 * Valid style presets accepted by Stability AI Core.
 * Passed as `style_preset` in the request body.
 */
export const STYLE_PRESETS = {
    MODEL_3D:    "3d-model",
    ANIME:       "anime",
    COMIC_BOOK:  "comic-book",
    DIGITAL_ART: "digital-art",
    FANTASY_ART: "fantasy-art",
    ISOMETRIC:   "isometric",
    LINE_ART:    "line-art",
    LOW_POLY:    "low-poly",
    NEON_PUNK:   "neon-punk",
    ORIGAMI:     "origami",
    PIXEL_ART:   "pixel-art",
};

/**
 * Valid aspect ratios for Core / SD3 engines.
 */
export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "4:5", "5:4", "16:9", "9:16", "21:9", "9:21"];

/**
 * Core image generation request.
 *
 * @param {Object} params
 * @param {string}  params.prompt           - Positive prompt (EN, 1-10000 chars)
 * @param {string}  [params.negativePrompt] - What to exclude from image
 * @param {string}  [params.aspectRatio]    - One of ASPECT_RATIOS, default "1:1"
 * @param {string}  [params.stylePreset]    - One of STYLE_PRESETS values
 * @param {string}  [params.outputFormat]   - "png" | "jpeg" | "webp", default "png"
 * @param {string}  [params.engine]         - One of STABILITY_ENGINES, default CORE
 * @param {number}  [params.seed]           - 0–4294967294; 0 = random
 * @param {string}  params.apiKey           - Stability AI bearer token
 *
 * @returns {Promise<{image: string, seed: number, finishReason: string}>}
 *   image = base64-encoded image data (NOT a data URL — no "data:…" prefix)
 */
export async function stabilityRequest({
                                           prompt,
                                           negativePrompt,
                                           aspectRatio    = "1:1",
                                           stylePreset,
                                           outputFormat   = "png",
                                           engine         = STABILITY_ENGINES.CORE,
                                           seed           = 0,
                                           apiKey,
                                       }) {
    if (!apiKey) {
        throw new StabilityAPIError("Stability AI API key is not configured", 0, null);
    }
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new Error("prompt is required");
    }
    if (!ASPECT_RATIOS.includes(aspectRatio)) {
        throw new Error(`aspectRatio must be one of: ${ASPECT_RATIOS.join(", ")}`);
    }

    const url = `${STABILITY_API_BASE}/${engine}`;

    const form = new FormData();
    form.append("prompt",        prompt.trim().slice(0, 10000));
    form.append("aspect_ratio",  aspectRatio);
    form.append("output_format", outputFormat);
    if (negativePrompt) {
        form.append("negative_prompt", negativePrompt.trim().slice(0, 10000));
    }
    if (stylePreset) {
        form.append("style_preset", stylePreset);
    }
    if (seed && seed > 0) {
        form.append("seed", String(Math.round(seed)));
    }

    let response;
    try {
        response = await fetch(url, {
            method:  "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept:        "application/json",   // receive base64 JSON
            },
            body: form,
        });
    } catch (networkError) {
        throw new Error(`Network error connecting to Stability AI: ${networkError.message}`);
    }

    if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = {}; }

        // Stability AI sends errors as:
        //   { "errors": ["string"], "id": "...", "name": "bad_request" }
        const message =
            errorData?.errors?.[0] ||
            errorData?.message     ||
            `HTTP ${response.status} ${response.statusText}`;

        throw new StabilityAPIError(message, response.status, errorData);
    }

    const data = await response.json();

    if (typeof data.image !== "string" || data.image.length < 100) {
        throw new Error("Stability AI returned empty or invalid image data");
    }

    // finish_reason can be: "SUCCESS" | "ERROR" | "CONTENT_FILTERED"
    if (data.finish_reason === "CONTENT_FILTERED") {
        throw new StabilityAPIError(
            "Image was filtered by Stability AI content policy. Try a different prompt.",
            422,
            data
        );
    }

    return {
        image:        data.image,                   // raw base64, no data URL prefix
        seed:         data.seed         ?? 0,
        finishReason: data.finish_reason ?? "SUCCESS",
    };
}

/**
 * stabilityRequest with exponential back-off retry.
 * Retries on transient 5xx and 429 errors; throws immediately on 4xx auth/validation errors.
 *
 * @param {Object} params   - Same as stabilityRequest
 * @param {number} maxRetries
 */
export async function stabilityRequestWithRetry(params, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await stabilityRequest(params);
        } catch (error) {
            lastError = error;

            // Abort immediately on non-retryable client errors
            if (error instanceof StabilityAPIError) {
                const noRetry = [400, 401, 402, 403, 422];
                if (noRetry.includes(error.status)) throw error;
            }

            if (attempt < maxRetries) {
                // 1.5 s → 3 s
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1500));
            }
        }
    }

    throw lastError;
}

/**
 * Custom error class carrying the HTTP status code and raw error body.
 */
export class StabilityAPIError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name   = "StabilityAPIError";
        this.status = status;
        this.body   = body;
    }
}