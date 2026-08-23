let dialog = null;
let titleEl = null;
let messageEl = null;
let inputWrap = null;
let inputEl = null;
let cancelButton = null;
let confirmButton = null;
let activeResolve = null;
let mode = "confirm";

function ensureStyles() {
  if (document.querySelector("#app-dialog-styles")) return;

  const style = document.createElement("style");
  style.id = "app-dialog-styles";
  style.textContent = `
    .app-action-dialog {
      width: min(390px, calc(100% - 32px));
      margin: auto;
      padding: 0;
      border: 1px solid #d7d5cb;
      border-radius: 18px;
      background: #fbfaf6;
      color: #30342f;
      box-shadow: 0 20px 60px rgba(58, 63, 55, 0.2);
    }

    .app-action-dialog::backdrop {
      background: rgba(62, 66, 58, 0.32);
      backdrop-filter: blur(1px);
    }

    .app-action-dialog-shell {
      padding: 20px;
    }

    .app-action-dialog h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    .app-action-dialog-message {
      margin: 0;
      color: #676d65;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre-line;
    }

    .app-action-dialog-input-wrap {
      display: grid;
      gap: 6px;
      margin-top: 15px;
    }

    .app-action-dialog-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 11px;
      border: 1px solid #d7d5cb;
      border-radius: 10px;
      background: #fffefa;
      color: #30342f;
      font: inherit;
    }

    .app-action-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 18px;
    }

    .app-action-dialog button {
      min-height: 36px;
      padding: 7px 13px;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .app-action-dialog-cancel {
      border: 1px solid #d7d5cb;
      background: #fffefa;
      color: #30342f;
    }

    .app-action-dialog-confirm {
      border: 1px solid #4f5f50;
      background: #4f5f50;
      color: #fffdf8;
    }

    .app-action-dialog-confirm.is-danger {
      border-color: #8d5a54;
      background: #8d5a54;
    }

    .app-action-dialog.notice-mode .app-action-dialog-actions {
      justify-content: center;
    }

    .app-action-dialog.notice-mode .app-action-dialog-confirm {
      min-width: 82px;
    }
  `;
  document.head.append(style);
}

function finish(value) {
  if (!activeResolve) return;
  const resolve = activeResolve;
  activeResolve = null;
  if (dialog?.open) dialog.close();
  resolve(value);
}

function ensureDialog() {
  if (dialog) return dialog;
  ensureStyles();

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
