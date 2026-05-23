import React, { useEffect, useState } from "react";
import {
  loadSettings,
  saveSettings,
  applyThemeToDocument,
  LASSO_THEMES,
} from "./settings.js";

export default function PopupApp() {
  const [theme, setTheme] = useState("system");
  const [lassoTheme, setLassoTheme] = useState("emerald");
  const [enabled, setEnabled] = useState(true);
  const [autoCollapse, setAutoCollapse] = useState(true);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setTheme(s.theme);
      setLassoTheme(s.lassoTheme);
      setEnabled(s.enabled);
      setAutoCollapse(s.autoCollapse !== false);
      applyThemeToDocument(s.theme);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") applyThemeToDocument("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, ready]);

  const persist = async (partial, message) => {
    await saveSettings(partial);
    setStatus(message || "Saved");
    setTimeout(() => setStatus(""), 1500);
  };

  const onThemeChange = async (e) => {
    const value = e.target.value;
    setTheme(value);
    applyThemeToDocument(value);
    await persist({ theme: value }, "Panel theme updated");
  };

  const onLassoThemeSelect = async (id) => {
    setLassoTheme(id);
    const name = LASSO_THEMES.find((t) => t.id === id)?.name ?? id;
    await persist({ lassoTheme: id }, `${name} lasso colors applied`);
  };

  const onEnabledChange = async (e) => {
    const value = e.target.checked;
    setEnabled(value);
    await persist(
      { enabled: value },
      value ? "Extension enabled" : "Extension disabled"
    );
  };

  const onAutoCollapseChange = async (e) => {
    const value = e.target.checked;
    setAutoCollapse(value);
    await persist(
      { autoCollapse: value },
      value ? "Auto-collapse on scroll enabled" : "Auto-collapse on scroll disabled"
    );
  };

  if (!ready) {
    return (
      <div className="popup-app">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  return (
    <div className="popup-app">
      <h1>Syncle</h1>
      <p className="subtitle">Configure how the extension behaves on pages.</p>

      <section className="popup-section">
        <h2>Lasso colors</h2>
        <p className="hint section-hint">
          Border and fill for selections on the page.
        </p>
        <div className="lasso-theme-grid" role="listbox" aria-label="Lasso color theme">
          {LASSO_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={lassoTheme === t.id}
              className={`lasso-theme-swatch${lassoTheme === t.id ? " is-selected" : ""}`}
              title={t.name}
              onClick={() => onLassoThemeSelect(t.id)}
            >
              <span
                className="lasso-theme-swatch__ring"
                style={{ borderColor: t.border, background: t.fill }}
              />
              <span className="lasso-theme-swatch__label">{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="popup-section">
        <h2>Popup appearance</h2>
        <div className="field">
          <label htmlFor="theme">Panel theme</label>
          <select id="theme" value={theme} onChange={onThemeChange}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className="popup-section">
        <h2>General</h2>
        <div className="field">
          <label htmlFor="enabled">Drawing enabled</label>
          <label className="toggle">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={onEnabledChange}
            />
            <span />
          </label>
        </div>
        <p className="hint">Hold ⌘ or Ctrl and drag on any page to draw.</p>
        <div className="field">
          <label htmlFor="autoCollapse">Auto-collapse on scroll</label>
          <label className="toggle">
            <input
              id="autoCollapse"
              type="checkbox"
              checked={autoCollapse}
              onChange={onAutoCollapseChange}
            />
            <span />
          </label>
        </div>
        <p className="hint">
          When on, chat bubbles shrink to dots after you scroll about 100px. You
          can still minimize manually with the yellow button.
        </p>
      </section>

      <p className="status" aria-live="polite">
        {status}
      </p>

      <p className="popup-footer">Syncle · v1.0.0</p>
    </div>
  );
}
