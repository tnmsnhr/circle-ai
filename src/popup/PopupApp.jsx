import React, { useEffect, useState } from "react";
import {
  loadSettings,
  saveSettings,
  applyThemeToDocument,
} from "./settings.js";

export default function PopupApp() {
  const [theme, setTheme] = useState("system");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setTheme(s.theme);
      setEnabled(s.enabled);
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
    await persist({ theme: value }, "Theme updated");
  };

  const onEnabledChange = async (e) => {
    const value = e.target.checked;
    setEnabled(value);
    await persist({ enabled: value }, value ? "Extension enabled" : "Extension disabled");
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
      <h1>Circle AI</h1>
      <p className="subtitle">Configure how the extension behaves on pages.</p>

      <section className="popup-section">
        <h2>Appearance</h2>
        <div className="field">
          <label htmlFor="theme">Theme</label>
          <select id="theme" value={theme} onChange={onThemeChange}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <p className="hint">Applies to this settings panel. Page overlay theming coming soon.</p>
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
        <p className="hint">Hold ⌘ and drag on any page to draw a selection.</p>
      </section>

      <p className="status" aria-live="polite">
        {status}
      </p>

      <p className="popup-footer">Draw on Any Page · v1.0.0</p>
    </div>
  );
}
