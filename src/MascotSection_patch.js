// ═══════════════════════════════════════════════════════════════════════════════
// ІНСТРУКЦІЯ З ІНТЕГРАЦІЇ ГЕНЕРАТОРА МАСКОТІВ
// ═══════════════════════════════════════════════════════════════════════════════
//
// КРОКИ:
//  1. Скопіюй нові файли в проект:
//       src/ai/stabilityClient.js
//       src/ai/mascotService.js
//       src/ai/prompts/mascotPrompt.js
//       src/ai/validators/mascotValidator.js
//
//  2. Отримай Stability AI API ключ:
//       → https://platform.stability.ai/account/keys
//       → Реєстрація безкоштовна, є 25 безкоштовних кредитів
//       → Ключ починається з "sk-..."
//
//  3. Для продакшн — додай у .env:
//       VITE_STABILITY_API_KEY=sk-xxxxxxxxxx
//
//  4. Застосуй зміни до App.js (описано нижче як patch)
//
// ═══════════════════════════════════════════════════════════════════════════════
// APP.JS — ЗМІНИ ЯКІ ПОТРІБНО ЗРОБИТИ
// ═══════════════════════════════════════════════════════════════════════════════

// ── КРОК 1: Додай нові імпорти на початок App.js ──────────────────────────────

/*
import { generateMascot, generateMascotVariants } from "./ai/mascotService";
import {
    MASCOT_TYPES,
    MASCOT_STYLES,
    MASCOT_PERSONALITIES,
    MASCOT_COLORS,
} from "./ai/prompts/mascotPrompt";
*/

// ── КРОК 2: Додай новий таб у масив TABS ─────────────────────────────────────

/*
const TABS = [
    { id: "notifications", label: "🔔 Сповіщення"   },
    { id: "sanitizer",     label: "🛡️ Sanitizer"    },
    { id: "photo",         label: "📷 Фото → Рецепти" },
    { id: "comment",       label: "💬 Текст → Рецепти" },
    { id: "verify",        label: "✅ Перевірка кроку" },
    { id: "mascot",        label: "🎨 Маскоти"       },  // ← НОВИЙ
];
*/

// ── КРОК 3: В AppInner додай стейт і хендлер для Stability ключа ─────────────

/*
const [stabilityKey, setStabilityKey] = useState(() => {
    const saved = localStorage.getItem("stability_test_key") || "";
    if (saved) window.__STABILITY_TEST_KEY__ = saved;
    return saved;
});
const stabilityKeyOk = stabilityKey.trim().startsWith("sk-");

const handleStabilityKey = (v) => {
    setStabilityKey(v);
    localStorage.setItem("stability_test_key", v);
    window.__STABILITY_TEST_KEY__ = v.trim();
};
*/

// ── КРОК 4: Додай другий рядок в API бар ─────────────────────────────────────
//  (після існуючого рядка з GROQ KEY, всередині <div style={S.apiBar}>)

/*
<div style={{ borderTop: "1px solid #1e1e30", paddingTop: 8, marginTop: 6,
              display: "flex", gap: 10, alignItems: "center" }}>
    <span style={S.apiDot(stabilityKeyOk)} />
    <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
        STABILITY KEY
    </span>
    <input
        type="text"
        style={S.apiInput}
        value={stabilityKey}
        onChange={e => handleStabilityKey(e.target.value)}
        placeholder="sk-xxxxxxxxxxxxxxxx"
    />
    <span style={{ fontSize: 10, color: stabilityKeyOk ? "#22c55e" : "#ef4444" }}>
        {stabilityKeyOk ? "OK" : "MISSING"}
    </span>
</div>
*/

// ── КРОК 5: Додай рендер нового таба ─────────────────────────────────────────
/*
    {tab === "mascot" && <MascotSection />}
*/


// ════════════════════════════════════════════════════════════════════════════════
// ПОВНИЙ KOД КОМПОНЕНТА MascotSection
// Вставити в App.js поруч з іншими Section-компонентами
// ════════════════════════════════════════════════════════════════════════════════

function MascotSection() {
    const [config, setConfig] = useState({
        type:        "chef",
        style:       "cartoon",
        personality: "happy",
        color:       "red",
        subjectName:  "",
        extraDetails: "",
    });
    const [status,      setStatus]      = useState(null);
    const [result,      setResult]      = useState(null);
    const [gallery,     setGallery]     = useState([]);  // { id, imageDataUrl, seed, label }
    const [showPrompt,  setShowPrompt]  = useState(false);
    const [fullView,    setFullView]    = useState(null); // enlarged gallery image URL

    const { success, error: notifyError, info } = useNotifications();

    const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

    // ── Generate one mascot ────────────────────────────────────────────────────
    const generate = async () => {
        setStatus({ type: "loading", msg: "Відправляємо запит до Stability AI..." });
        setResult(null);

        const r = await generateMascot(config);

        if (!r.success) {
            setStatus({ type: "error", msg: r.error });
            notifyError("Помилка генерації", r.error);
            return;
        }

        setResult(r);
        setStatus({ type: "success", msg: `Маскот готовий! Seed: ${r.seed}` });

        const typeLabel = Object.values(MASCOT_TYPES).find(t => t.id === config.type)?.label ?? config.type;
        const newItem = {
            id: Date.now(),
            imageDataUrl: r.imageDataUrl,
            seed:   r.seed,
            config: r.config,
            label:  `${typeLabel} #${gallery.length + 1}`,
        };
        setGallery(prev => [newItem, ...prev].slice(0, 12));
        success(`🎨 ${typeLabel} готовий!`, `Seed: ${r.seed}. Натисни ⬇ щоб завантажити.`);
    };

    // ── Download helper ────────────────────────────────────────────────────────
    const downloadImage = (dataUrl, filename = "mascot.png") => {
        const a = document.createElement("a");
        a.href     = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        info("Завантаження", `${filename} збережено.`);
    };

    // ── Which types need a subject input? ─────────────────────────────────────
    const typeWithSubject = ["ingredient", "dish", "appliance", "animal"];
    const needsSubject    = typeWithSubject.includes(config.type);
    const currentType     = Object.values(MASCOT_TYPES).find(t => t.id === config.type);

    // ── Selector button style helper ──────────────────────────────────────────
    const selBtn = (active, activeColor = "#6d28d9", activeBg = "#18082a", activeText = "#a78bfa") => ({
        padding:     "7px 12px",
        borderRadius: 6,
        border:      `1px solid ${active ? activeColor : "#1e1e30"}`,
        background:  active ? activeBg : "#0a0a0f",
        color:       active ? activeText : "#555",
        cursor:      "pointer",
        fontSize:    11,
        fontFamily:  "inherit",
        transition:  "all 0.15s",
        letterSpacing: "0.02em",
    });

    return (
        <div>
            {/* ── API key reminder ─────────────────────────────────────────── */}
            <div style={{
                background: "#0f0a1a",
                border:     "1px solid #312060",
                borderLeft: "3px solid #7c3aed",
                borderRadius: 8,
                padding:    "10px 14px",
                marginBottom: 16,
                fontSize:   11,
                color:      "#666",
                lineHeight: 1.7,
            }}>
                <span style={{ color: "#a78bfa", fontWeight: 700 }}>🎨 Stability AI</span> &nbsp;→&nbsp;
                Потрібен окремий ключ від &nbsp;
                <span style={{ color: "#7c3aed" }}>platform.stability.ai</span>.
                Введи його в рядку STABILITY KEY вгорі. &nbsp;
                Ціна: ~$0.03/зображення (Core). Перші 25 кредитів — безкоштовно.
            </div>

            {/* ── Main config card ─────────────────────────────────────────── */}
            <div style={S.card}>
                <div style={S.cardTitle}>🎨 Генератор маскотів</div>
                <div style={S.cardDesc}>
                    Створюй унікальних персонажів для своєї кулінарної гри.
                    Оберіть тип, стиль, характер і колір — решту зробить AI.
                </div>

                {/* TYPE */}
                <span style={S.label}>ТИП МАСКОТА</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {Object.values(MASCOT_TYPES).map(t => (
                        <button key={t.id} onClick={() => update("type", t.id)}
                                style={selBtn(config.type === t.id, "#6d28d9", "#18082a", "#a78bfa")}
                                title={t.description}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* STYLE */}
                <span style={S.label}>СТИЛЬ ЗОБРАЖЕННЯ</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {Object.values(MASCOT_STYLES).map(s => (
                        <button key={s.id} onClick={() => update("style", s.id)}
                                style={selBtn(config.style === s.id, "#0369a1", "#082030", "#38bdf8")}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* PERSONALITY */}
                <span style={S.label}>ХАРАКТЕР / НАСТРІЙ</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {Object.values(MASCOT_PERSONALITIES).map(p => (
                        <button key={p.id} onClick={() => update("personality", p.id)}
                                style={selBtn(config.personality === p.id, "#065f46", "#0a2010", "#34d399")}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* COLOR */}
                <span style={S.label}>КОЛЬОРОВА СХЕМА</span>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                    {MASCOT_COLORS.map(c => (
                        <button key={c.id} title={c.label} onClick={() => update("color", c.id)}
                                style={{
                                    width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                                    border:   config.color === c.id ? "3px solid #fff" : "2px solid #1e1e30",
                                    outline:  config.color === c.id ? "2px solid #7c3aed" : "none",
                                    background: c.hex
                                        ? c.hex
                                        : "conic-gradient(#ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                                    transition: "all 0.15s",
                                    flexShrink: 0,
                                }}
                        />
                    ))}
                    <span style={{ fontSize: 10, color: "#444", marginLeft: 4 }}>
                        {MASCOT_COLORS.find(c => c.id === config.color)?.label}
                    </span>
                </div>

                {/* SUBJECT + EXTRA */}
                <div style={S.grid2}>
                    <div>
                        {needsSubject && currentType?.subjectLabel && (
                            <>
                                <span style={S.label}>{currentType.subjectLabel}</span>
                                <input
                                    style={{ ...S.input, marginBottom: 10 }}
                                    value={config.subjectName}
                                    onChange={e => update("subjectName", e.target.value)}
                                    placeholder={currentType.subjectPlaceholder ?? ""}
                                    maxLength={80}
                                />
                            </>
                        )}
                        <span style={S.label}>ДОДАТКОВІ ДЕТАЛІ (англійською, необов'язково)</span>
                        <textarea
                            style={{ ...S.textarea, minHeight: 60 }}
                            value={config.extraDetails}
                            onChange={e => update("extraDetails", e.target.value)}
                            placeholder="e.g. wearing sunglasses, with a crown, on fire..."
                            maxLength={200}
                        />
                        <div style={{ fontSize: 9, color: "#333", marginTop: 4 }}>
                            Деталі вводяться англійською — Stability AI краще розуміє EN
                        </div>
                    </div>

                    <div>
                        {/* Live config preview */}
                        <div style={{ ...S.result, borderColor: "#1e1e30", height: "100%" }}>
                            <div style={S.resultTitle}>ПОТОЧНА КОНФІГУРАЦІЯ</div>
                            <pre style={{ ...S.pre(true), color: "#555", fontSize: 10 }}>
{JSON.stringify({
    type:        Object.values(MASCOT_TYPES).find(t => t.id === config.type)?.label,
    style:       Object.values(MASCOT_STYLES).find(s => s.id === config.style)?.label,
    personality: Object.values(MASCOT_PERSONALITIES).find(p => p.id === config.personality)?.label,
    color:       MASCOT_COLORS.find(c => c.id === config.color)?.label,
    subject:     config.subjectName  || "—",
    extras:      config.extraDetails || "—",
}, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Generate button */}
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                        style={{
                            ...S.btn, ...S.btnPrimary,
                            opacity: status?.type === "loading" ? 0.6 : 1,
                            minWidth: 180,
                        }}
                        onClick={generate}
                        disabled={status?.type === "loading"}
                    >
                        {status?.type === "loading" ? "⏳ Генерую..." : "✨ Згенерувати маскота"}
                    </button>
                </div>

                <StatusLine status={status} />
            </div>

            {/* ── Result card ──────────────────────────────────────────────── */}
            {result && (
                <div style={S.card}>
                    <div style={S.cardTitle}>✨ Результат генерації</div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>

                        {/* Image */}
                        <div style={{ flexShrink: 0 }}>
                            <img
                                src={result.imageDataUrl}
                                alt="Generated mascot"
                                style={{
                                    width: 280, height: 280,
                                    objectFit:    "contain",
                                    borderRadius: 12,
                                    border:       "1px solid #1e1e30",
                                    background:   "#ffffff",
                                    display:      "block",
                                    cursor:       "zoom-in",
                                }}
                                onClick={() => setFullView(result.imageDataUrl)}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button
                                    style={{ ...S.btn, ...S.btnPrimary, ...S.btnSm }}
                                    onClick={() => downloadImage(result.imageDataUrl, `mascot-${result.seed}.png`)}
                                >
                                    ⬇ PNG
                                </button>
                                <button
                                    style={{ ...S.btn, background: "#111118", color: "#444", border: "1px solid #1e1e30", ...S.btnSm }}
                                    onClick={() => setShowPrompt(!showPrompt)}
                                >
                                    {showPrompt ? "Сховати промпт" : "Показати промпт"}
                                </button>
                                <button
                                    style={{ ...S.btn, background: "#111118", color: "#444", border: "1px solid #1e1e30", ...S.btnSm }}
                                    onClick={generate}
                                >
                                    🔄 Ще раз
                                </button>
                            </div>
                        </div>

                        {/* Meta */}
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>
                                Seed: <span style={{ color: "#777" }}>{result.seed}</span>
                                <span style={{ fontSize: 9, color: "#333", marginLeft: 8 }}>
                                    (збережи seed щоб відтворити те саме зображення)
                                </span>
                            </div>

                            {showPrompt && (
                                <div style={{ ...S.result, borderColor: "#1e1e30" }}>
                                    <div style={S.resultTitle}>ПРОМПТ, ВІДПРАВЛЕНИЙ ДО STABILITY AI</div>
                                    <pre style={{
                                        ...S.pre(true), color: "#555", fontSize: 10,
                                        whiteSpace: "pre-wrap", lineHeight: 1.6,
                                    }}>
                                        {result.prompt}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Gallery ──────────────────────────────────────────────────── */}
            {gallery.length > 0 && (
                <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={S.cardTitle}>🖼️ Галерея ({gallery.length} / 12)</div>
                        <button
                            style={{ ...S.btn, background: "none", color: "#333", border: "1px solid #1e1e30", ...S.btnSm }}
                            onClick={() => setGallery([])}
                        >
                            Очистити
                        </button>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {gallery.map(item => (
                            <div key={item.id} style={{ textAlign: "center" }}>
                                <div style={{ position: "relative", display: "inline-block" }}>
                                    <img
                                        src={item.imageDataUrl}
                                        alt={item.label}
                                        title={`${item.label} — клік для збільшення`}
                                        style={{
                                            width: 76, height: 76,
                                            objectFit:    "contain",
                                            borderRadius: 8,
                                            border:       "1px solid #1e1e30",
                                            background:   "#fff",
                                            display:      "block",
                                            cursor:       "zoom-in",
                                        }}
                                        onClick={() => setFullView(item.imageDataUrl)}
                                    />
                                    {/* Download overlay */}
                                    <button
                                        title="Завантажити"
                                        onClick={() => downloadImage(item.imageDataUrl, `mascot-${item.seed}.png`)}
                                        style={{
                                            position: "absolute", bottom: 2, right: 2,
                                            width: 20, height: 20,
                                            background: "#111118cc", color: "#a78bfa",
                                            border:       "none",
                                            borderRadius: 4,
                                            cursor:       "pointer",
                                            fontSize:     10,
                                            lineHeight:   "20px",
                                            textAlign:    "center",
                                        }}
                                    >
                                        ⬇
                                    </button>
                                </div>
                                <div style={{ fontSize: 9, color: "#333", marginTop: 3 }}>
                                    {item.label}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 9, color: "#2a2a3a", marginTop: 12 }}>
                        Клік на зображення — збільшити. ⬇ — завантажити. Галерея зникає при перезавантаженні.
                    </div>
                </div>
            )}

            {/* ── Full-screen view ─────────────────────────────────────────── */}
            {fullView && (
                <div
                    onClick={() => setFullView(null)}
                    style={{
                        position:  "fixed",
                        inset:     0,
                        background: "#000000cc",
                        zIndex:    10000,
                        display:   "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor:    "zoom-out",
                    }}
                >
                    <img
                        src={fullView}
                        alt="Full view"
                        style={{
                            maxWidth:  "80vmin",
                            maxHeight: "80vmin",
                            borderRadius: 16,
                            background: "#fff",
                            boxShadow: "0 0 80px #7c3aed40",
                        }}
                    />
                    <div style={{
                        position: "absolute", bottom: "10%",
                        fontSize: 12, color: "#555",
                        letterSpacing: "0.08em",
                    }}>
                        Натисни будь-де щоб закрити
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Export ───────────────────────────────────────────────────────────────────
// This file is a PATCH / INSTRUCTION document.
// Copy the MascotSection function above into App.js.
// Apply all the changes described in the КРОК 1–5 comments at the top.