import { supabase } from "./supabase.js";
import { ensureDefaultCategories, getCategories } from "./categories.js?v=10";
import { ensureDefaultSections, getSections } from "./sections.js?v=10";
import { initializeItemsUI, refreshItemsUI, resetItemsUI } from "./items.js?v=16";
import { initializeTaxonomyUI, resetTaxonomyUI } from "./taxonomy.js?v=13";
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

let initializedUserId = null;
let initializingUserId = null;
let initializationPromise = null;

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  signupButton.disabled = isLoading;
  logoutButton.disabled = isLoading;
  loginButton.textContent = isLoading ? "처리 중..." : "로그인";
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.dataset.type = type;
}

function showAuth() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
}

function showApp() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
}

function getErrorMessage(error) {
  const text = error?.message || "";
  const status = error?.status;

  if (text.includes("Email not confirmed") || text.includes("email_not_confirmed")) {
    return "이메일 인증이 아직 안 됐어요. 메일함에서 인증 링크를 눌러주세요.";
  }

  if (text.includes("Invalid login credentials") || text.includes("invalid_credentials")) {
    return "이메일 또는 비밀번호를 확인해 주세요.";
  }

  if (status === 429 || text.includes("rate limit") || text.includes("security purposes")) {
    return "인증 메일 발송 횟수를 초과했어요. 이미 받은 메일을 먼저 확인해 주세요.";
  }

  if (text.includes("User already registered")) {
    return "이미 가입한 이메일이에요. 로그인하거나 메일 인증을 확인해 주세요.";
  }

  return text || "요청을 처리하지 못했어요.";
}

function setActiveView(viewName) {
  appViews.forEach((view) => {
    view.classList.toggle("hidden", view.dataset.appView !== viewName);
  });

  navButtons.forEach((button) => {
    const active = button.dataset.navView === viewName;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.navView || "home"));
});

async function bootstrapUser(user) {
  if (!user) return;
  if (initializedUserId === user.id) {
    showApp();
    accountEmail.textContent = user.email ?? "";
    return;
  }

  if (initializingUserId === user.id && initializationPromise) {
    await initializationPromise;
    showApp();
    accountEmail.textContent = user.email ?? "";
    return;
  }

  initializingUserId = user.id;
  initializationPromise = (async () => {
    await ensureDefaultCategories(user.id);
    const categories = await getCategories();
    await ensureDefaultSections(user.id, categories);
    const sections = await getSections();

    await initializeItemsUI(user.id, categories, sections);
    initializeTaxonomyUI(user.id, categories, sections, async () => {
      const latestCategories = await getCategories();
      const latestSections = await getSections();
      await initializeItemsUI(user.id, latestCategories, latestSections);
      initializeTaxonomyUI(user.id, latestCategories, latestSections, async () => {
        const againCategories = await getCategories();
        const againSections = await getSections();
        await initializeItemsUI(user.id, againCategories, againSections);
      });
      await refreshRecordsUI();
    });
    await initializeRecordsUI(user.id);
    accountEmail.textContent = user.email ?? "";
    initializedUserId = user.id;
  })();

  try {
    await initializationPromise;
    showApp();
    setActiveView("home");
    setMessage("");
  } finally {
    initializingUserId = null;
    initializationPromise = null;
  }
}

async function restoreSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    await bootstrapUser(session.user);
  } else {
    showAuth();
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);
  setMessage("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await bootstrapUser(data.user);
  } catch (error) {
    setMessage(getErrorMessage(error), "error");
  } finally {
    setLoading(false);
  }
});

signupButton.addEventListener("click", async () => {
  setLoading(true);
  setMessage("");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.href,
      },
    });
    if (error) throw error;

    if (data.session?.user) {
      await bootstrapUser(data.session.user);
      setMessage("회원가입이 완료됐어요.");
    } else {
      setMessage("회원가입이 되었어요. 메일함에서 인증 링크를 눌러주세요.");
    }
  } catch (error) {
    setMessage(getErrorMessage(error), "error");
  } finally {
    setLoading(false);
  }
});

logoutButton.addEventListener("click", async () => {
  setLoading(true);
  setMessage("");

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    initializedUserId = null;
    initializingUserId = null;
    initializationPromise = null;
    resetItemsUI();
    resetTaxonomyUI();
    resetRecordsUI();
    showAuth();
    authForm.reset();
  } catch (error) {
    setMessage(getErrorMessage(error), "error");
  } finally {
    setLoading(false);
  }
});

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    await bootstrapUser(session.user);
  } else {
    initializedUserId = null;
    initializingUserId = null;
    initializationPromise = null;
    resetItemsUI();
    resetTaxonomyUI();
    resetRecordsUI();
    showAuth();
  }
});

restoreSession();