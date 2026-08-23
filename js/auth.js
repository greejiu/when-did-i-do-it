import { supabase } from "./supabase.js";
import { ensureDefaultCategories, getCategories } from "./categories.js?v=10";
import { ensureDefaultSections, getSections } from "./sections.js?v=10";
import { initializeItemsUI, refreshItemsUI, resetItemsUI } from "./items.js?v=14";
import { initializeTaxonomyUI, resetTaxonomyUI } from "./taxonomy.js?v=12";
import { initializeRecordsUI, refreshRecordsUI, resetRecordsUI } from "./records.js?v=2";

const authSection = document.querySelector("#auth-section");
const appSection = document.querySelector("#app-section");
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");
const message = document.querySelector("#auth-message");
const accountEmail = document.querySelector("#account-email");
const appViews = [...document.querySelectorAll("[data-app-view]")];
const navButtons = [...document.querySelectorAll("[data-nav-view]")];

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  signupButton.disabled = isLoading;
  logoutButton.disabled = isLoading;
}

function showMessage(text) {
  message.textContent = text;
}

async function switchView(viewName) {
  for (const view of appViews) {
    view.classList.toggle("hidden", view.dataset.appView !== viewName);
  }

  for (const button of navButtons) {
    const active = button.dataset.navView === viewName;
    button.classList.toggle("is-active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }

  if (viewName === "records") {
    await refreshRecordsUI();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLoggedOut() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  accountEmail.textContent = "";
  resetItemsUI();
  resetTaxonomyUI();
  resetRecordsUI();
  switchView("home");
}

function showLoggedIn(user) {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  accountEmail.textContent = user?.email ?? "로그인됨";
  showMessage("");
  switchView("home");
}

async function ensureInitialDefaults(user) {
  if (user?.user_metadata?.tracker_defaults_seeded === true) return;

  await ensureDefaultCategories(user.id);
  const categories = await getCategories();
  await ensureDefaultSections(user.id, categories);

  const { error } = await supabase.auth.updateUser({
    data: { tracker_defaults_seeded: true },
  });

  if (error) {
    console.error("기본 데이터 초기화 표시 저장 실패", error);
  }
}

async function loadAppData(user) {
  const categories = await getCategories();
  const sections = await getSections();

  await initializeItemsUI(user.id, categories, sections);
  await initializeRecordsUI(user.id, refreshItemsUI);
  initializeTaxonomyUI(user.id, categories, sections, async () => {
    await loadAppData(user);
  });
}

async function initializeLoggedInApp(user) {
  if (!user) return;

  try {
    await ensureInitialDefaults(user);
    await loadAppData(user);
  } catch (error) {
    console.error(error);
    window.alert("앱 데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
  }
}

async function refreshSessionUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    showLoggedIn(session.user);
    await initializeLoggedInApp(session.user);
  } else {
    showLoggedOut();
  }
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("이메일과 비밀번호를 모두 입력해 주세요.");
    return;
  }

  setLoading(true);
  showMessage("로그인 중...");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  setLoading(false);

  if (error) {
    showMessage(`로그인 실패: ${error.message}`);
    return;
  }

  showLoggedIn(data.user);
  await initializeLoggedInApp(data.user);
}

async function signup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("이메일과 비밀번호를 모두 입력해 주세요.");
    return;
  }

  if (password.length < 6) {
    showMessage("비밀번호는 6자 이상으로 입력해 주세요.");
    return;
  }

  setLoading(true);
  showMessage("계정을 만드는 중...");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://greejiu.github.io/when-did-i-do-it/",
    },
  });

  setLoading(false);

  if (error) {
    showMessage(`회원가입 실패: ${error.message}`);
    return;
  }

  if (data.session?.user) {
    showLoggedIn(data.session.user);
    await initializeLoggedInApp(data.user);
    return;
  }

  showMessage("회원가입 완료! 받은 이메일의 인증 링크를 누른 뒤 로그인해 주세요.");
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});

signupButton.addEventListener("click", signup);

for (const button of navButtons) {
  button.addEventListener("click", () => switchView(button.dataset.navView));
}

window.addEventListener("app:navigate", (event) => {
  const view = event.detail?.view;
  if (view) switchView(view);
});

logoutButton.addEventListener("click", async () => {
  setLoading(true);
  await supabase.auth.signOut();
  setLoading(false);
  showLoggedOut();
  showMessage("로그아웃했어요.");
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    showLoggedIn(session.user);
    setTimeout(() => {
      initializeLoggedInApp(session.user);
    }, 0);
  } else {
    showLoggedOut();
  }
});

refreshSessionUI();
