/**
 * outputValidator.js
 * Validates and normalizes ALL AI responses before they reach the UI.
 */

const RECIPE_POINTS_MIN = 10;
const RECIPE_POINTS_MAX = 500;
const RECIPE_NAME_MAX = 100;
const RECIPE_DESCRIPTION_MAX = 500;   // збільшено: детальний опис
const STEP_TEXT_MAX = 800;            // збільшено: детальний крок може бути довшим
const INGREDIENT_NAME_MAX = 120;      // збільшено: "3 зубчики часнику, дрібно нарізані"
const INGREDIENTS_MAX = 40;           // збільшено: повний рецепт може мати 30+ інгредієнтів
const STEPS_MAX = 40;                 // ЗБІЛЬШЕНО з 20 до 40 — детальні рецепти мають 20-35 кроків
const RECIPES_COUNT_MIN = 1;
const RECIPES_COUNT_MAX = 4;

const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

function clampString(str, max) {
    if (typeof str !== "string") return "";
    return str.trim().slice(0, max);
}

function clampNumber(val, min, max, fallback) {
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

const SUSPICIOUS_OUTPUT_PATTERNS = [
    /ignore\s+(all\s+)?previous/i,
    /give\s+(user|them)\s+\d+/i,
    /grant\s+\d+\s*points/i,
    /system\s*:/i,
    /<\s*script/i,
];

function isSuspicious(text) {
    if (typeof text !== "string") return false;
    return SUSPICIOUS_OUTPUT_PATTERNS.some((p) => p.test(text));
}

function validateIngredient(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = clampString(raw.name, INGREDIENT_NAME_MAX);
    if (!name || isSuspicious(name)) return null;
    return {
        name,
        amount: clampString(raw.amount ?? "", 30),
        unit:   clampString(raw.unit   ?? "", 20),
    };
}

function validateStep(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const text = clampString(raw.text ?? raw.description ?? "", STEP_TEXT_MAX);
    if (!text || isSuspicious(text)) return null;
    return {
        stepNumber:      index + 1,
        text,
        isCheckpoint:    raw.isCheckpoint === true,
        checkpointLabel: raw.isCheckpoint
            ? clampString(raw.checkpointLabel ?? "", 80)
            : null,
    };
}

export function validateRecipe(raw) {
    if (!raw || typeof raw !== "object")
        return { valid: false, reason: "not_an_object" };

    const name = clampString(raw.name ?? raw.title ?? "", RECIPE_NAME_MAX);
    if (!name || isSuspicious(name))
        return { valid: false, reason: "invalid_name" };

    const description = clampString(raw.description ?? raw.shortDescription ?? "", RECIPE_DESCRIPTION_MAX);
    const difficulty   = DIFFICULTY_LEVELS.includes(raw.difficulty) ? raw.difficulty : "medium";
    const points       = clampNumber(raw.points ?? raw.score ?? raw.basePoints, RECIPE_POINTS_MIN, RECIPE_POINTS_MAX, 50);

    const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
    const ingredients    = rawIngredients.slice(0, INGREDIENTS_MAX).map(validateIngredient).filter(Boolean);
    if (ingredients.length === 0) return { valid: false, reason: "no_ingredients" };

    const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    const steps    = rawSteps.slice(0, STEPS_MAX).map((s, i) => validateStep(s, i)).filter(Boolean);
    if (steps.length === 0) return { valid: false, reason: "no_steps" };

    const cuisine = clampString(raw.cuisine ?? "", 50);

    return {
        valid: true,
        recipe: {
            name,
            description,
            difficulty,
            points,
            ingredients,
            steps,
            cuisine,
            cookingTimeMinutes: clampNumber(raw.cookingTimeMinutes ?? raw.time ?? 30, 1, 600, 30),
        },
    };
}

export function validateRecipeList(raw) {
    if (!Array.isArray(raw))
        return { valid: false, reason: "not_an_array", recipes: [] };

    const validated = raw
        .slice(0, RECIPES_COUNT_MAX)
        .map((r) => validateRecipe(r))
        .filter((r) => r.valid)
        .map((r) => r.recipe);

    if (validated.length < RECIPES_COUNT_MIN)
        return { valid: false, reason: "too_few_valid_recipes", recipes: validated };

    return { valid: true, recipes: validated };
}

export function validateIngredientDetection(raw) {
    if (!Array.isArray(raw))
        return { valid: false, reason: "not_an_array", ingredients: [] };

    const ingredients = raw
        .slice(0, 50)
        .map((item) => {
            if (typeof item === "string") return clampString(item, INGREDIENT_NAME_MAX);
            if (item && typeof item === "object") return clampString(item.name ?? "", INGREDIENT_NAME_MAX);
            return null;
        })
        .filter((s) => s && s.length > 0 && !isSuspicious(s));

    return { valid: ingredients.length > 0, ingredients };
}

export function validateStepVerification(raw) {
    if (!raw || typeof raw !== "object")
        return { valid: false, reason: "not_an_object" };

    const score          = clampNumber(raw.score ?? raw.rating ?? 0, 0, 100, 0);
    const passed         = typeof raw.passed === "boolean" ? raw.passed : score >= 50;
    const feedback       = clampString(raw.feedback ?? raw.comment ?? "", 300);
    const bonusEligible  = score >= 80 && passed;

    return { valid: true, result: { score, passed, feedback, bonusEligible } };
}