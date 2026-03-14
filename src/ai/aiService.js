/**
 * aiService.js — max_tokens збільшено до 7000 для детальних рецептів
 */

import { groqRequestWithRetry, parseJSONResponse, fileToBase64, GROQ_MODELS } from "./groqClient.js";
import { buildIngredientDetectionMessages } from "./prompts/ingredientsPrompt.js";
import { buildRecipeFromIngredientsMessages, buildRecipeFromCommentMessages } from "./prompts/recipePrompt.js";
import { buildStepVerificationMessages } from "./prompts/verificationPrompt.js";
import { sanitizeUserComment, sanitizeIngredientList } from "./validators/inputSanitizer.js";
import { validateIngredientDetection, validateRecipeList, validateStepVerification } from "./validators/outputValidator.js";

const getApiKey = () => {
    const key = import.meta.env.VITE_GROQ_API_KEY || window.__GROQ_TEST_KEY__;
    if (!key) throw new Error("VITE_GROQ_API_KEY environment variable is not set");
    return key;
};

export async function detectIngredientsFromPhotos(photoFiles) {
    try {
        if (!Array.isArray(photoFiles) || photoFiles.length === 0)
            return { success: false, error: "Потрібно завантажити хоча б одне фото" };

        const base64Images = await Promise.all(photoFiles.slice(0, 3).map(fileToBase64));
        const messages = buildIngredientDetectionMessages(base64Images);
        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.VISION,
            messages,
            options: { temperature: 0.1, max_tokens: 1024 },
            apiKey: getApiKey(),
        });
        const parsed = parseJSONResponse(rawResponse);
        const { valid, ingredients } = validateIngredientDetection(parsed);
        if (!valid || ingredients.length === 0)
            return { success: false, error: "Не вдалося розпізнати інгредієнти. Спробуйте зробити фото чіткіше." };
        return { success: true, ingredients };
    } catch (error) {
        console.error("[aiService] detectIngredientsFromPhotos failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

export async function generateRecipesFromIngredients(availableIngredients, excludedIngredients = [], challengeCuisine = null) {
    try {
        const availResult = sanitizeIngredientList(availableIngredients);
        const exclResult  = sanitizeIngredientList(excludedIngredients);
        if (!availResult.safe) return { success: false, error: "Некоректний список інгредієнтів" };

        const messages = buildRecipeFromIngredientsMessages(availResult.sanitized, exclResult.sanitized, challengeCuisine);
        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.TEXT,
            messages,
            // ЗБІЛЬШЕНО: 2048 → 7000. Детальні рецепти з 15-25 кроками
            // потребують ~1500-2000 токенів кожен, 4 рецепти = ~6000-8000 токенів
            options: { temperature: 0.7, max_tokens: 7000 },
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

export async function generateRecipesFromComment(userComment, challengeCuisine = null) {
    try {
        const { safe, sanitized, message } = sanitizeUserComment(userComment);
        if (!safe) return { success: false, error: message ?? "Некоректний запит. Опишіть бажану страву звичайними словами." };

        const messages = buildRecipeFromCommentMessages(sanitized, challengeCuisine);
        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.TEXT,
            messages,
            // ЗБІЛЬШЕНО: 2048 → 7000. Детальні рецепти з 15-25 кроками
            // потребують ~1500-2000 токенів кожен, 4 рецепти = ~6000-8000 токенів
            options: { temperature: 0.8, max_tokens: 7000 },
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

export async function verifyStepPhoto(photoFile, stepData, recipeName, stepNumber) {
    try {
        if (!photoFile) return { success: false, error: "Фото не надано" };
        const base64 = await fileToBase64(photoFile);
        const messages = buildStepVerificationMessages(base64, stepData.text, stepData.checkpointLabel, recipeName, stepNumber);
        const rawResponse = await groqRequestWithRetry({
            model: GROQ_MODELS.VISION,
            messages,
            options: { temperature: 0.2, max_tokens: 512 },
            apiKey: getApiKey(),
        });
        const parsed = parseJSONResponse(rawResponse);
        const { valid, result } = validateStepVerification(parsed);
        if (!valid) return { success: false, error: "Не вдалося оцінити крок. Спробуйте ще раз." };
        return { success: true, result };
    } catch (error) {
        console.error("[aiService] verifyStepPhoto failed:", error.message);
        return { success: false, error: formatUserError(error) };
    }
}

function formatUserError(error) {
    if (error?.status === 401) return "Помилка авторизації AI сервісу";
    if (error?.status === 429) return "Забагато запитів. Зачекайте хвилину і спробуйте знову.";
    if (error?.status >= 500) return "AI сервіс тимчасово недоступний. Спробуйте пізніше.";
    return "Виникла помилка. Спробуйте ще раз.";
}