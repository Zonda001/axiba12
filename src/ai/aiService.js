/**
 * aiService.js
 *
 * The ONLY public interface to the AI layer.
 * All components must use this — never import groqClient or prompts directly.
 *
 * Flow for every operation:
 *   1. Sanitize input  (inputSanitizer)
 *   2. Build prompt    (prompts/)
 *   3. Call Groq API   (groqClient)
 *   4. Parse JSON      (groqClient.parseJSONResponse)
 *   5. Validate output (outputValidator)
 *   6. Return safe data
 */

import { groqRequestWithRetry, parseJSONResponse, fileToBase64, GROQ_MODELS } from "./groqClient.js";
import { buildIngredientDetectionMessages } from "./prompts/ingredientsPrompt.js";
import { buildRecipeFromIngredientsMessages, buildRecipeFromCommentMessages } from "./prompts/recipePrompt.js";
import { buildStepVerificationMessages } from "./prompts/verificationPrompt.js";
import { sanitizeUserComment, sanitizeIngredientList } from "./validators/inputSanitizer.js";
import { validateIngredientDetection, validateRecipeList, validateStepVerification } from "./validators/outputValidator.js";

// API key: from env in production, from window.__GROQ_TEST_KEY__ in dev testing
const getApiKey = () => {
    const key = import.meta.env.VITE_GROQ_API_KEY || window.__GROQ_TEST_KEY__;
    if (!key) throw new Error("VITE_GROQ_API_KEY environment variable is not set");
    return key;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * VARIANT 1: Detect ingredients from up to 3 photos.
 *
 * @param {File[]} photoFiles  - Raw File objects from input[type=file]
 * @returns {Promise<{ success: boolean, ingredients?: string[], error?: string }>}
 */
export async function detectIngredientsFromPhotos(photoFiles) {
    try {
        if (!Array.isArray(photoFiles) || photoFiles.length === 0) {
            return { success: false, error: "Потрібно завантажити хоча б одне фото" };
        }

        const files = photoFiles.slice(0, 3);

        // Convert all photos to base64 in parallel
        const base64Images = await Promise.all(files.map(fileToBase64));

        const messages = buildIngredientDetectionMessages(base64Images);

        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.VISION,
            messages,
            options: { temperature: 0.1, max_tokens: 1024 }, // low temp = consistent output
            apiKey: getApiKey(),
        });

        const parsed = parseJSONResponse(rawResponse);
        const { valid, ingredients } = validateIngredientDetection(parsed);

        if (!valid || ingredients.length === 0) {
            return {
                success: false,
                error: "Не вдалося розпізнати інгредієнти. Спробуйте зробити фото чіткіше.",
            };
        }

        return { success: true, ingredients };
    } catch (error) {
        console.error("[aiService] detectIngredientsFromPhotos failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

/**
 * VARIANT 1 (continued): Generate recipes from selected ingredients.
 *
 * @param {string[]} availableIngredients  - All detected ingredients
 * @param {string[]} excludedIngredients   - Ingredients user marked red (excluded)
 * @param {string}   [challengeCuisine]    - Optional daily challenge cuisine
 * @returns {Promise<{ success: boolean, recipes?: Recipe[], error?: string }>}
 */
export async function generateRecipesFromIngredients(
    availableIngredients,
    excludedIngredients = [],
    challengeCuisine = null
) {
    try {
        // Sanitize both lists
        const availResult = sanitizeIngredientList(availableIngredients);
        const exclResult = sanitizeIngredientList(excludedIngredients);

        if (!availResult.safe) {
            return { success: false, error: "Некоректний список інгредієнтів" };
        }

        const messages = buildRecipeFromIngredientsMessages(
            availResult.sanitized,
            exclResult.sanitized,
            challengeCuisine
        );

        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.TEXT,
            messages,
            options: { temperature: 0.7, max_tokens: 2048 },
            apiKey: getApiKey(),
        });

        const parsed = parseJSONResponse(rawResponse);
        const { valid, recipes, reason } = validateRecipeList(parsed);

        if (!valid) {
            console.error("[aiService] Recipe validation failed:", reason);
            return { success: false, error: "Не вдалося сформувати рецепти. Спробуйте ще раз." };
        }

        return { success: true, recipes };
    } catch (error) {
        console.error("[aiService] generateRecipesFromIngredients failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

/**
 * VARIANT 2: Generate recipes from free-text comment.
 *
 * @param {string}  userComment       - Raw user input (will be sanitized here)
 * @param {string}  [challengeCuisine]
 * @returns {Promise<{ success: boolean, recipes?: Recipe[], error?: string }>}
 */
export async function generateRecipesFromComment(userComment, challengeCuisine = null) {
    try {
        // Sanitize user comment — this is the injection risk point
        const { safe, sanitized, message } = sanitizeUserComment(userComment);

        if (!safe) {
            return {
                success: false,
                error: message ?? "Некоректний запит. Опишіть бажану страву звичайними словами.",
            };
        }

        const messages = buildRecipeFromCommentMessages(sanitized, challengeCuisine);

        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.TEXT,
            messages,
            options: { temperature: 0.8, max_tokens: 2048 }, // slightly more creative for open-ended
            apiKey: getApiKey(),
        });

        const parsed = parseJSONResponse(rawResponse);
        const { valid, recipes, reason } = validateRecipeList(parsed);

        if (!valid) {
            console.error("[aiService] Recipe validation failed:", reason);
            return { success: false, error: "Не вдалося сформувати рецепти. Спробуйте переформулювати запит." };
        }

        return { success: true, recipes };
    } catch (error) {
        console.error("[aiService] generateRecipesFromComment failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

/**
 * Verify a cooking step photo against the expected step.
 *
 * @param {File}   photoFile        - User's photo of the completed step
 * @param {Object} stepData         - Step data from our validated recipe
 * @param {string} stepData.text
 * @param {string} stepData.checkpointLabel
 * @param {string} recipeName
 * @param {number} stepNumber
 * @returns {Promise<{ success: boolean, result?: VerificationResult, error?: string }>}
 */
export async function verifyStepPhoto(photoFile, stepData, recipeName, stepNumber) {
    try {
        if (!photoFile) {
            return { success: false, error: "Фото не надано" };
        }

        const base64 = await fileToBase64(photoFile);

        const messages = buildStepVerificationMessages(
            base64,
            stepData.text,
            stepData.checkpointLabel,
            recipeName,
            stepNumber
        );

        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.VISION,
            messages,
            options: { temperature: 0.2, max_tokens: 512 }, // very low temp for consistent scoring
            apiKey: getApiKey(),
        });

        const parsed = parseJSONResponse(rawResponse);
        const { valid, result } = validateStepVerification(parsed);

        if (!valid) {
            return { success: false, error: "Не вдалося оцінити крок. Спробуйте ще раз." };
        }

        return { success: true, result };
    } catch (error) {
        console.error("[aiService] verifyStepPhoto failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function formatUserError(error) {
    // Never expose raw error messages to the user (they may contain API details)
    if (error?.status === 401) {
        return "Помилка авторизації AI сервісу";
    }
    if (error?.status === 429) {
        return "Забагато запитів. Зачекайте хвилину і спробуйте знову.";
    }
    if (error?.status >= 500) {
        return "AI сервіс тимчасово недоступний. Спробуйте пізніше.";
    }
    return "Виникла помилка. Спробуйте ще раз.";
}