const SORT_OPTIONS = [
  { value: "due", label: "임박순" },
  { value: "recent", label: "최근 날짜순" },
  { value: "oldest", label: "오래된 날짜순" },
  { value: "manual", label: "수동" },
];

let popupAnchorButton = null;

function injectStyles() {
  if (document.querySelector("#quick-sort-popup-style")) return;

  const style = document.createElement("style");
  style.id = "quick-sort-popup-style";
  style.textContent = `
    .section-heading .heading-tools {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .quick-sort-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid rgba(24, 34, 58, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.96);
      color: inherit;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(34, 41, 57, 0.07);
    }

    .quick-sort-trigger .icon {
      font-size: 1rem;
      line-height: 1;
    }

    .quick-sort-popup {
      position: fixed;
      z-index: 999;
      min-width: 220px;
      max-width: min(280px, calc(100vw - 32px));
      padding: 12px;
      border: 1px solid rgba(24, 34, 58, 0.12);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.99);
      box-shadow: 0 18px 40px rgba(34, 41, 57, 0.18);
    }

    .quick-sort-popup[hidden] { display: none; }
    .quick-sort-popup-title { margin: 0 0 8px; font-size: 0.95rem; font-weight: 800; }
    .quick-sort-popup-helper { margin: 8px 4px 0; font-size: 0.82rem; color: #6f7280; line-height: 1.45; }
    .quick-sort-option-list { display: grid; gap: 6px; }

    .quick-sort-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.95rem;
      text-align: left;
      cursor: pointer;
    }

    .quick-sort-option:hover { background: rgba(80, 99, 132, 0.08); }
    .quick-sort-option.is-active { background: rgba(46, 58, 84, 0.1); font-weight: 800; }
    .quick-sort-option-check { opacity: 0; }
    .quick-sort-option.is-active .quick-sort-option-check { opacity: 1; }

    @media (max-width: 640px) {
      .quick-sort-trigger { padding: 8px 10px; font-size: 0.86rem; }
      .quick-sort-popup { min-width: 200px; }
    }
  `;
  document.head.append(style);
}

function getSortSelect() {
  return document.querySelector("#item-sort-mode");
}

function currentMode() {
  const select = getSortSelect();
  return select instanceof HTMLSelectElement && SORT_OPTIONS.some((option) => option.value === select.value)
    ? select.value
    : "due";
}

function currentLabel() {
  return SORT_OPTIONS.find((option) => option.value === currentMode())?.label ?? "임박순";
}

function helperText(mode) {
  if (mode === "recent") return "마지막 완료일이 최근인 항목부터 보여줘요.";
  if (mode === "oldest") return "마지막 완료일이 오래된 항목부터 보여줘요.";
  if (mode === "manual") return "카드의 ≡ 손잡이로 직접 순서를 바꿀 수 있어요.";
  return "기한이 지났거나 얼마 안 남은 항목이 먼저 보여요.";
}

function ensureTools(heading) {
  let tools = heading.querySelector(":scope > .heading-tools");
  if (tools instanceof HTMLElement) return tools;

  tools = document.createElement("div");
  tools.className = "heading-tools";
  const title = heading.querySelector(":scope > h2, :scope > strong");

  for (const child of Array.from(heading.children)) {
    if (child !== title) tools.append(child);
  }

  heading.append(tools);
  return tools;
}

function ensureButtons() {
  for (const view of document.querySelectorAll(".app-view")) {
    const heading = view.querySelector(":scope > .section-heading");
    if (!(heading instanceof HTMLElement)) continue;

    const tools = ensureTools(heading);
    let button = tools.querySelector(":scope > .quick-sort-trigger");
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "quick-sort-trigger";
      button.innerHTML = '<span class="icon" aria-hidden="true">↕</span><span class="label">정렬</span>';
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        togglePopup(button);
      });
      tools.append(button);
    }
  }
  syncButtons();
}

function syncButtons() {
  const label = currentLabel();
  for (const button of document.querySelectorAll(".quick-sort-trigger")) {
    const labelNode = button.querySelector(".label");
    if (labelNode) labelNode.textContent = label;
    button.title = `정렬: ${label}`;
    button.setAttribute("aria-label", `정렬 방식: ${label}`);
  }
}

function ensurePopup() {
  let popup = document.querySelector("#quick-sort-popup");
  if (popup) return popup;

  popup = document.createElement("div");
  popup.id = "quick-sort-popup";
  popup.className = "quick-sort-popup";
  popup.hidden = true;
  popup.setAttribute("role", "dialog");
  popup.innerHTML = '<p class="quick-sort-popup-title">정렬 방식</p><div class="quick-sort-option-list"></div><p class="quick-sort-popup-helper"></p>';
  document.body.append(popup);

  const list = popup.querySelector(".quick-sort-option-list");
  for (const option of SORT_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-sort-option";
    button.dataset.sortMode = option.value;
    button.innerHTML = `<span>${option.label}</span><span class="quick-sort-option-check" aria-hidden="true">✓</span>`;
    button.addEventListener("click", () => {
      applyMode(option.value);
      closePopup();
    });
    list.append(button);
  }
  return popup;
}

function syncPopup() {
  const popup = ensurePopup();
  const mode = currentMode();
  for (const button of popup.querySelectorAll(".quick-sort-option")) {
    button.classList.toggle("is-active", button.dataset.sortMode === mode);
  }
  const helper = popup.querySelector(".quick-sort-popup-helper");
  if (helper) helper.textContent = helperText(mode);
}

function positionPopup(button) {
  const popup = ensurePopup();
  const rect = button.getBoundingClientRect();
  const width = 240;
  const margin = 16;
  const left = Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin);
  popup.style.left = `${left}px`;
  popup.style.top = `${rect.bottom + 8}px`;
}

function openPopup(button) {
  const popup = ensurePopup();
  popupAnchorButton = button;
  syncPopup();
  positionPopup(button);
  popup.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

function closePopup() {
  const popup = ensurePopup();
  popup.hidden = true;
  popupAnchorButton?.setAttribute("aria-expanded", "false");
  popupAnchorButton = null;
}

function togglePopup(button) {
  const popup = ensurePopup();
  if (!popup.hidden && popupAnchorButton === button) closePopup();
  else openPopup(button);
}

function notifySortChanged() {
  window.dispatchEvent(new CustomEvent("app:sort-changed", { detail: { mode: currentMode() } }));
}

function applyMode(mode) {
  const select = getSortSelect();
  if (!(select instanceof HTMLSelectElement)) return;
  if (!SORT_OPTIONS.some((option) => option.value === mode)) return;

  select.value = mode;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  syncButtons();
  syncPopup();
  notifySortChanged();
}

injectStyles();
ensurePopup();
ensureButtons();
syncPopup();

document.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement && event.target.id === "item-sort-mode") {
    syncButtons();
    syncPopup();
    notifySortChanged();
  }
});

document.addEventListener("click", (event) => {
  const popup = document.querySelector("#quick-sort-popup");
  if (!(popup instanceof HTMLElement) || popup.hidden) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("#quick-sort-popup") && !target?.closest(".quick-sort-trigger")) closePopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePopup();
});

window.addEventListener("resize", () => {
  if (popupAnchorButton) positionPopup(popupAnchorButton);
});

window.addEventListener("scroll", () => {
  if (popupAnchorButton) positionPopup(popupAnchorButton);
}, true);

const observer = new MutationObserver(() => ensureButtons());
observer.observe(document.body, { childList: true, subtree: true });
