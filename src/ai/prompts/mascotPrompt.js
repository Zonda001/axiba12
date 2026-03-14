/**
 * mascotPrompt.js
 *
 * Prompt engineering for cooking-app mascot generation via Stability AI.
 *
 * CHANGES:
 *  • Added MASCOT_EMOTIONS (neutral / happy / sad) for emotion-set generation
 *  • Strengthened pure white background directives in positive + negative prompts
 *  • buildMascotPrompt now accepts optional `emotion` parameter
 */

// ─── Emotion variants ────────────────────────────────────────────────────────

export const MASCOT_EMOTIONS = {
    NEUTRAL: {
        id: "neutral",
        label: "😐 Нейтральний",
        promptHint:
            "calm neutral expression, relaxed composed face, subtle slight smile, no strong emotion, serene look",
    },
    HAPPY: {
        id: "happy",
        label: "😄 Веселий",
        promptHint:
            "wide bright cheerful smile, happy crinkled eyes, joyful exuberant expression, big grin, upbeat energetic pose",
    },
    SAD: {
        id: "sad",
        label: "😢 Сумний",
        promptHint:
            "sad drooping eyes, slight downward frown, melancholic dejected expression, slumped gentle pose, tearful glistening eyes",
    },
};

// ─── Catalog objects ──────────────────────────────────────────────────────────

export const MASCOT_TYPES = {
    CHEF: {
        id: "chef", label: "Шеф-кухар", icon: "👨‍🍳",
        description: "Головний персонаж-кухар",
        subjectLabel: null,
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
    { id: "red",      label: "Червоний",        hex: "#EF4444", prompt: "vibrant red and white color palette"              },
    { id: "orange",   label: "Помаранчевий",     hex: "#F97316", prompt: "warm orange and cream color palette"              },
    { id: "yellow",   label: "Жовтий / Золотий", hex: "#EAB308", prompt: "sunny golden yellow and warm white color palette" },
    { id: "green",    label: "Зелений",           hex: "#22C55E", prompt: "fresh bright green and mint color palette"        },
    { id: "blue",     label: "Блакитний",         hex: "#3B82F6", prompt: "sky blue and soft white color palette"            },
    { id: "purple",   label: "Фіолетовий",        hex: "#8B5CF6", prompt: "royal purple and lavender color palette"          },
    { id: "pink",     label: "Рожевий",           hex: "#EC4899", prompt: "bubbly pastel pink and white color palette"       },
    { id: "brown",    label: "Коричневий",         hex: "#92400E", prompt: "warm chocolate brown and tan color palette"       },
    { id: "gold",     label: "Золото / Преміум",  hex: "#D97706", prompt: "luxurious gold and cream color palette, premium feel" },
    { id: "rainbow",  label: "Різнокольоровий",   hex: null,      prompt: "vibrant multicolor rainbow palette, colorful and joyful" },
];

// ─── Main prompt builder ──────────────────────────────────────────────────────

/**
 * Builds the positive prompt, negative prompt, and style preset.
 *
 * @param {Object}  cfg
 * @param {string}  cfg.type
 * @param {string}  cfg.style
 * @param {string}  cfg.personality
 * @param {string}  cfg.color
 * @param {string}  [cfg.subjectName]
 * @param {string}  [cfg.extraDetails]
 * @param {string}  [cfg.emotion]   - "neutral" | "happy" | "sad"  (overrides personality expression)
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
                                      emotion       = null,   // ← NEW: when set, overrides the face/expression part
                                  }) {
    const typeKey  = type.toUpperCase();
    const styleKey = style.toUpperCase();
    const persKey  = personality.toUpperCase();

    const typeCfg  = MASCOT_TYPES[typeKey]         ?? MASCOT_TYPES.CHEF;
    const styleCfg = MASCOT_STYLES[styleKey]       ?? MASCOT_STYLES.CARTOON;
    const persCfg  = MASCOT_PERSONALITIES[persKey] ?? MASCOT_PERSONALITIES.HAPPY;
    const colorCfg = MASCOT_COLORS.find(c => c.id === color) ?? MASCOT_COLORS[0];

    // Emotion overrides the expression part of personality
    const emotionKey  = emotion ? emotion.toUpperCase() : null;
    const emotionCfg  = emotionKey ? (MASCOT_EMOTIONS[emotionKey] ?? null) : null;
    const expressionHint = emotionCfg ? emotionCfg.promptHint : persCfg.promptHint;

    const subject = sanitizePromptFragment(subjectName);
    const extras  = sanitizePromptFragment(extraDetails);

    const subjectPrompt = buildSubjectPrompt(typeCfg.id, subject, extras);

    // ── Positive prompt ───────────────────────────────────────────────────────
    // Order: subject → art style → expression/emotion → color → extras → fixed anchors
    // Fixed white-background anchors are LAST so they cannot be overridden
    const parts = [
        subjectPrompt,
        styleCfg.promptHint,
        expressionHint,
        colorCfg.prompt,
        extras || null,
        // ── Fixed quality & background anchors ────────────────────────────────
        "pure white background",
        "solid white background only",
        "isolated character on white",
        "no background elements",
        "full body character",
        "centered composition",
        "mascot illustration",
        "no text, no letters, no watermark",
        "masterpiece, best quality, sharp clean details, high resolution",
    ].filter(Boolean);

    const prompt = parts.join(", ");

    const negativePrompt = buildNegativePrompt(typeCfg.id);

    return { prompt, negativePrompt, stylePreset: styleCfg.stylePreset };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildSubjectPrompt(typeId, subject, extras) {
    const concept = extras || subject || null;
    switch (typeId) {
        case "chef":
            return concept
                ? `cute cartoon ${concept} mascot character, chef theme, wearing chef hat and apron, friendly cooking character, full body`
                : "cute cartoon chef mascot character, wearing tall white toque blanche chef hat and double-breasted chef apron, holding a wooden ladle, friendly cooking character, full body";

        case "ingredient":
            return `cute anthropomorphic ${concept || "tomato"} food ingredient mascot character, round body with big expressive eyes, tiny stubby arms and legs, adorable smiling face, full body`;

        case "dish":
            return `cute anthropomorphic ${concept || "bowl of borsch soup"} dish mascot character, friendly bowl or plate shape with an expressive face, tiny arms, charming cooking mascot, full body`;

        case "appliance":
            return `cute anthropomorphic ${concept || "frying pan"} kitchen appliance mascot character, cooking tool with a cute smiling face, tiny arms and personality, full body`;

        case "animal":
            return `cute ${concept || "bear"} animal chef mascot character, wearing a chef hat and apron, adorable anthropomorphic animal cooking character, full body`;

        case "trophy":
            return `cute golden ${concept ? concept + " " : ""}cooking trophy award mascot character, shiny trophy cup with a cute smiling face, wearing a tiny chef hat, achievement mascot, full body`;

        default:
            return `cute ${concept || "cooking"} mascot character, kitchen theme, full body`;
    }
}

function buildNegativePrompt(typeId) {
    const universal = [
        // ── Background — most important for our use-case ──────────────────────
        "background",
        "colored background",
        "dark background",
        "gradient background",
        "textured background",
        "pattern background",
        "environment",
        "scene",
        "landscape",
        "room",
        "kitchen background",
        "shadow on background",
        "drop shadow",
        // ── Quality issues ────────────────────────────────────────────────────
        "realistic photograph",
        "photorealistic",
        "photo",
        "blurry",
        "low quality",
        "bad anatomy",
        "deformed",
        "ugly",
        "disfigured",
        "poorly drawn",
        "extra limbs",
        "multiple characters",
        // ── Unwanted elements ─────────────────────────────────────────────────
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
        ingredient: ["real food photo", "non-anthropomorphic food"],
        dish:       ["real food photo", "actual photograph of food"],
        animal:     ["scary", "aggressive", "wild animal attack"],
    };

    return [...universal, ...(typeSpecific[typeId] ?? [])].join(", ");
}

function sanitizePromptFragment(text) {
    if (typeof text !== "string") return "";
    return text
        .trim()
        .slice(0, 100)
        .replace(/[<>{}\[\]\\]/g, "")
        .replace(/\n|\r/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/ignore|system:|override|jailbreak|bypass/gi, "")
        .trim();
}