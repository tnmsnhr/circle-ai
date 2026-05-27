import type { CandidateUiRole } from "./types.js";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

function classHints(el: Element): string {
  return `${el.className ?? ""} ${el.getAttribute("class") ?? ""}`.toLowerCase();
}

function isAvatarLike(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const hint = classHints(el);
  if (/\b(avatar|profile-pic|user-photo)\b/.test(hint)) return true;
  if (el.tagName === "IMG") {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const ratio = r.width / r.height;
      if (ratio > 0.75 && ratio < 1.35 && r.width <= 160) return true;
    }
  }
  return false;
}

/** Generic UI role from DOM — not semantic site meaning. */
export function classifyUiRole(el: Element | null | undefined): CandidateUiRole {
  if (!el || !(el instanceof HTMLElement)) return "unknown";

  let cur: Element | null = el;
  for (let d = 0; cur && d < 8; d++) {
    const tag = cur.tagName;
    const role = (cur.getAttribute("role") || "").toLowerCase();

    if (HEADING_TAGS.has(tag) || role === "heading") return "heading";
    if (tag === "IMG" || role === "img") {
      return isAvatarLike(cur) ? "avatar" : "image";
    }
    if (role === "tab" || cur.getAttribute("aria-selected") != null) {
      const tablist = cur.closest('[role="tablist"], nav, [class*="tab"]');
      if (tablist) return "tab";
    }
    if (
      tag === "BUTTON" ||
      role === "button" ||
      (tag === "INPUT" &&
        ["button", "submit", "reset"].includes(
          (cur as HTMLInputElement).type?.toLowerCase() ?? ""
        ))
    ) {
      return "button";
    }
    if (tag === "A" && cur.hasAttribute("href")) return "link";
    if (role === "link") return "link";
    if (tag === "TD" || tag === "TH" || tag === "TR") return "table-cell";
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      tag === "LABEL" ||
      role === "textbox" ||
      role === "combobox"
    ) {
      return "form-control";
    }
    if (
      role === "status" ||
      /\b(status|badge|notice|alert|banner-message)\b/.test(classHints(cur))
    ) {
      return "status";
    }
    if (
      /\b(card|tile|panel|item|shot|product|listing)\b/.test(classHints(cur)) &&
      (tag === "ARTICLE" || tag === "LI" || tag === "SECTION" || role === "article")
    ) {
      return "card";
    }

    cur = cur.parentElement;
  }

  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize) || 14;
  const weight = style.fontWeight;
  const isBold = weight === "bold" || Number(weight) >= 600;
  if (fontSize >= 20 && isBold) return "heading";
  if (fontSize <= 13 && style.opacity && parseFloat(style.opacity) < 1) {
    return "metadata";
  }
  if (fontSize <= 14 && !isBold) return "metadata";

  return "unknown";
}

export function uiRoleLabel(role: CandidateUiRole): string {
  switch (role) {
    case "heading":
      return "Heading";
    case "metadata":
      return "Metadata";
    case "action":
    case "button":
      return "Actions";
    case "tab":
      return "Tabs";
    case "status":
      return "Status";
    case "link":
      return "Links";
    case "image":
    case "avatar":
      return "Media";
    case "table-cell":
      return "Table";
    case "form-control":
      return "Form";
    case "card":
      return "Card";
    case "region":
      return "Region";
    default:
      return "Content";
  }
}
