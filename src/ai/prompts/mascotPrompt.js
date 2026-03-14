/**
 * mascotPrompt.js
 *
 * Prompt engineering for cooking-app mascot generation via Stability AI.
 *
 * PROMPT STRATEGY:
 *  • Positive prompt  = subject + style + personality + color + quality anchors
 *  • Negative prompt  = anti-realism + anti-artifacts + category-specific exclusions
 *  • style_preset     = mapped from MASCOT_STYLES to Stability AI accepted values
 *
 * SECURITY:
 *  • System-hardcoded quality/composition directives are ALWAYS appended last
 *    so user text cannot override them
 *  • User text (subjectName, extraDetails) passes through sanitizePromptFragment()
 *    before entering the prompt
 *  • This module never calls any API — pure prompt construction
 */

// ─── Catalog objects ──────────────────────────────────────────────────────────

export const MASCOT_TYPES = {
    CHEF: {
        id: "chef", label: "Шеф-кухар", icon: "👨‍🍳",
        description: "Головний персонаж-кухар",
        subjectLabel: null,   // no free-text subject needed
        subjectPlaceholder: null,
    },
    INGREDIENT: {
        id: "ingredient", label: "Інгредієнт", icon: "🍅",
        description: "Антропоморфний харчовий продукт",
        subjectLabel: "ІНГРЕДІЄНТ",
        subjectPlaceholder: "помідор, морква, гриби, сир...",
    },
    DISH: {
        id: "dish", label: "Страва", icon: "🍲",
        description: "Страва або десерт з характером",
        subjectLabel: "СТРАВА",
        subjectPlaceholder: "борщ, піца, суші, торт...",
    },
    APPLIANCE: {
        id: "appliance", label: "Кухонне приладдя", icon: "🍳",
        description: "Персонаж-посуд або техніка",
        subjectLabel: "ПРЕДМЕТ",
        subjectPlaceholder: "сковорода, чайник, міксер...",
    },
    ANIMAL: {
        id: "animal", label: "Тварина-кухар", icon: "🐻",
        description: "Тварина у кухарському вбранні",
        subjectLabel: "ТВАРИНА",
        subjectPlaceholder: "ведмідь, кіт, лисиця, заєць...",
    },
    TROPHY: {
        id: "trophy", label: "Трофей-нагорода", icon: "🏆",
        description: "Персонаж-досягнення або нагорода",
        subjectLabel: null,
        subjectPlaceholder: null,
    },
};

export const MASCOT_STYLES = {
    CARTOON: {
        id: "cartoon", label: "Мультяшний",
        stylePreset: "comic-book",
        promptHint: "cartoon character design, bold outlines, clean linework, expressive features",
    },
    CHIBI: {
        id: "chibi", label: "Чіббі (cute)",
        stylePreset: "anime",
        promptHint: "chibi style, super deformed proportions, oversized round head, tiny body, big sparkly eyes",
    },
    PIXEL: {
        id: "pixel", label: "Піксель-арт",
        stylePreset: "pixel-art",
        promptHint: "pixel art style, retro 16-bit game sprite, crisp pixels, limited color palette",
    },
    FLAT: {
        id: "flat", label: "Flat design",
        stylePreset: "digital-art",
        promptHint: "flat vector illustration, geometric shapes, minimal shadows, clean modern design",
    },
    THREE_D: {
        id: "3d", label: "3D рендер",
        stylePreset: "3d-model",
        promptHint: "3D rendered character, smooth surfaces, studio lighting, subsurface scattering, Pixar-like quality",
    },
    FANTASY: {
        id: "fantasy", label: "Фентезі",
        stylePreset: "fantasy-art",
        promptHint: "fantasy illustration style, painterly details, magical aura, storybook quality",
    },
};

export const MASCOT_PERSONALITIES = {
    HAPPY: {
        id: "happy", label: "😄 Веселий",
        promptHint: "cheerful expression, wide bright smile, happy crinkled eyes, positive energetic pose",
    },
    BRAVE: {
        id: "brave", label: "💪 Відважний",
        promptHint: "confident heroic pose, determined furrowed brows, chest out, strong bold stance",
    },
    CUTE: {
        id: "cute", label: "🥰 Милий",
        promptHint: "adorable rosy cheeks, innocent wide eyes, soft gentle expression, slightly blushing",
    },
    WISE: {
        id: "wise", label: "🧐 Мудрий",
        promptHint: "thoughtful calm expression, wise knowing eyes, gentle smile, serene dignified pose",
    },
    ENERGETIC: {
        id: "energetic", label: "⚡ Енергійний",
        promptHint: "dynamic action pose, excited open mouth, radiant motion lines, full of life",
    },
    MISCHIEVOUS: {
        id: "mischievous", label: "😏 Шибеник",
        promptHint: "cheeky smirk, playful winking one eye, raised eyebrow, mischievous tilt of head",
    },
};

export const MASCOT_COLORS = [
    { id: "red",      label: "Червоний",          hex: "#EF4444", prompt: "vibrant red and white color palette"              },
    { id: "orange",   label: "Помаранчевий",       hex: "#F97316", prompt: "warm orange and cream color palette"              },
    { id: "yellow",   label: "Жовтий / Золотий",   hex: "#EAB308", prompt: "sunny golden yellow and warm white color palette" },
    { id: "green",    label: "Зелений",             hex: "#22C55E", prompt: "fresh bright green and mint color palette"        },
    { id: "blue",     label: "Блакитний",           hex: "#3B82F6", prompt: "sky blue and soft white color palette"            },
    { id: "purple",   label: "Фіолетовий",          hex: "#8B5CF6", prompt: "royal purple and lavender color palette"          },
    { id: "pink",     label: "Рожевий",             hex: "#EC4899", prompt: "bubbly pastel pink and white color palette"       },
    { id: "brown",    label: "Коричневий",           hex: "#92400E", prompt: "warm chocolate brown and tan color palette"       },
    { id: "gold",     label: "Золото / Преміум",    hex: "#D97706", prompt: "luxurious gold and cream color palette, premium feel" },
    { id: "rainbow",  label: "Різнокольоровий",     hex: null,      prompt: "vibrant multicolor rainbow palette, colorful and joyful" },
];

// ─── Main prompt builder ──────────────────────────────────────────────────────

/**
 * Builds the positive prompt, negative prompt, and style preset
 * for a mascot generation request.
 *
 * @param {Object}  cfg
 * @param {string}  cfg.type         - Key of MASCOT_TYPES (case-insensitive)
 * @param {string}  cfg.style        - Key of MASCOT_STYLES (case-insensitive)
 * @param {string}  cfg.personality  - Key of MASCOT_PERSONALITIES (case-insensitive)
 * @param {string}  cfg.color        - id of one entry in MASCOT_COLORS
 * @param {string}  [cfg.subjectName]   - Sanitized user text for ingredient/dish/appliance/animal
 * @param {string}  [cfg.extraDetails]  - Sanitized extra hints from the user
 *
 * @returns {{ prompt: string, negativePrompt: string, stylePreset: string }}
 */
export function buildMascotPrompt({
                                      type        = "chef",
                                      style       = "cartoon",
                                      personality = "happy",
                                      color       = "red",
                                      subjectName   = "",
                                      extraDetails  = "",
                                  }) {
    // Resolve catalog entries (fall back to defaults gracefully)
    const typeKey  = type.toUpperCase();
    const styleKey = style.toUpperCase();
    const persKey  = personality.toUpperCase();

    const typeCfg  = MASCOT_TYPES[typeKey]          ?? MASCOT_TYPES.CHEF;
    const styleCfg = MASCOT_STYLES[styleKey]        ?? MASCOT_STYLES.CARTOON;
    const persCfg  = MASCOT_PERSONALITIES[persKey]  ?? MASCOT_PERSONALITIES.HAPPY;
    const colorCfg = MASCOT_COLORS.find(c => c.id === color) ?? MASCOT_COLORS[0];

    // Sanitize user-provided fragments
    const subject = sanitizePromptFragment(subjectName);
    const extras  = sanitizePromptFragment(extraDetails);

    // ── Type-specific subject prompt ──────────────────────────────────────────
    const subjectPrompt = buildSubjectPrompt(typeCfg.id, subject);

    // ── Assemble full positive prompt ─────────────────────────────────────────
    // ORDER MATTERS: subject → style → personality → color → fixed quality anchors
    // Fixed quality anchors are LAST so they cannot be diluted by user text
    const parts = [
        subjectPrompt,
        styleCfg.promptHint,
        persCfg.promptHint,
        colorCfg.prompt,
        extras || null,
        // ── Hardcoded quality & composition directives ────────────────────────
        "isolated on pure white background",
        "full body character design",
        "centered composition",
        "mascot illustration",
        "no text, no letters, no watermark",
        "masterpiece, best quality, sharp details, high resolution",
    ].filter(Boolean);

    const prompt = parts.join(", ");

    // ── Negative prompt ───────────────────────────────────────────────────────
    const negativePrompt = buildNegativePrompt(typeCfg.id);

    return { prompt, negativePrompt, stylePreset: styleCfg.stylePreset };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildSubjectPrompt(typeId, subject) {
    switch (typeId) {
        case "chef":
            return "cute cartoon chef mascot character, wearing tall white toque blanche chef hat and double-breasted chef apron, holding a wooden ladle and cooking spoon, friendly cooking character";

        case "ingredient":
            return `cute anthropomorphic ${subject || "tomato"} food ingredient mascot character, round body with big expressive eyes, tiny stubby arms and legs, adorable smiling face, anthropomorphic food character`;

        case "dish":
            return `cute anthropomorphic ${subject || "bowl of borsch soup"} dish mascot character, friendly bowl or plate shape with an expressive face, tiny arms, charming cooking mascot`;

        case "appliance":
            return `cute anthropomorphic ${subject || "frying pan"} kitchen appliance mascot character, cooking tool with a cute smiling face, tiny arms and personality, charming kitchen mascot`;

        case "animal":
            return `cute ${subject || "bear"} animal chef mascot character, wearing a chef hat and apron, adorable anthropomorphic animal cooking character, full body`;

        case "trophy":
            return "cute golden cooking trophy award mascot character, shiny trophy cup with a cute smiling face, wearing a tiny chef hat, achievement mascot character";

        default:
            return "cute cooking mascot character, kitchen theme";
    }
}

function buildNegativePrompt(typeId) {
    const universal = [
        "realistic photograph",
        "photorealistic",
        "photo",
        "3d photorealistic render",
        "dark background",
        "colored background",
        "gradient background",
        "blurry",
        "low quality",
        "bad anatomy",
        "deformed",
        "ugly",
        "disfigured",
        "poorly drawn",
        "extra limbs",
        "multiple characters in scene",
        "text",
        "letters",
        "watermark",
        "signature",
        "logo",
        "frame",
        "border",
        "nsfw",
        "violence",
        "gore",
    ];

    const typeSpecific = {
        ingredient: ["real food photo", "non-anthropomorphic food", "food without face"],
        dish:       ["real food photo", "non-anthropomorphic dish", "actual photograph of food"],
        chef:       ["scary face", "horror", "dark theme"],
        animal:     ["scary", "aggressive", "wild animal attack"],
        trophy:     ["realistic metal photo"],
    };

    const extra = typeSpecific[typeId] ?? [];
    return [...universal, ...extra].join(", ");
}

/**
 * Strips characters that could cause prompt injection or break the image generation prompt.
 * Stability AI prompts are processed differently than LLM text, but we still sanitize.
 */
function sanitizePromptFragment(text) {
    if (typeof text !== "string") return "";
    return text
        .trim()
        .slice(0, 100)                          // hard length cap
        .replace(/[<>{}\[\]\\]/g, "")           // remove structural chars
        .replace(/\n|\r/g, " ")                 // flatten newlines
        .replace(/\s{2,}/g, " ")                // collapse whitespace
        .replace(/ignore|system:|override|jailbreak|bypass/gi, "") // strip obvious injection attempts
        .trim();
}