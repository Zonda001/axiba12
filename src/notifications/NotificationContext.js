import { createContext, useContext, useState, useCallback, useRef } from "react";

const NotificationContext = createContext(null);

const DEFAULTS = {
    duration: 4000,
    type: "info",
};

let idCounter = 0;

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const timers = useRef({});

    const dismiss = useCallback((id) => {
        // Start exit animation
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, exiting: true } : n))
        );
        // Remove after animation
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }, 320);
    }, []);

    const notify = useCallback(
        ({ type = "info", title, message, duration = DEFAULTS.duration, action }) => {
            const id = ++idCounter;

            setNotifications((prev) => [
                ...prev,
                { id, type, title, message, action, exiting: false },
            ]);

            if (duration > 0) {
                timers.current[id] = setTimeout(() => dismiss(id), duration);
            }

            return id;
        },
        [dismiss]
    );

    // Shorthand helpers
    const success = useCallback((title, message, opts) => notify({ type: "success", title, message, ...opts }), [notify]);
    const error   = useCallback((title, message, opts) => notify({ type: "error",   title, message, ...opts }), [notify]);
    const warning = useCallback((title, message, opts) => notify({ type: "warning", title, message, ...opts }), [notify]);
    const info    = useCallback((title, message, opts) => notify({ type: "info",    title, message, ...opts }), [notify]);

    return (
        <NotificationContext.Provider value={{ notify, dismiss, success, error, warning, info }}>
            {children}
            <NotificationRenderer notifications={notifications} onDismiss={dismiss} />
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
    return ctx;
}

// ─── Renderer (внутрішній) ────────────────────────────────────────────────────

const TYPE_CONFIG = {
    success: {
        icon: "✓",
        accent: "#22c55e",
        bg: "#0a1a0f",
        border: "#166534",
        iconBg: "#14532d",
        iconColor: "#4ade80",
    },
    error: {
        icon: "✕",
        accent: "#ef4444",
        bg: "#1a0a0a",
        border: "#7f1d1d",
        iconBg: "#450a0a",
        iconColor: "#f87171",
    },
    warning: {
        icon: "⚠",
        accent: "#f59e0b",
        bg: "#1a140a",
        border: "#78350f",
        iconBg: "#451a03",
        iconColor: "#fbbf24",
    },
    info: {
        icon: "ℹ",
        accent: "#6d28d9",
        bg: "#0f0a1a",
        border: "#312060",
        iconBg: "#1e0a40",
        iconColor: "#a78bfa",
    },
};

function NotificationRenderer({ notifications, onDismiss }) {
    if (notifications.length === 0) return null;

    return (
        <>
            <style>{`
        @keyframes nb-slide-in {
          from { transform: translateX(calc(100% + 24px)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes nb-slide-out {
          from { transform: translateX(0); opacity: 1; max-height: 120px; margin-bottom: 10px; }
          to   { transform: translateX(calc(100% + 24px)); opacity: 0; max-height: 0; margin-bottom: 0; }
        }
        @keyframes nb-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .nb-item {
          animation: nb-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .nb-item.exiting {
          animation: nb-slide-out 0.32s ease-in forwards;
        }
      `}</style>

            <div
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    pointerEvents: "none",
                    maxWidth: 360,
                    width: "calc(100vw - 48px)",
                }}
            >
                {notifications.map((n) => (
                    <NotificationItem
                        key={n.id}
                        notification={n}
                        onDismiss={onDismiss}
                    />
                ))}
            </div>
        </>
    );
}

function NotificationItem({ notification, onDismiss }) {
    const { id, type, title, message, action, exiting } = notification;
    const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

    return (
        <div
            className={`nb-item${exiting ? " exiting" : ""}`}
            style={{
                pointerEvents: "auto",
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderLeft: `3px solid ${cfg.accent}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                position: "relative",
                overflow: "hidden",
                boxShadow: `0 4px 24px ${cfg.accent}18, 0 2px 8px #00000060`,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                cursor: "default",
            }}
        >
            {/* Icon */}
            <div
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: cfg.iconBg,
                    border: `1px solid ${cfg.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: cfg.iconColor,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                }}
            >
                {cfg.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {title && (
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#e0e0f0",
                            letterSpacing: "0.02em",
                            marginBottom: message ? 3 : 0,
                        }}
                    >
                        {title}
                    </div>
                )}
                {message && (
                    <div
                        style={{
                            fontSize: 11,
                            color: "#777",
                            lineHeight: 1.5,
                            wordBreak: "break-word",
                        }}
                    >
                        {message}
                    </div>
                )}
                {action && (
                    <button
                        onClick={() => {
                            action.onClick?.();
                            onDismiss(id);
                        }}
                        style={{
                            marginTop: 8,
                            background: "none",
                            border: `1px solid ${cfg.border}`,
                            borderRadius: 4,
                            color: cfg.iconColor,
                            fontSize: 10,
                            padding: "3px 10px",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            letterSpacing: "0.06em",
                            fontWeight: 600,
                            transition: "all 0.15s",
                        }}
                    >
                        {action.label}
                    </button>
                )}
            </div>

            {/* Close button */}
            <button
                onClick={() => onDismiss(id)}
                style={{
                    background: "none",
                    border: "none",
                    color: "#444",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                    padding: "2px 4px",
                    borderRadius: 3,
                    flexShrink: 0,
                    transition: "color 0.15s",
                    fontFamily: "inherit",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
            >
                ✕
            </button>

            {/* Progress bar */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: 2,
                    background: cfg.accent,
                    opacity: 0.6,
                    animation: `nb-progress ${notification.duration ?? 4000}ms linear forwards`,
                    animationPlayState: exiting ? "paused" : "running",
                }}
            />
        </div>
    );
}