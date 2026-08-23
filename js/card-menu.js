let actionDialog = null;
let actionDialogTitle = null;
let activeActions = null;

function cleanCategoryName(value) {
  const text = (value || "").trim();
  if (!text) return "";

  try {
    return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "").trim() || text;
  } catch {
    return text;
  }
}

function getCategoryName(card) {
  const group = card.closest(".item-category-group");
  const heading = group?.querySelector(".item-category-heading h3");
  return cleanCategoryName(heading?.textContent || "");
}

function ensureActionDialog() {
  if (actionDialog) return actionDialog;

  actionDialog = document.createElement("dialog");
  actionDialog.className = "item-action-dialog";
  actionDialog.innerHTML = `
    <div class="item-action-dialog-shell">
      <div class="item-action-dialog-header">
        <div>
          <h3 class="item-action-dialog-title">항목</h3>
          <p>무엇을 할까요?</p>
        </div>
        <button type="button" class="item-action-dialog-close" aria-label="닫기">×</button>
      </div>
      <div class="item-action-dialog-list">
        <button type="button" data-item-action="history">기록 보기</button>
        <button type="button" data-item-action="edit">수정하기</button>
        <button type="button" class="is-danger" data-item-action="delete">삭제하기</button>
        <button type="button" class="is-cancel" data-item-action="cancel">취소</button>
      </div>
    </div>
  `;

  document.body.append(actionDialog);
  actionDialogTitle = actionDialog.querySelector(".item-action-dialog-title");

  actionDialog.querySelector(".item-action-dialog-close")?.addEventListener("click", () => {
    if (actionDialog?.open) actionDialog.close();
  });

  actionDialog.addEventListener("click", (event) => {
    if (event.target === actionDialog) {
      actionDialog.close();
      return;
    }

    const button = event.target instanceof Element
      ? event.target.closest("[data-item-action]")
      : null;
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.itemAction;
    if (action === "cancel") {
      actionDialog.close();
      return;
    }

    const originalButton = activeActions?.[action];
    actionDialog.close();

    if (originalButton instanceof HTMLButtonElement) {
      window.setTimeout(() => originalButton.click(), 0);
    }
  });

  actionDialog.addEventListener("close", () => {
    activeActions = null;
  });

  return actionDialog;
}

function openActionDialog(card, actions) {
  const dialog = ensureActionDialog();
  const itemName = card.querySelector(".item-title")?.textContent?.trim() || "항목";

  activeActions = actions;
  if (actionDialogTitle) actionDialogTitle.textContent = itemName;

  if (dialog.open) dialog.close();
  dialog.showModal();
}

function enhanceCard(card) {
  if (!(card instanceof HTMLElement)) return;
  if (card.dataset.compactEnhanced === "true") return;

  const top = card.querySelector(".item-card-top");
  const meta = card.querySelector(".item-meta");
  const actions = card.querySelector(".item-card-actions");
  const historyButton = actions?.querySelector(".history-button");
  const editButton = actions?.querySelector(".edit-button");
  const deleteButton = actions?.querySelector(".delete-button");
  const completeButton = actions?.querySelector(".complete-button");

  if (!top || !meta || !actions || !completeButton) return;

  card.dataset.compactEnhanced = "true";
  card.classList.add("item-card-compact", "item-card-clickable");

  const topActions = document.createElement("div");
  topActions.className = "item-top-actions";

  const categoryName = getCategoryName(card);
  if (categoryName) {
    const badge = document.createElement("span");
    badge.className = "item-category-badge";
    badge.textContent = `(${categoryName})`;
    topActions.append(badge);
  }

  top.append(topActions);

  const bottom = document.createElement("div");
  bottom.className = "item-card-bottom";
  bottom.append(meta, completeButton);

  actions.classList.add("item-card-hidden-actions");
  actions.hidden = true;
  card.append(bottom, actions);

  const cardActions = {
    history: historyButton,
    edit: editButton,
    delete: deleteButton,
  };

  card.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    openActionDialog(card, cardActions);
  });
}

function enhanceAllCards(root = document) {
  for (const card of root.querySelectorAll?.(".item-card") || []) {
    enhanceCard(card);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-card")) enhanceCard(node);
      enhanceAllCards(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
enhanceAllCards();
