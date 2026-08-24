import { supabase } from "./supabase.js";

const THEME_KEY = "when-did-i-do-it-theme";
const THEMES = new Set(["light", "dark", "olivecream"]);
let themeMessage = null;

function normalizeTheme(value) {
  return THEMES.has(value) ? value : "olivecream";
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
        <small>화이트 중심의 밝고 깔끔한 화면</small>
      </button>
      <button type="button" class="theme-choice" data-theme-choice="dark" aria-pressed="false">
        <span class="theme-choice-preview is-dark"><span></span><span></span></span>
        <strong>다크</strong>
        <small>블랙·차콜 중심의 어두운 화면</small>
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

applyTheme(localStorage.getItem(THEME_KEY) || "olivecream", { persistLocal: false });
ensureThemeSettingUI();
syncThemeFromSession();

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) syncThemeFromSession(session);
});
