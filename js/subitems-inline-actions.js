let quickActionDialog = null;
let quickActionTitle = null;
let activeCard = null;
let activeSubitemName = "";

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitFor(getter, attempts = 30, delay = 50) {
  for (let index = 0; index < attempts; index += 1) {
    const value = getter();
    if (value) return value;
    await sleep(delay);
  }
  return null;
}

function ensureQuickActionDialog() {
  if (quickActionDialog) return quickActionDialog;

  quickActionDialog = document.createElement("dialog");
  quickActionDialog.className = "subitem-inline-action-dialog";
  quickActionDialog.innerHTML = `
    <div class="subitem-inline-action-shell">
      <div class="subitem-inline-action-header">
        <div>
          <h3 class="subitem-inline-action-title">항목</h3>
          <p>무엇을 할까요?</p>
        </div>
        <button type="button" class="subitem-inline-action-close" aria-label="닫기">×</button>
      </div>
      <div class="subitem-inline-action-list">
        <button type="button" data-subitem-inline-action="edit">수정하기</button>
        <button type="button" class="is-danger" data-subitem-inline-action="delete">삭제하기</button>
        <button type="button" class="is-cancel" data-subitem-inline-action="cancel">취소</button>
      </div>
    </div>
  `;

  document.body.append(quickActionDialog);
  quickActionTitle = quickActionDialog.querySelector(".subitem-inline-action-title");

  quickActionDialog.querySelector(".subitem-inline-action-close")?.addEventListener("click", () => {
    if (quickActionDialog.open) quickActionDialog.close();
  });

  quickActionDialog.addEventListener("click", async (event) => {
    if (event.target === quickActionDialog) {
      quickActionDialog.close();
      return;
    }

    const button = event.target instanceof Element
      ? event.target.closest("[data-subitem-inline-action]")
      : null;
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.subitemInlineAction;
    if (action === "cancel") {
      quickActionDialog.close();
      return;
    }

    const card = activeCard;
    const subitemName = activeSubitemName;
    quickActionDialog.close();

    if (!(card instanceof HTMLElement) || !subitemName) return;
    await openManagerAndTrigger(card, subitemName, action === "edit" ? "수정" : "삭제");
  });

  quickActionDialog.addEventListener("close", () => {
    activeCard = null;
    activeSubitemName = "";
  });

  return quickActionDialog;
}

function openQuickAction(card, subitemName) {
  const dialog = ensureQuickActionDialog();
  activeCard = card;
  activeSubitemName = subitemName;
  if (quickActionTitle) quickActionTitle.textContent = subitemName;
  if (!dialog.open) dialog.showModal();
}

async function openExistingManager(card) {
  if (!(card instanceof HTMLElement)) return null;

  card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  const manageButton = await waitFor(() => {
    const dialog = document.querySelector(".item-action-dialog[open]");
    return dialog?.querySelector("[data-subitem-manage]") ?? null;
  });

  if (!(manageButton instanceof HTMLButtonElement)) {
    const actionDialog = document.querySelector(".item-action-dialog[open]");
    if (actionDialog instanceof HTMLDialogElement) actionDialog.close();
    return null;
  }

  manageButton.click();

  return waitFor(() => {
    const dialog = document.querySelector(".subitem-manager-dialog[open]");
    return dialog instanceof HTMLDialogElement ? dialog : null;
  });
}

async function openManagerAndTrigger(card, subitemName, actionText) {
  const manager = await openExistingManager(card);
  if (!(manager instanceof HTMLDialogElement)) return;

  const targetRow = await waitFor(() => {
    return [...manager.querySelectorAll(".subitem-manager-row")].find((row) => {
      const name = row.querySelector(".subitem-manager-name")?.textContent?.trim();
      return name === subitemName;
    }) ?? null;
  });

  if (!(targetRow instanceof HTMLElement)) return;

  const actionButton = [...targetRow.querySelectorAll(".subitem-manager-row-actions button")].find(
    (button) => button.textContent?.trim() === actionText
  );

  if (actionButton instanceof HTMLButtonElement) actionButton.click();
}

function decorateProgress(progress) {
  if (!(progress instanceof HTMLElement)) return;
  const card = progress.closest(".item-card[data-item-id]");
  if (!(card instanceof HTMLElement)) return;

  const heading = progress.querySelector(".subitem-progress-heading");
  if (heading instanceof HTMLElement && heading.dataset.inlineCompact !== "true") {
    heading.dataset.inlineCompact = "true";
    heading.classList.add("is-inline-compact");

    const spans = [...heading.children].filter((child) => child instanceof HTMLSpanElement);
    if (spans.length >= 2) {
      spans[0].remove();
      spans[1].classList.add("subitem-inline-count");
    }

    const manageButton = document.createElement("button");
    manageButton.type = "button";
    manageButton.className = "subitem-inline-manage-button";
    manageButton.textContent = "+";
    manageButton.setAttribute("aria-label", "하위항목 관리");
    manageButton.title = "하위항목 관리";
    manageButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openExistingManager(card);
    });

    heading.append(manageButton);
  }

  for (const row of progress.querySelectorAll(".subitem-check-row")) {
    if (!(row instanceof HTMLElement)) continue;
    if (row.dataset.inlineActionsEnhanced === "true") continue;
    row.dataset.inlineActionsEnhanced = "true";
    row.classList.add("is-inline-action-row");

    const text = row.querySelector("span");
    const subitemName = text?.textContent?.trim() || "";
    if (!subitemName) continue;

    row.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input[type="checkbox"]')) return;
      event.preventDefault();
      event.stopPropagation();
      openQuickAction(card, subitemName);
    });
  }
}

function decorateAll(root = document) {
  if (root instanceof HTMLElement && root.matches(".subitem-progress")) decorateProgress(root);
  for (const progress of root.querySelectorAll?.(".subitem-progress") ?? []) {
    decorateProgress(progress);
  }
}

ensureQuickActionDialog();
decorateAll();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      decorateAll(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
