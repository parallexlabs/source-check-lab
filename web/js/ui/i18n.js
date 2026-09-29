/** @type {Record<string, Record<string, string>>} */
const cache = Object.create(null);

const ALLOWED_LANGS = new Set(["en", "fr"]);

/** @type {'en'|'fr'} */
let currentLang = "en";

/**
 * @param {'en'|'fr'} lang
 */
export function getLang() {
  return currentLang;
}

/**
 * @param {'en'|'fr'} lang
 */
export async function loadLang(lang) {
  if (!ALLOWED_LANGS.has(lang)) {
    throw new Error(`Unsupported language: ${lang}`);
  }
  if (!cache[lang]) {
    const res = await fetch(new URL(`../../i18n/${lang}.json`, import.meta.url));
    if (!res.ok) throw new Error(`i18n load failed: ${lang}`);
    cache[lang] = await res.json();
  }
  currentLang = lang;
  document.documentElement.lang = lang === "fr" ? "fr" : "en";
  applyTranslations();
  toggleFrDisclaimer();
  return cache[lang];
}

function toggleFrDisclaimer() {
  document.querySelectorAll(".fr-disclaimer-prominent").forEach((el) => {
    el.hidden = currentLang !== "fr";
  });
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  const dict = cache[currentLang] ?? cache.en ?? Object.create(null);
  let str = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

export function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      el.placeholder = t(key);
    }
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll("[data-i18n-panel]").forEach((el) => {
    const key = el.getAttribute("data-i18n-panel");
    if (key) el.setAttribute("aria-label", t(key));
  });
  const titleKey = document.body.dataset.pageTitleKey;
  if (titleKey) {
    const pageTitle = t(titleKey);
    const siteName = t("site_title");
    document.title = pageTitle === siteName ? siteName : `${pageTitle} | ${siteName}`;
  }
}

/**
 * @param {() => void} onSwitch
 */
export function bindLangSwitch(onSwitch) {
  const btn = document.getElementById("lang-switch");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const next = currentLang === "en" ? "fr" : "en";
    await loadLang(next);
    btn.textContent = t("lang_switch");
    btn.setAttribute("aria-label", t("lang_switch_aria"));
    onSwitch?.();
  });
}

export async function initI18n() {
  await loadLang("en");
  const btn = document.getElementById("lang-switch");
  if (btn) {
    btn.textContent = t("lang_switch");
    btn.setAttribute("aria-label", t("lang_switch_aria"));
  }
}
