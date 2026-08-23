import { showConfirm } from "./app-dialog.js?v=1";

let bypassDeleteGuard = false;

function getDeleteTarget(event) {
  if (!(event.target instanceof Element)) return null;

  const itemDelete = event.target.closest(".item-card .delete-button");
  if (itemDelete instanceof HTMLButtonElement) {
    const itemName = itemDelete.closest(".item-card")?.querySelector(".item-title")?.textContent?.trim() || "이 항목";
    return {
      button: itemDelete,
      title: "항목 삭제",
      message: `“${itemName}” 항목을 삭제할까요?\n완료 기록도 함께 삭제돼요.`,
    };
  }

  const historyDelete = event.target.closest(".history-record-row .danger-text");
  if (historyDelete instanceof HTMLButtonElement && historyDelete.textContent?.trim() === "삭제") {
    const date = historyDelete
      .closest(".history-record-row")
      ?.querySelector(".history-record-main strong")
      ?.textContent?.trim();

    return {
      button: historyDelete,
      title: "완료 기록 삭제",
      message: date ? `${date} 완료 기록을 삭제할까요?` : "이 완료 기록을 삭제할까요?",
    };
  }

  return null;
}

document.addEventListener(
  "click",
  async (event) => {
    if (bypassDeleteGuard) return;

    const target = getDeleteTarget(event);
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const confirmed = await showConfirm({
      title: target.title,
      message: target.message,
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });

    if (!confirmed) return;

    const originalConfirm = window.confirm;
    bypassDeleteGuard = true;
    window.confirm = () => true;

    try {
      target.button.click();
    } finally {
      window.confirm = originalConfirm;
      bypassDeleteGuard = false;
    }
  },
  true
);
