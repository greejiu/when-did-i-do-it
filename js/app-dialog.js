let dialog = null;
let titleEl = null;
let messageEl = null;
let inputWrap = null;
let inputEl = null;
let cancelButton = null;
let confirmButton = null;
let activeResolve = null;
let mode = "confirm";

function finish(value) {
  if (!activeResolve) return;
  const resolve = activeResolve;
  activeResolve = null;
  if (dialog?.open) dialog.close();
  resolve(value);
}

function ensureDialog() {
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "app-action-dialog";
  dialog.innerHTML = `
    <div class="app-action-dialog-shell">
      <h3 class="app-action-dialog-title"></h3>
      <p class="app-action-dialog-message"></p>
      <label class="app-action-dialog-input-wrap hidden">
        <input class="app-action-dialog-input" type="text" maxlength="100" />
      </label>
      <div class="app-action-dialog-actions">
        <button type="button" class="app-action-dialog-cancel">취소</button>
        <button type="button" class="app-action-dialog-confirm">확인</button>
      </div>
    </div>
  `;

  document.body.append(dialog);
  titleEl = dialog.querySelector(".app-action-dialog-title");
  messageEl = dialog.querySelector(".app-action-dialog-message");
  inputWrap = dialog.querySelector(".app-action-dialog-input-wrap");
  inputEl = dialog.querySelector(".app-action-dialog-input");
  cancelButton = dialog.querySelector(".app-action-dialog-cancel");
  confirmButton = dialog.querySelector(".app-action-dialog-confirm");

  cancelButton.addEventListener("click", () => finish(mode === "prompt" ? null : false));
  confirmButton.addEventListener("click", () => {
    if (mode === "prompt") {
      finish(inputEl.value.trim());
    } else {
      finish(true);
    }
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmButton.click();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish(mode === "prompt" ? null : false);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) finish(mode === "prompt" ? null : false);
  });

  return dialog;
}

function prepare({ title, message, confirmText = "확인", cancelText = "취소", danger = false }) {
  const currentDialog = ensureDialog();
  currentDialog.classList.remove("notice-mode");
  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmButton.textContent = confirmText;
  cancelButton.textContent = cancelText;
  confirmButton.classList.toggle("is-danger", danger);
  cancelButton.classList.remove("hidden");
  inputWrap.classList.add("hidden");
  inputEl.value = "";
  return currentDialog;
}

export function showConfirm({ title = "확인", message = "", confirmText = "확인", cancelText = "취소", danger = false } = {}) {
  mode = "confirm";
  const currentDialog = prepare({ title, message, confirmText, cancelText, danger });

  return new Promise((resolve) => {
    activeResolve = resolve;
    currentDialog.showModal();
    confirmButton.focus();
  });
}

export function showPrompt({ title = "입력", message = "", value = "", placeholder = "", confirmText = "저장", cancelText = "취소" } = {}) {
  mode = "prompt";
  const currentDialog = prepare({ title, message, confirmText, cancelText });
  inputWrap.classList.remove("hidden");
  inputEl.value = value;
  inputEl.placeholder = placeholder;

  return new Promise((resolve) => {
    activeResolve = resolve;
    currentDialog.showModal();
    window.setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 20);
  });
}

export function showNotice({ title = "안내", message = "", confirmText = "확인" } = {}) {
  mode = "notice";
  const currentDialog = prepare({ title, message, confirmText });
  currentDialog.classList.add("notice-mode");
  cancelButton.classList.add("hidden");

  return new Promise((resolve) => {
    activeResolve = resolve;
    currentDialog.showModal();
    confirmButton.focus();
  });
}
