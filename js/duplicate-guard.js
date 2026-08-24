let noticeDialog = null;
let noticeTimer = null;

function ensureNoticeDialog() {
  if (noticeDialog) return noticeDialog;

  noticeDialog = document.createElement("dialog");
  noticeDialog.className = "mini-notice-dialog";
  noticeDialog.addEventListener("click", () => {
    if (noticeDialog?.open) noticeDialog.close();
  });
  document.body.append(noticeDialog);
  return noticeDialog;
}

function showNotice(text) {
  const dialog = ensureNoticeDialog();
  dialog.textContent = text;

  if (noticeTimer) window.clearTimeout(noticeTimer);
  if (dialog.open) dialog.close();

  dialog.showModal();
  noticeTimer = window.setTimeout(() => {
    if (dialog.open) dialog.close();
  }, 1600);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayDisplay() {
  const date = new Date();
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function displayDateToKey(value) {
  const match = value.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function getRowDateKey(row) {
  const input = row.querySelector(".history-record-date-input");
  if (input instanceof HTMLInputElement && input.value) return input.value;

  const strong = row.querySelector(".history-record-main strong");
  if (!(strong instanceof HTMLElement)) return null;
  return displayDateToKey(strong.textContent || "");
}

function historyHasDate(value, exceptRow = null) {
  if (!value) return false;

  for (const row of document.querySelectorAll(".history-record-row")) {
    if (row === exceptRow) continue;
    if (getRowDateKey(row) === value) return true;
  }

  return false;
}

/* 홈/카테고리 카드에서 오늘 완료를 다시 누르는 경우 차단 */
document.addEventListener(
  "click",
  (event) => {
    const button = event.target instanceof Element ? event.target.closest(".complete-button") : null;
    if (!(button instanceof HTMLButtonElement)) return;

    const card = button.closest(".item-card");
    const metaText = card?.querySelector(".item-meta")?.textContent || "";

    if (!metaText.includes(`마지막 완료 ${todayDisplay()}`)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showNotice("이미 완료한 항목이에요.");
  },
  true
);

/* 기록 팝업에서 같은 날짜를 다시 추가하는 경우 차단 */
document.addEventListener(
  "submit",
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "history-add-form") return;

    const dateInput = form.querySelector("#history-date");
    if (!(dateInput instanceof HTMLInputElement) || !dateInput.value) return;
    if (!historyHasDate(dateInput.value)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showNotice("이미 기록을 추가했어요.");
  },
  true
);

/* 기록 날짜 수정으로도 같은 날짜가 두 개 생기지 않게 차단 */
document.addEventListener(
  "click",
  (event) => {
    const button = event.target instanceof Element ? event.target.closest(".history-record-button") : null;
    if (!(button instanceof HTMLButtonElement) || button.textContent?.trim() !== "저장") return;

    const row = button.closest(".history-record-row");
    if (!(row instanceof HTMLElement)) return;

    const input = row.querySelector(".history-record-date-input");
    if (!(input instanceof HTMLInputElement) || !input.value) return;
    if (!historyHasDate(input.value, row)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showNotice("이미 기록을 추가했어요.");
  },
  true
);
