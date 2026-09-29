import { initI18n, bindLangSwitch, t } from "./i18n.js";

let dirty = false;

export function markDirty() {
  dirty = true;
}

export function clearDirty() {
  dirty = false;
}

export function initApp({ onLangChange } = {}) {
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = t("unsaved_warning");
    }
  });

  return initI18n().then(() => {
    bindLangSwitch(onLangChange);
  });
}

/**
 * @param {string} message
 */
export function announce(message) {
  const live = document.getElementById("live-region");
  if (live) live.textContent = message;
}
