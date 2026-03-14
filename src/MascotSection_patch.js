// ═══════════════════════════════════════════════════════════════════════════════
// MASCOT SECTION  —  вставити в App.js замість існуючого MascotSection
//
// Імпорти, які треба мати на початку App.js:
//   import { generateMascot, generateMascotEmotionSet } from "./ai/mascotService";
//   import {
//       MASCOT_TYPES, MASCOT_STYLES, MASCOT_PERSONALITIES, MASCOT_COLORS,
//       MASCOT_EMOTIONS,
//   } from "./ai/prompts/mascotPrompt";
// ═══════════════════════════════════════════════════════════════════════════════

const LS_KEY = "cooking_app_mascots_v1";

function loadSavedMascots() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function saveMascots(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 20))); } catch {}
}
function countWords(s) { return s.trim().split(/\s+/).filter(Boolean).length; }
function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Selector button ────────────────────────────────────────────────────────────
function SelBtn({ active, children, onClick, accentColor = G.accent, accentBg = "#18082a", accentText = G.accentHi, title }) {
    return (
        <button title={title} onClick={onClick} style={{
            padding: "7px 13px", borderRadius: 7,
            border:      `1px solid ${active ? accentColor : G.border}`,
            background:  active ? accentBg  : G.bgDeep,
            color:       active ? accentText : G.textDim,
            cursor: "pointer", fontSize: 11, fontFamily: G.mono,
            fontWeight: active ? 700 : 400, transition: "all 0.12s", letterSpacing: "0.02em",
        }}>{children}</button>
    );
}

// ── Gallery card ───────────────────────────────────────────────────────────────
function MascotCard({ item, onDownload, onDelete, onClick }) {
    const typeMeta = Object.values(MASCOT_TYPES).find(t => t.id === item.config?.type);
    return (
        <div style={{
            background: G.bgDeep, border: `1px solid ${G.border}`,
            borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column",
            transition: "border-color 0.15s",
        }}
             onMouseEnter={e => e.currentTarget.style.borderColor = G.accentLo}
             onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
        >
            <div style={{ position: "relative", background: "#fff", aspectRatio: "1/1", overflow: "hidden", cursor: "zoom-in" }}
                 onClick={() => onClick(item.imageDataUrl)}>
                <img src={item.imageDataUrl} alt={item.name}
                     style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top,#000000cc 0%,transparent 50%)",
                    opacity: 0, transition: "opacity 0.2s",
                    display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: 10,
                }}
                     onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                     onMouseLeave={e => e.currentTarget.style.opacity = "0"}>
                    <button onClick={e => { e.stopPropagation(); onDownload(item); }}
                            style={{ background: "#111", color: "#fff", border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 10, cursor: "pointer", fontFamily: G.mono }}>
                        ⬇ PNG
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                            style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 10, cursor: "pointer", fontFamily: G.mono }}>
                        🗑
                    </button>
                </div>
            </div>
            <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e8e8f8", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {typeMeta?.icon ?? "🎨"} {item.name}
                </div>
                {item.description && (
                    <div style={{ fontSize: 10, color: G.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        "{item.description}"
                    </div>
                )}
                <div style={{ fontSize: 9, color: G.textDim, marginTop: 4 }}>
                    {new Date(item.createdAt).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "2-digit" })}
                </div>
            </div>
        </div>
    );
}

// ── Emotion result card ────────────────────────────────────────────────────────
function EmotionCard({ emotion, label, imageDataUrl, seed, onDownload, onClick }) {
    const EMOTION_COLORS = {
        neutral: { border: "#2a2a4a", bg: "#0e0e18", text: "#7070a0", badge: "#14142a", badgeText: "#7070a0" },
        happy:   { border: "#166534", bg: "#0a1a0f", text: "#4ade80", badge: "#0a2010", badgeText: "#4ade80" },
        sad:     { border: "#1d4ed8", bg: "#0a0f1a", text: "#60a5fa", badge: "#0a1020", badgeText: "#60a5fa" },
    };
    const c = EMOTION_COLORS[emotion] ?? EMOTION_COLORS.neutral;

    return (
        <div style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column",
            transition: "transform 0.15s, box-shadow 0.15s",
        }}
             onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${c.border}60`; }}
             onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
        >
            {/* Badge */}
            <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                    background: c.badge, color: c.badgeText,
                    border: `1px solid ${c.border}`, borderRadius: 5,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700, fontFamily: G.mono,
                }}>{label}</span>
                <span style={{ fontSize: 9, color: G.textDim }}>seed {seed}</span>
            </div>

            {/* Image */}
            <div style={{ background: "#ffffff", cursor: "zoom-in", position: "relative" }}
                 onClick={() => onClick(imageDataUrl)}>
                <img src={imageDataUrl} alt={label}
                     style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", display: "block" }} />
            </div>

            {/* Actions */}
            <div style={{ padding: "10px 12px", display: "flex", gap: 8 }}>
                <button onClick={onDownload} style={{
                    flex: 1, background: c.badge, color: c.text,
                    border: `1px solid ${c.border}`, borderRadius: 6,
                    padding: "7px 0", fontSize: 11, cursor: "pointer", fontFamily: G.mono, fontWeight: 700,
                }}>
                    ⬇ PNG
                </button>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
function MascotSection() {
    // ── Config ─────────────────────────────────────────────────────────────────
    const [type,        setType]        = useState("chef");
    const [style,       setStyle]       = useState("cartoon");
    const [personality, setPersonality] = useState("happy");
    const [colorId,     setColorId]     = useState("red");
    const [subjectName, setSubjectName] = useState("");
    const [description, setDescription] = useState("");

    // ── Generation state ───────────────────────────────────────────────────────
    const [status,       setStatus]      = useState(null);          // single generation
    const [emotionStatus, setEmotionStatus] = useState(null);       // emotion-set generation
    const [lastResult,   setLastResult]  = useState(null);          // single result
    const [emotionSet,   setEmotionSet]  = useState(null);          // { emotions, config }
    const [showPrompt,   setShowPrompt]  = useState(false);
    const [activeTab,    setActiveTab]   = useState("emotions");    // "single" | "emotions"

    // ── Gallery ────────────────────────────────────────────────────────────────
    const [gallery,  setGallery]  = useState(() => loadSavedMascots());
    const [lightbox, setLightbox] = useState(null);

    const { success, error: notifyError, info, warning } = useNotifications();

    useEffect(() => { saveMascots(gallery); }, [gallery]);

    // ── Derived ────────────────────────────────────────────────────────────────
    const wordCount      = countWords(description);
    const descOk         = wordCount >= 1 && wordCount <= 5;
    const descWarning    = wordCount > 5;
    const typeWithSubject = ["ingredient", "dish", "appliance", "animal"];
    const needsSubject   = typeWithSubject.includes(type);
    const currentType    = Object.values(MASCOT_TYPES).find(t => t.id === type);
    const colorMeta      = MASCOT_COLORS.find(c => c.id === colorId) ?? MASCOT_COLORS[0];
    const wcColor        = wordCount === 0 ? G.textDim : wordCount <= 3 ? G.green : wordCount <= 5 ? G.amber : G.red;

    const baseConfig = { type, style, personality, color: colorId, subjectName, extraDetails: description };

    // ── Add to gallery helper ──────────────────────────────────────────────────
    const addToGallery = useCallback((imageDataUrl, name, desc, seed, config) => {
        setGallery(prev => [{
            id: Date.now() + Math.random(),
            name, description: desc, imageDataUrl, seed, config,
            createdAt: Date.now(),
        }, ...prev].slice(0, 20));
    }, []);

    // ── Generate single ────────────────────────────────────────────────────────
    const generateSingle = useCallback(async () => {
        const desc = description.trim();
        if (!desc) { warning("Опиши маскота", "Введи 1–5 слів опису перед генерацією."); return; }
        if (wordCount > 5) { warning("Забагато слів", "Максимум 5 слів."); return; }

        setStatus({ type: "loading", msg: "Відправляємо до Stability AI…" });
        setLastResult(null);

        const r = await generateMascot(baseConfig);

        if (!r.success) {
            setStatus({ type: "error", msg: r.error });
            notifyError("Помилка генерації", r.error);
            return;
        }

        setLastResult(r);
        setStatus({ type: "success", msg: `Готово! Seed: ${r.seed}` });

        const typeLabel = Object.values(MASCOT_TYPES).find(t => t.id === type)?.label ?? type;
        addToGallery(r.imageDataUrl, `${typeLabel} — ${desc}`, desc, r.seed, r.config);
        success(`🎨 ${typeLabel} готовий!`, `"${desc}" · Seed ${r.seed}`);
    }, [baseConfig, description, wordCount, type, addToGallery, success, notifyError, warning]);

    // ── Generate emotion set ───────────────────────────────────────────────────
    const generateEmotions = useCallback(async () => {
        const desc = description.trim();
        if (!desc) { warning("Опиши маскота", "Введи 1–5 слів опису перед генерацією."); return; }
        if (wordCount > 5) { warning("Забагато слів", "Максимум 5 слів."); return; }

        setEmotionStatus({ type: "loading", msg: "Генеруємо 3 емоції паралельно… (~30–60с)" });
        setEmotionSet(null);

        const r = await generateMascotEmotionSet(baseConfig);

        if (!r.success) {
            setEmotionStatus({ type: "error", msg: r.error });
            notifyError("Помилка", r.error);
            return;
        }

        setEmotionSet(r);
        const count = r.emotions.length;
        setEmotionStatus({
            type: "success",
            msg: r.partial
                ? `${count}/3 емоцій готові (${r.failedCount} не вдалося)`
                : `✓ Усі 3 емоції згенеровано!`,
        });

        // Save each emotion to gallery
        const typeLabel = Object.values(MASCOT_TYPES).find(t => t.id === type)?.label ?? type;
        r.emotions.forEach(em => {
            addToGallery(em.imageDataUrl, `${typeLabel} ${em.label}`, desc, em.seed, r.config);
        });

        if (r.partial) {
            warning("Частковий результат", `${count} з 3 емоцій збережено у галерею.`);
        } else {
            success("🎭 Набір емоцій готовий!", `Нейтральний, веселий, сумний · "${desc}"`);
        }
    }, [baseConfig, description, wordCount, type, addToGallery, success, notifyError, warning]);

    const handleDownload = (item) => {
        downloadDataUrl(item.imageDataUrl, `mascot-${item.description?.replace(/\s+/g, "-")}-${item.seed}.png`);
        info("Завантаження", `${item.name} збережено.`);
    };
    const handleDelete  = (id) => setGallery(prev => prev.filter(m => m.id !== id));
    const handleClearAll = () => {
        if (!window.confirm("Видалити всі маскоти з галереї?")) return;
        setGallery([]); info("Галерею очищено", "");
    };

    const isLoadingSingle  = status?.type === "loading";
    const isLoadingEmotions = emotionStatus?.type === "loading";
    const isAnyLoading     = isLoadingSingle || isLoadingEmotions;

    return (
        <div>
            {/* ── Key reminder ─────────────────────────────────────────────── */}
            <div style={{
                background: "#0f0a1a", border: `1px solid #312060`, borderLeft: `3px solid ${G.accent}`,
                borderRadius: 9, padding: "10px 16px", marginBottom: 18,
                fontSize: 11, color: G.textMid, lineHeight: 1.7,
            }}>
                <span style={{ color: G.accentHi, fontWeight: 700 }}>Stability AI</span>
                &nbsp;→ потрібен ключ з <span style={{ color: "#7c3aed" }}>platform.stability.ai</span>.
                Введи його у рядок <b>STABILITY KEY</b> вгорі.
                ~$0.03 / зображення; перші 25 кредитів безкоштовно.
                <b style={{ color: G.amber }}> Набір емоцій = 3 запити (~$0.09)</b>.
            </div>

            {/* ── Creator card ──────────────────────────────────────────────── */}
            <div style={S.card}>
                <div style={S.cardTitle}>🎨 Створи свого маскота</div>
                <div style={S.cardDesc}>Опиши у 1–5 словах — AI згенерує набір з 3 емоцій або одне зображення.</div>

                {/* ── Description ─────────────────────────────────────────── */}
                <div style={{
                    background: G.bgDeep,
                    border: `2px solid ${descWarning ? G.red : descOk ? G.accent : G.border}`,
                    borderRadius: 10, padding: "16px 18px", marginBottom: 22,
                    transition: "border-color 0.2s", position: "relative",
                }}>
                    <div style={{
                        fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                        fontWeight: 700, color: descWarning ? G.red : descOk ? G.accentHi : G.textDim,
                    }}>✏️ Опис маскота (1–5 слів)</div>
                    <input
                        style={{
                            ...S.input, fontSize: 18, fontWeight: 700, letterSpacing: "0.04em",
                            padding: "10px 14px", border: "none", background: "transparent",
                            color: descWarning ? G.red : "#e8e8f8",
                        }}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="веселий кіт кухар"
                        maxLength={80}
                        onKeyDown={e => e.key === "Enter" && !isAnyLoading && generateEmotions()}
                    />
                    <div style={{
                        position: "absolute", top: 14, right: 16,
                        fontSize: 11, color: wcColor, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 4,
                    }}>
                        <span style={{ fontSize: 14 }}>
                            {wordCount === 0 ? "—" : wordCount <= 3 ? "✓" : wordCount <= 5 ? "⚡" : "✗"}
                        </span>
                        <span>{wordCount}/5</span>
                    </div>
                    <div style={{ fontSize: 10, color: G.textDim, marginTop: 6 }}>
                        Приклади:&nbsp;
                        {["веселий ведмідь пекар", "злобна каструля", "смілива морква", "мудрий сомельє"].map(ex => (
                            <button key={ex} onClick={() => setDescription(ex)}
                                    style={{ background: "none", border: `1px solid ${G.border}`, borderRadius: 4, color: G.textMid, fontSize: 10, padding: "2px 7px", margin: "0 3px", cursor: "pointer", fontFamily: G.mono }}>
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TYPE */}
                <span style={S.label}>Тип маскота</span>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                    {Object.values(MASCOT_TYPES).map(t => (
                        <SelBtn key={t.id} active={type === t.id} onClick={() => setType(t.id)} title={t.description}>
                            {t.icon} {t.label}
                        </SelBtn>
                    ))}
                </div>

                {/* Subject */}
                {needsSubject && currentType?.subjectLabel && (
                    <>
                        <span style={S.label}>{currentType.subjectLabel}</span>
                        <input style={{ ...S.input, marginBottom: 16 }} value={subjectName}
                               onChange={e => setSubjectName(e.target.value)}
                               placeholder={currentType.subjectPlaceholder ?? ""} maxLength={80} />
                    </>
                )}

                {/* STYLE + PERSONALITY */}
                <div style={S.grid2}>
                    <div>
                        <span style={S.label}>Стиль зображення</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {Object.values(MASCOT_STYLES).map(s => (
                                <SelBtn key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}
                                        accentColor="#0369a1" accentBg="#082030" accentText="#38bdf8">
                                    {s.label}
                                </SelBtn>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span style={S.label}>Базовий характер (тільки для одиночного)</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {Object.values(MASCOT_PERSONALITIES).map(p => (
                                <SelBtn key={p.id} active={personality === p.id} onClick={() => setPersonality(p.id)}
                                        accentColor="#065f46" accentBg="#0a2010" accentText="#34d399">
                                    {p.label}
                                </SelBtn>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLOR */}
                <span style={{ ...S.label, marginTop: 16 }}>Кольорова схема</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
                    {MASCOT_COLORS.map(c => (
                        <button key={c.id} title={c.label} onClick={() => setColorId(c.id)} style={{
                            width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                            border:   colorId === c.id ? "3px solid #fff" : `2px solid ${G.border}`,
                            outline:  colorId === c.id ? `2px solid ${G.accent}` : "none",
                            background: c.hex
                                ? c.hex
                                : "conic-gradient(#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                            transition: "all 0.15s", flexShrink: 0,
                        }} />
                    ))}
                    <span style={{ fontSize: 10, color: G.textDim, marginLeft: 4 }}>{colorMeta.label}</span>
                </div>

                {/* ── Mode tabs + buttons ──────────────────────────────────── */}
                <div style={{
                    background: G.bgDeep, border: `1px solid ${G.border}`,
                    borderRadius: 10, padding: "14px 16px", marginBottom: 18,
                }}>
                    {/* Tab switcher */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        {[
                            { id: "emotions", icon: "🎭", label: "Набір емоцій (3 шт.)" },
                            { id: "single",   icon: "🎨", label: "Один маскот" },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                padding: "8px 16px", borderRadius: 7, cursor: "pointer",
                                border:      `1px solid ${activeTab === tab.id ? G.accent : G.border}`,
                                background:  activeTab === tab.id ? G.accentLo : G.bgCard,
                                color:       activeTab === tab.id ? G.accentHi : G.textDim,
                                fontSize: 11, fontFamily: G.mono, fontWeight: activeTab === tab.id ? 700 : 400,
                                transition: "all 0.15s",
                            }}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Emotion set mode */}
                    {activeTab === "emotions" && (
                        <div>
                            <div style={{ fontSize: 11, color: G.textMid, marginBottom: 12, lineHeight: 1.7 }}>
                                Генерує <b style={{ color: G.accentHi }}>3 однакових персонажі</b> з різними емоціями:
                                &nbsp;
                                {Object.values(MASCOT_EMOTIONS).map(e => (
                                    <span key={e.id} style={{
                                        display: "inline-block", margin: "0 4px",
                                        background: G.bgCard, border: `1px solid ${G.border}`,
                                        borderRadius: 5, padding: "1px 8px", fontSize: 10,
                                    }}>{e.label}</span>
                                ))}
                                <br />
                                <span style={{ fontSize: 10, color: G.textDim }}>
                                    Базовий характер ігнорується — кожна картинка має свою фіксовану емоцію.
                                    Білий фон гарантовано.
                                </span>
                            </div>
                            <button onClick={generateEmotions} disabled={isAnyLoading} style={{
                                ...S.btn, ...S.btnPrimary, fontSize: 13, padding: "11px 28px",
                                opacity: isAnyLoading ? 0.6 : 1,
                                boxShadow: isAnyLoading ? "none" : `0 0 24px ${G.accentLo}80`,
                            }}>
                                {isLoadingEmotions ? "⏳ Генерую 3 емоції…" : "🎭 Згенерувати набір емоцій"}
                            </button>
                            <StatusLine status={emotionStatus} />
                        </div>
                    )}

                    {/* Single mode */}
                    {activeTab === "single" && (
                        <div>
                            <div style={{ fontSize: 11, color: G.textMid, marginBottom: 12, lineHeight: 1.7 }}>
                                Генерує <b style={{ color: "#e8e8f8" }}>одне зображення</b> з обраним характером.
                                &nbsp;Білий фон гарантовано.
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={generateSingle} disabled={isAnyLoading} style={{
                                    ...S.btn, ...S.btnPrimary,
                                    opacity: isAnyLoading ? 0.6 : 1,
                                }}>
                                    {isLoadingSingle ? "⏳ Генерую…" : "✨ Один маскот"}
                                </button>
                                {lastResult && (
                                    <button onClick={generateSingle} disabled={isAnyLoading}
                                            style={{ ...S.btn, ...S.btnGhost, ...S.btnSm }}>
                                        🔄 Ще варіант
                                    </button>
                                )}
                            </div>
                            <StatusLine status={status} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Emotion set result ────────────────────────────────────────── */}
            {emotionSet && (
                <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div>
                            <div style={S.cardTitle}>🎭 Набір емоцій</div>
                            <div style={{ fontSize: 11, color: G.textDim, marginTop: 3 }}>
                                «{description}» · {emotionSet.emotions.length} емоцій · один характер
                            </div>
                        </div>
                        <button onClick={() => {
                            emotionSet.emotions.forEach(em => {
                                downloadDataUrl(em.imageDataUrl, `mascot-${em.emotion}-${em.seed}.png`);
                            });
                            info("Завантаження", "Всі 3 зображення збережено.");
                        }} style={{ ...S.btn, ...S.btnGhost, ...S.btnSm }}>
                            ⬇ Всі PNG
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                        {emotionSet.emotions.map(em => (
                            <EmotionCard
                                key={em.emotion}
                                emotion={em.emotion}
                                label={em.label}
                                imageDataUrl={em.imageDataUrl}
                                seed={em.seed}
                                onClick={setLightbox}
                                onDownload={() => {
                                    downloadDataUrl(em.imageDataUrl, `mascot-${em.emotion}-${em.seed}.png`);
                                    info("Завантаження", `${em.label} збережено.`);
                                }}
                            />
                        ))}
                    </div>

                    {/* Prompt debug */}
                    <div style={{ marginTop: 14 }}>
                        <button onClick={() => setShowPrompt(!showPrompt)}
                                style={{ ...S.btn, ...S.btnGhost, ...S.btnSm, fontSize: 10 }}>
                            {showPrompt ? "Сховати промпти" : "Показати промпти"}
                        </button>
                        {showPrompt && emotionSet.emotions.map(em => (
                            <div key={em.emotion} style={{ ...S.result, marginTop: 10, borderColor: G.border }}>
                                <div style={S.resultTitle}>{em.label} — промпт</div>
                                <pre style={{ ...S.pre(true), color: G.textDim, fontSize: 10, whiteSpace: "pre-wrap" }}>
                                    {em.prompt}
                                </pre>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Single result ─────────────────────────────────────────────── */}
            {lastResult && activeTab === "single" && (
                <div style={S.card}>
                    <div style={S.cardTitle}>✨ Результат</div>
                    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0 }}>
                            <img src={lastResult.imageDataUrl} alt="Generated mascot"
                                 style={{
                                     width: 240, height: 240, objectFit: "contain",
                                     borderRadius: 14, border: `1px solid ${G.border}`,
                                     background: "#fff", display: "block", cursor: "zoom-in",
                                     boxShadow: `0 0 40px ${G.accentLo}40`,
                                 }}
                                 onClick={() => setLightbox(lastResult.imageDataUrl)} />
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button style={{ ...S.btn, ...S.btnPrimary, ...S.btnSm }}
                                        onClick={() => downloadDataUrl(lastResult.imageDataUrl, `mascot-${description.replace(/\s+/g, "-")}-${lastResult.seed}.png`)}>
                                    ⬇ PNG
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 140 }}>
                            <div style={{ fontSize: 12, color: "#e8e8f8", fontWeight: 700, marginBottom: 6 }}>«{description}»</div>
                            <div style={{ fontSize: 11, color: G.textDim }}>
                                Seed: <span style={{ color: G.accentHi }}>{lastResult.seed}</span>
                            </div>
                            <div style={{ fontSize: 10, color: G.green, marginTop: 8 }}>✓ Збережено в галерею</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Gallery ───────────────────────────────────────────────────── */}
            <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <div style={S.cardTitle}>🖼️ Моя галерея</div>
                        <div style={{ fontSize: 11, color: G.textDim, marginTop: 2 }}>
                            {gallery.length} / 20 · localStorage
                        </div>
                    </div>
                    {gallery.length > 0 && (
                        <button style={{ ...S.btn, ...S.btnDanger, ...S.btnSm }} onClick={handleClearAll}>
                            Очистити
                        </button>
                    )}
                </div>

                {gallery.length === 0 ? (
                    <div style={{
                        textAlign: "center", padding: "40px 0", color: G.textDim, fontSize: 13,
                        border: `2px dashed ${G.border}`, borderRadius: 10,
                    }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>🎨</div>
                        Галерея порожня.<br />
                        <span style={{ fontSize: 11 }}>Згенеруй першого маскота вище!</span>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
                        {gallery.map(item => (
                            <MascotCard key={item.id} item={item}
                                        onDownload={handleDownload} onDelete={handleDelete} onClick={setLightbox} />
                        ))}
                    </div>
                )}

                {gallery.length > 0 && (
                    <div style={{ fontSize: 9, color: G.textDim, marginTop: 14, lineHeight: 1.7 }}>
                        💡 Наведи на зображення → ⬇ завантажити / 🗑 видалити. Натисни → повний розмір.
                    </div>
                )}
            </div>

            {/* ── Lightbox ──────────────────────────────────────────────────── */}
            {lightbox && (
                <div onClick={() => setLightbox(null)} style={{
                    position: "fixed", inset: 0, background: "#000000d0",
                    zIndex: 10000, display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "zoom-out",
                }}>
                    <img src={lightbox} alt="Full view" style={{
                        maxWidth: "85vmin", maxHeight: "85vmin",
                        borderRadius: 18, background: "#fff",
                        boxShadow: `0 0 80px ${G.accent}50`,
                    }} />
                    <div style={{ position: "absolute", bottom: "8%", fontSize: 11, color: "#666", letterSpacing: "0.08em" }}>
                        Натисни будь-де щоб закрити
                    </div>
                </div>
            )}
        </div>
    );
}