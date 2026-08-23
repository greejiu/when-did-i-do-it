import { supabase } from "./supabase.js";
import { ensureDefaultCategories, getCategories } from "./categories.js";

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
const categoryList = document.querySelector("#category-list");
const categoryStatus = document.querySelector("#category-status");

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  signupButton.disabled = isLoading;
  logoutButton.disabled = isLoading;
}

function showMessage(text) {
  message.textContent = text;
}

function showLoggedOut() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  accountEmail.textContent = "";
  categoryList.replaceChildren();
  categoryStatus.textContent = "";
}

function showLoggedIn(user) {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  accountEmail.textContent = user?.email ?? "로그인됨";
  showMessage("");
}

function renderCategories(categories) {
  categoryList.replaceChildren();

  for (const category of categories) {
    const item = document.createElement("div");
    item.className = "category-item";

    const icon = document.createElement("span");
    icon.className = "category-icon";
    icon.textContent = category.icon || "•";

    const name = document.createElement("span");
    name.textContent = category.name;

    item.append(icon, name);
    categoryList.append(item);
  }

  categoryStatus.textContent = `${categories.length}개`;
}

async function initializeLoggedInApp(user) {
  if (!user) return;

  categoryStatus.textContent = "불러오는 중...";

  try {
    await ensureDefaultCategories(user.id);
    const categories = await getCategories();
    renderCategories(categories);
  } catch (error) {
    console.error(error);
    categoryStatus.textContent = "불러오기 실패";
    categoryList.textContent = "카테고리를 불러오지 못했어요. 잠시 후 새로고침해 주세요.";
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
    await initializeLoggedInApp(data.session.user);
    return;
  }

  showMessage("회원가입 완료! 받은 이메일의 인증 링크를 누른 뒤 로그인해 주세요.");
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});

signupButton.addEventListener("click", signup);

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
