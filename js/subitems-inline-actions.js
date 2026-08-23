import { supabase } from "./supabase.js";

let quickActionDialog = null;
let quickActionTitle = null;
let activeCard = null;
let activeSubitemName = "";
let lastItemId = null;
let lastItemName = "";
let historyLoadToken = 0;

const historyModal = document.querySelector("#history-modal");
const historyTitle = document.querySelector("#history-title");
const historyRecordCard = historyModal?.querySelector(".history-record-card");

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

function replaceSubitemTerm(value) {
  return String(value || "").replace(/하위\s*항목/g, "하위 할일");
}

function renameElementText(element) {
  if (!(element instanceof HTMLElement)) return;
  const current = element.textContent || "";
  const next = replaceSubitemTerm(current);
  if (current !== next) element.textContent = next;
}

function renameSubitemTerminology(root = document) {
  const selectors = [
    "[data-subitem-manage]",
    ".subitem-manager-title",
    ".subitem-manager-empty",
    ".subitem-manager-message",
    ".subitem-add-form button",
  ];

  for (const selector of selectors) {
    if (root instanceof HTMLElement && root.matches(selector)) renameElementText(root);
    for (const element of root.querySelectorAll?.(selector) ?? []) renameElementText(element);
  }

  for (const button of root.querySelectorAll?.("[data-subitem-manage]") ?? []) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.textContent = "하위 할일 추가";
    button.setAttribute("aria-label", "하위 할일 추가");
  }

  for (const button of root.querySelectorAll?.(".subitem-inline-manage-button") ?? []) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.setAttribute("aria-label", "하위 할일 추가");
    button.title = "하위 할일 추가";
  }
}

function ensureQuickActionDialog() {
  if (quickActionDialog) return quickActionDialog;

  quickActionDialog = document.createElement("dialog");
  quickActionDialog.className = "subitem-inline-action-dialog";
  quickActionDialog.innerHTML = `
    <div class="subitem-inline-action-shell">
      <div class="subitem-inline-action-header">
        <div>
          <h3 class="subitem-inline-action-title">할일</h3>
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

  const manager = await waitFor(() => {
    const dialog = document.querySelector(".subitem-manager-dialog[open]");
    return dialog instanceof HTMLDialogElement ? dialog : null;
  });

  if (manager) renameSubitemTerminology(manager);
  return manager;
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
    manageButton.setAttribute("aria-label", "하위 할일 추가");
    manageButton.title = "하위 할일 추가";
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
  renameSubitemTerminology(root);
  if (root instanceof HTMLElement && root.matches(".subitem-progress")) decorateProgress(root);
  for (const progress of root.querySelectorAll?.(".subitem-progress") ?? []) {
    decorateProgress(progress);
  }
}

function formatHistoryDate(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function ensureSubitemHistoryBlock() {
  if (!(historyRecordCard instanceof HTMLElement)) return null;
  let block = historyRecordCard.querySelector(".subitem-history-block");
  if (block instanceof HTMLElement) return block;

  block = document.createElement("div");
  block.className = "subitem-history-block";
  block.hidden = true;
  block.innerHTML = `
    <div class="subitem-history-heading">
      <h4>하위 할일 기록</h4>
      <span class="subitem-history-count"></span>
    </div>
    <div class="subitem-history-list"></div>
  `;
  historyRecordCard.append(block);
  return block;
}

async function resolveHistoryItemId() {
  const title = historyTitle?.textContent?.trim() || "";
  if (!title) return null;

  if (lastItemId && lastItemName === title) return lastItemId;

  const { data, error } = await supabase
    .from("items")
    .select("id, name, created_at")
    .eq("name", title)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("하위 할일 기록용 항목을 찾지 못했어요.", error);
    return null;
  }
  return data?.[0]?.id ?? null;
}

function renderSubitemHistory(records) {
  const block = ensureSubitemHistoryBlock();
  if (!(block instanceof HTMLElement)) return;

  const list = block.querySelector(".subitem-history-list");
  const count = block.querySelector(".subitem-history-count");
  if (!(list instanceof HTMLElement)) return;

  list.replaceChildren();
  if (count) count.textContent = `${records.length}개`;

  if (records.length === 0) {
    block.hidden = true;
    return;
  }

  block.hidden = false;
  for (const record of records) {
    const row = document.createElement("div");
    row.className = "subitem-history-row";

    const date = document.createElement("strong");
    date.textContent = formatHistoryDate(record.completed_at);

    const name = document.createElement("span");
    name.textContent = record.name;

    row.append(date, name);
    list.append(row);
  }
}

async function loadSubitemHistoryList() {
  if (!(historyModal instanceof HTMLDialogElement) || !historyModal.open) return;
  const token = ++historyLoadToken;
  const itemId = await resolveHistoryItemId();
  if (token !== historyLoadToken) return;

  if (!itemId) {
    renderSubitemHistory([]);
    return;
  }

  const { data: subitems, error: subitemError } = await supabase
    .from("sub_items")
    .select("id, name")
    .eq("item_id", itemId);

  if (subitemError) {
    console.error("하위 할일을 불러오지 못했어요.", subitemError);
    renderSubitemHistory([]);
    return;
  }

  const ids = (subitems ?? []).map((row) => row.id);
  if (ids.length === 0) {
    renderSubitemHistory([]);
    return;
  }

  const { data: records, error: recordError } = await supabase
    .from("subitem_completion_records")
    .select("id, sub_item_id, completed_at")
    .in("sub_item_id", ids)
    .order("completed_at", { ascending: false });

  if (recordError) {
    console.error("하위 할일 기록을 불러오지 못했어요.", recordError);
    renderSubitemHistory([]);
    return;
  }

  const names = new Map((subitems ?? []).map((row) => [row.id, row.name]));
  const rows = (records ?? []).map((record) => ({
    ...record,
    name: names.get(record.sub_item_id) || "하위 할일",
  }));
  renderSubitemHistory(rows);
}

function trackItemFromClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest(".item-card[data-item-id]");
  if (!(card instanceof HTMLElement)) return;
  lastItemId = card.dataset.itemId || null;
  lastItemName = card.querySelector(".item-title")?.textContent?.trim() || "";
}

document.addEventListener("click", trackItemFromClick, true);

ensureQuickActionDialog();
ensureSubitemHistoryBlock();
decorateAll();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const targetRoot = mutation.target instanceof HTMLElement
      ? mutation.target
      : mutation.target.parentElement;
    if (targetRoot) decorateAll(targetRoot);

    for (const node of mutation.addedNodes) {
      const root = node instanceof HTMLElement ? node : node.parentElement;
      if (root) decorateAll(root);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

if (historyModal instanceof HTMLDialogElement) {
  const historyObserver = new MutationObserver(() => {
    if (historyModal.open) {
      window.setTimeout(loadSubitemHistoryList, 40);
    } else {
      historyLoadToken += 1;
      renderSubitemHistory([]);
    }
  });
  historyObserver.observe(historyModal, { attributes: true, attributeFilter: ["open"] });
}

if (historyModal?.open) loadSubitemHistoryList();
