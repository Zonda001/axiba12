/**
 * outputValidator.js
 * Validates and normalizes ALL AI responses before they reach the UI.
 * If the AI was somehow manipulated, this is the last safety net.
 */

// ─── Allowed ranges ───────────────────────────────────────────────────────────
const RECIPE_POINTS_MIN = 10;
const RECIPE_POINTS_MAX = 500;
const RECIPE_NAME_MAX = 100;
const RECIPE_DESCRIPTION_MAX = 300;
const STEP_TEXT_MAX = 500;
const INGREDIENT_NAME_MAX = 80;
const INGREDIENTS_MAX = 30;
const STEPS_MAX = 20;
const RECIPES_COUNT_MIN = 1;
const RECIPES_COUNT_MAX = 4;

const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampString(str, max) {
    if (typeof str !== "string") return "";
    return str.trim().slice(0, max);
}

function isValidNumber(val, min, max) {
    return typeof val === "number" && !isNaN(val) && val >= min && val <= max;
}

function clampNumber(val, min, max, fallback) {
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

// Suspicious strings that suggest the AI was manipulated
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

// ─── Ingredient validator ─────────────────────────────────────────────────────

function validateIngredient(raw) {
    if (!raw || typeof raw !== "object") return null;

    const name = clampString(raw.name, INGREDIENT_NAME_MAX);
    if (!name || isSuspicious(name)) return null;

    return {
        name,
        amount: clampString(raw.amount ?? "", 30),
        unit: clampString(raw.unit ?? "", 20),
    };
}

// ─── Step validator ───────────────────────────────────────────────────────────

function validateStep(raw, index) {
    if (!raw || typeof raw !== "object") return null;

    const text = clampString(raw.text ?? raw.description ?? "", STEP_TEXT_MAX);
    if (!text || isSuspicious(text)) return null;

    return {
        stepNumber: index + 1,
        text,
        isCheckpoint: raw.isCheckpoint === true,
        checkpointLabel: raw.isCheckpoint
            ? clampString(raw.checkpointLabel ?? "", 80)
            : null,
    };
}

// ─── Recipe validator ─────────────────────────────────────────────────────────

export function validateRecipe(raw) {
    if (!raw || typeof raw !== "object") {
        return { valid: false, reason: "not_an_object" };
    }

    const name = clampString(raw.name ?? raw.title ?? "", RECIPE_NAME_MAX);
    if (!name || isSuspicious(name)) {
        return { valid: false, reason: "invalid_name" };
    }

    const description = clampString(raw.description ?? raw.shortDescription ?? "", RECIPE_DESCRIPTION_MAX);

    const difficulty = DIFFICULTY_LEVELS.includes(raw.difficulty)
        ? raw.difficulty
        : "medium";

    // Points are calculated by our system, but AI suggests them — we clamp hard
    const points = clampNumber(
        raw.points ?? raw.score ?? raw.basePoints,
        RECIPE_POINTS_MIN,
        RECIPE_POINTS_MAX,
        50
    );

    // Ingredients
    const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
    const ingredients = rawIngredients
        .slice(0, INGREDIENTS_MAX)
        .map(validateIngredient)
        .filter(Boolean);

    if (ingredients.length === 0) {
        return { valid: false, reason: "no_ingredients" };
    }

    // Steps
    const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    const steps = rawSteps
        .slice(0, STEPS_MAX)
        .map((s, i) => validateStep(s, i))
        .filter(Boolean);

    if (steps.length === 0) {
        return { valid: false, reason: "no_steps" };
    }

    // Cuisine tag (optional)
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

// ─── Recipes list validator ───────────────────────────────────────────────────

export function validateRecipeList(raw) {
    if (!Array.isArray(raw)) {
        return { valid: false, reason: "not_an_array", recipes: [] };
    }

    const validated = raw
        .slice(0, RECIPES_COUNT_MAX)
        .map((r) => validateRecipe(r))
        .filter((r) => r.valid)
        .map((r) => r.recipe);

    if (validated.length < RECIPES_COUNT_MIN) {
        return { valid: false, reason: "too_few_valid_recipes", recipes: validated };
    }

    return { valid: true, recipes: validated };
}

// ─── Ingredient detection validator ──────────────────────────────────────────

export function validateIngredientDetection(raw) {
    if (!Array.isArray(raw)) {
        return { valid: false, reason: "not_an_array", ingredients: [] };
    }

    const ingredients = raw
        .slice(0, INGREDIENTS_MAX)
        .map((item) => {
            if (typeof item === "string") return clampString(item, INGREDIENT_NAME_MAX);
            if (item && typeof item === "object") return clampString(item.name ?? "", INGREDIENT_NAME_MAX);
            return null;
        })
        .filter((s) => s && s.length > 0 && !isSuspicious(s));

    return { valid: ingredients.length > 0, ingredients };
}

// ─── Step verification validator ─────────────────────────────────────────────

export function validateStepVerification(raw) {
    if (!raw || typeof raw !== "object") {
        return { valid: false, reason: "not_an_object" };
    }

    // Score: 0–100, we control point conversion separately
    const score = clampNumber(raw.score ?? raw.rating ?? 0, 0, 100, 0);

    const passed = typeof raw.passed === "boolean" ? raw.passed : score >= 50;

    const feedback = clampString(raw.feedback ?? raw.comment ?? "", 300);

    // Bonus points flag — only true if score is genuinely high
    const bonusEligible = score >= 80 && passed;

    return {
        valid: true,
        result: {
            score,
            passed,
            feedback,
            bonusEligible,
        },
    };
}