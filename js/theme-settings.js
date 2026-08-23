import { supabase } from "./supabase.js";

const THEME_KEY = "when-did-i-do-it-theme";
const THEMES = new Set(["light", "dark", "olivecream"]);
let themeMessage = null;

function normalizeTheme(value) {
  return THEMES.has(value) ? value : "olivecream";
}

function ensureThemeStyles() {
  if (document.querySelector("#app-theme-styles")) return;

  const style = document.createElement("style");
  style.id = "app-theme-styles";
  style.textContent = `
    html[data-theme="light"] {
      color-scheme: light;
      --comfort-bg: #f4f4f1;
      --comfort-surface: #ffffff;
      --comfort-surface-soft: #f7f7f4;
      --comfort-sage: #eef1ec;
      --comfort-sage-strong: #e1e7df;
      --comfort-border: #d9ddd7;
      --comfort-border-soft: #e8eae6;
      --comfort-text: #30332f;
      --comfort-muted: #737972;
      --comfort-accent: #687968;
      --comfort-accent-dark: #566657;
      --comfort-accent-soft: #edf1ec;
      --comfort-danger: #9a5d58;
      --theme-card: #ffffff;
      --theme-panel: #f7f7f4;
      --theme-input: #ffffff;
      --theme-nav: rgba(255, 255, 255, 0.97);
      --theme-hover: #edf1ec;
      --theme-shadow: rgba(56, 61, 55, 0.10);
    }

    html[data-theme="olivecream"] {
      color-scheme: light;
      --comfort-bg: #f2ecdf;
      --comfort-surface: #fffaf0;
      --comfort-surface-soft: #f7f1e5;
      --comfort-sage: #eef0df;
      --comfort-sage-strong: #e1e5ce;
      --comfort-border: #d8d3c3;
      --comfort-border-soft: #e6e0d2;
      --comfort-text: #34362d;
      --comfort-muted: #747667;
      --comfort-accent: #727b4d;
      --comfort-accent-dark: #59633d;
      --comfort-accent-soft: #ecefdc;
      --comfort-danger: #9a5d58;
      --theme-card: #fffdf6;
      --theme-panel: #f7f1e5;
      --theme-input: #fffdf7;
      --theme-nav: rgba(255, 250, 240, 0.97);
      --theme-hover: #ecefdc;
      --theme-shadow: rgba(71, 70, 51, 0.11);
    }

    html[data-theme="dark"] {
      color-scheme: dark;
      --comfort-bg: #1d211d;
      --comfort-surface: #272c27;
      --comfort-surface-soft: #222722;
      --comfort-sage: #303831;
      --comfort-sage-strong: #39423a;
      --comfort-border: #444c44;
      --comfort-border-soft: #353d36;
      --comfort-text: #f0eee7;
      --comfort-muted: #adb4aa;
      --comfort-accent: #91a48a;
      --comfort-accent-dark: #71856d;
      --comfort-accent-soft: #354137;
      --comfort-danger: #d69a94;
      --theme-card: #2b302b;
      --theme-panel: #242924;
      --theme-input: #303630;
      --theme-nav: rgba(39, 44, 39, 0.97);
      --theme-hover: #354137;
      --theme-shadow: rgba(0, 0, 0, 0.28);
    }

    html[data-theme] body {
      background: var(--comfort-bg) !important;
      color: var(--comfort-text) !important;
    }

    html[data-theme] .card {
      background: var(--comfort-surface) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
      box-shadow: 0 10px 30px var(--theme-shadow) !important;
    }

    html[data-theme] .app-card > section,
    html[data-theme] .settings-block,
    html[data-theme] .taxonomy-block,
    html[data-theme] .history-calendar-card,
    html[data-theme] .history-record-card {
      background: var(--theme-panel) !important;
      border-color: var(--comfort-border-soft) !important;
    }

    html[data-theme] .item-form,
    html[data-theme] .item-card,
    html[data-theme] .category-item,
    html[data-theme] .taxonomy-row,
    html[data-theme] .history-record-row,
    html[data-theme] .record-item-button,
    html[data-theme] .subitem-progress,
    html[data-theme] .subitem-manager-row,
    html[data-theme] .subitem-history-row {
      background: var(--theme-card) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
    }

    html[data-theme] input,
    html[data-theme] select,
    html[data-theme] textarea,
    html[data-theme] .subitem-manager-row input,
    html[data-theme] .subitem-add-form input {
      background: var(--theme-input) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
    }

    html[data-theme] button.secondary,
    html[data-theme] .category-filter-button:not(.is-active),
    html[data-theme] .record-item-button,
    html[data-theme] .subitem-manager-close,
    html[data-theme] .subitem-inline-manage-button,
    html[data-theme] .subitem-inline-action-close,
    html[data-theme] .item-action-dialog-close {
      background: var(--theme-input) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
    }

    html[data-theme] button.primary,
    html[data-theme] .bottom-nav-button.is-active,
    html[data-theme] .category-filter-button.is-active {
      background: var(--comfort-accent-dark) !important;
      border-color: var(--comfort-accent-dark) !important;
      color: #fffdf8 !important;
    }

    html[data-theme] .bottom-nav {
      background: var(--theme-nav) !important;
      border-color: var(--comfort-border) !important;
      box-shadow: 0 12px 34px var(--theme-shadow) !important;
    }

    html[data-theme] .taxonomy-modal,
    html[data-theme] .history-modal,
    html[data-theme] .quick-add-modal,
    html[data-theme] .item-action-dialog,
    html[data-theme] .subitem-manager-dialog,
    html[data-theme] .subitem-inline-action-dialog,
    html[data-theme] .app-action-dialog,
    html[data-theme] .quick-taxonomy-dialog {
      background: var(--comfort-surface) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
      box-shadow: 0 22px 64px var(--theme-shadow) !important;
    }

    html[data-theme] .item-action-dialog-list button,
    html[data-theme] .subitem-inline-action-list button,
    html[data-theme] .subitem-manager-row button,
    html[data-theme] .quick-taxonomy-dialog-actions button.quick-taxonomy-cancel {
      background: var(--theme-input) !important;
      border-color: var(--comfort-border) !important;
      color: var(--comfort-text) !important;
    }

    html[data-theme] .item-action-dialog-list button:hover,
    html[data-theme] .subitem-inline-action-list button:hover,
    html[data-theme] .subitem-check-row.is-inline-action-row:hover,
    html[data-theme] button.secondary:hover,
    html[data-theme] .record-item-button:hover {
      background: var(--theme-hover) !important;
    }

    html[data-theme] .muted,
    html[data-theme] .helper,
    html[data-theme] .description,
    html[data-theme] .message,
    html[data-theme] .account-email,
    html[data-theme] .item-meta,
    html[data-theme] .item-category-badge,
    html[data-theme] .record-item-meta,
    html[data-theme] .history-weekdays {
      color: var(--comfort-muted) !important;
    }

    html[data-theme="dark"] .history-calendar-day {
      color: #d9ddd5;
    }

    html[data-theme="dark"] .history-calendar-day.is-today {
      color: #e5aa92 !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-record {
      color: #edf3ea !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-record::before {
      background: #526451 !important;
      border-color: #728570 !important;
    }

    html[data-theme="dark"] .history-calendar-day.is-today:not(.has-record)::before {
      border-color: #c98c75 !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-record.is-today::before {
      box-shadow: 0 0 0 2px var(--comfort-sage), 0 0 0 3px #c98c75 !important;
    }

    html[data-theme="light"] .history-calendar-day.has-record::before {
      background: #dce5da !important;
      border-color: #b5c3b2 !important;
    }

    html[data-theme="olivecream"] .history-calendar-day.has-record::before {
      background: #d8dfbf !important;
      border-color: #b7c08e !important;
    }

    .theme-setting-block {
      display: grid;
      gap: 12px;
    }

    .theme-choice-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .theme-choice {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--comfort-border);
      border-radius: 12px;
      background: var(--theme-card);
      color: var(--comfort-text);
      text-align: left;
      cursor: pointer;
    }

    .theme-choice:hover {
      background: var(--theme-hover);
    }

    .theme-choice.is-selected {
      border-color: var(--comfort-accent-dark);
      box-shadow: inset 0 0 0 1px var(--comfort-accent-dark);
    }

    .theme-choice-preview {
      display: grid;
      grid-template-columns: 1fr 0.65fr;
      height: 42px;
      overflow: hidden;
      border: 1px solid rgba(80, 85, 76, 0.18);
      border-radius: 8px;
    }

    .theme-choice-preview span:last-child {
      margin: 9px 7px;
      border-radius: 999px;
    }

    .theme-choice-preview.is-light { background: #f7f7f4; }
    .theme-choice-preview.is-light span:first-child { background: #ffffff; }
    .theme-choice-preview.is-light span:last-child { background: #687968; }

    .theme-choice-preview.is-dark { background: #1d211d; }
    .theme-choice-preview.is-dark span:first-child { background: #2b302b; }
    .theme-choice-preview.is-dark span:last-child { background: #91a48a; }

    .theme-choice-preview.is-olivecream { background: #f2ecdf; }
    .theme-choice-preview.is-olivecream span:first-child { background: #fffaf0; }
    .theme-choice-preview.is-olivecream span:last-child { background: #727b4d; }

    .theme-choice strong {
      font-size: 13px;
    }

    .theme-choice small {
      color: var(--comfort-muted);
      font-size: 11px;
      line-height: 1.35;
    }

    .theme-setting-message {
      min-height: 17px;
      margin: 0;
      color: var(--comfort-muted);
      font-size: 12px;
    }

    @media (max-width: 520px) {
      .theme-choice-list {
        grid-template-columns: 1fr;
      }

      .theme-choice {
        grid-template-columns: 64px minmax(0, 1fr);
        align-items: center;
      }

      .theme-choice-preview {
        grid-row: span 2;
        width: 64px;
      }
    }
  `;

  document.head.append(style);
}

function updateThemeButtons(theme) {
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

function applyTheme(value, { persistLocal = true } = {}) {
  const theme = normalizeTheme(value);
  document.documentElement.dataset.theme = theme;
  if (persistLocal) localStorage.setItem(THEME_KEY, theme);
  updateThemeButtons(theme);
  return theme;
}

function ensureThemeSettingUI() {
  const settingsView = document.querySelector("#settings-view");
  if (!(settingsView instanceof HTMLElement)) return;
  if (settingsView.querySelector(".theme-setting-block")) return;

  const block = document.createElement("div");
  block.className = "settings-block theme-setting-block";
  block.innerHTML = `
    <div class="settings-block-heading">
      <div>
        <h3>디자인 테마</h3>
        <p class="helper">화면 분위기를 선택해요. 계정에 저장되어 다른 기기에서도 유지돼요.</p>
      </div>
    </div>
    <div class="theme-choice-list" role="group" aria-label="디자인 테마 선택">
      <button type="button" class="theme-choice" data-theme-choice="light" aria-pressed="false">
        <span class="theme-choice-preview is-light"><span></span><span></span></span>
        <strong>라이트</strong>
        <small>밝고 깔끔한 기본 화면</small>
      </button>
      <button type="button" class="theme-choice" data-theme-choice="dark" aria-pressed="false">
        <span class="theme-choice-preview is-dark"><span></span><span></span></span>
        <strong>다크</strong>
        <small>차콜 배경에 올리브 포인트</small>
      </button>
      <button type="button" class="theme-choice" data-theme-choice="olivecream" aria-pressed="false">
        <span class="theme-choice-preview is-olivecream"><span></span><span></span></span>
        <strong>올리브크림</strong>
        <small>크림 배경에 올리브 포인트</small>
      </button>
    </div>
    <p class="theme-setting-message" aria-live="polite"></p>
  `;

  const firstSettingsBlock = settingsView.querySelector(".settings-block");
  if (firstSettingsBlock) firstSettingsBlock.before(block);
  else settingsView.append(block);

  themeMessage = block.querySelector(".theme-setting-message");

  for (const button of block.querySelectorAll("[data-theme-choice]")) {
    button.addEventListener("click", async () => {
      const theme = applyTheme(button.dataset.themeChoice);
      if (themeMessage) themeMessage.textContent = "테마를 저장하는 중...";

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (themeMessage) themeMessage.textContent = "이 기기에 테마를 저장했어요.";
        return;
      }

      const existingMetadata = session.user.user_metadata ?? {};
      const { error } = await supabase.auth.updateUser({
        data: { ...existingMetadata, tracker_theme: theme },
      });

      if (themeMessage) {
        themeMessage.textContent = error
          ? "테마는 적용됐지만 계정 저장은 잠시 실패했어요."
          : "테마를 저장했어요.";
      }
    });
  }

  updateThemeButtons(normalizeTheme(document.documentElement.dataset.theme));
}

async function syncThemeFromSession(session = null) {
  let activeSession = session;
  if (!activeSession) {
    const result = await supabase.auth.getSession();
    activeSession = result.data.session;
  }

  const remoteTheme = activeSession?.user?.user_metadata?.tracker_theme;
  if (THEMES.has(remoteTheme)) applyTheme(remoteTheme);
}

ensureThemeStyles();
applyTheme(localStorage.getItem(THEME_KEY) || "olivecream", { persistLocal: false });
ensureThemeSettingUI();
syncThemeFromSession();

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) syncThemeFromSession(session);
});
