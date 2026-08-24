import { supabase } from "./supabase.js";
import { showConfirm, showPrompt, showNotice } from "./app-dialog.js?v=1";

let quickActionDialog = null;
let quickActionTitle = null;
let activeCard = null;
let activeSubitemName = "";
let lastItemId = null;
let lastItemName = "";

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

async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function findSubitem(itemId, name) {
  if (!itemId || !name) return null;

  const { data, error } = await supabase
    .from("sub_items")
    .select("id, item_id, name, sort_order")
    .eq("item_id", itemId)
    .eq("name", name)
    .limit(1);

  if (error) {
    console.error(error);
    await showNotice({ title: "불러오기 실패", message: "하위 할일 정보를 불러오지 못했어요." });
    return null;
  }

  return data?.[0] ?? null;
}

function notifySubitemsChanged() {
  window.dispatchEvent(new CustomEvent("app:subitems-changed"));
}

async function addSubitemDirect(itemId, itemName = "항목") {
  if (!itemId) return;

  const name = await showPrompt({
    title: `${itemName} · 하위 할일 추가`,
    message: "새 하위 할일 이름을 입력해 주세요.",
    placeholder: "예: 변기 뚜껑 청소하기",
    confirmText: "추가",
  });
  if (name === null) return;

  const cleanName = name.trim();
  if (!cleanName) {
    await showNotice({ title: "입력 확인", message: "하위 할일 이름을 입력해 주세요." });
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) return;

  const { data: lastRows, error: orderError } = await supabase
    .from("sub_items")
    .select("sort_order")
    .eq("item_id", itemId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (orderError) {
    console.error(orderError);
    await showNotice({ title: "추가 실패", message: "하위 할일 순서를 확인하지 못했어요." });
    return;
  }

  const maxOrder = lastRows?.[0]?.sort_order ?? 0;
  const { error } = await supabase.from("sub_items").insert({
    user_id: userId,
    item_id: itemId,
    name: cleanName,
    sort_order: maxOrder + 10,
  });

  if (error) {
    await showNotice({
      title: "추가 실패",
      message: error.code === "23505" ? "같은 이름의 하위 할일이 이미 있어요." : error.message,
    });
    return;
  }

  notifySubitemsChanged();
}

async function editSubitemDirect(itemId, subitemName) {
  const subitem = await findSubitem(itemId, subitemName);
  if (!subitem) return;

  const name = await showPrompt({
    title: "하위 할일 수정",
    message: "이름을 수정해 주세요.",
    value: subitem.name,
    confirmText: "저장",
  });
  if (name === null) return;

  const cleanName = name.trim();
  if (!cleanName || cleanName === subitem.name) return;

  const { error } = await supabase
    .from("sub_items")
    .update({ name: cleanName, updated_at: new Date().toISOString() })
    .eq("id", subitem.id);

  if (error) {
    await showNotice({
      title: "수정 실패",
      message: error.code === "23505" ? "같은 이름의 하위 할일이 이미 있어요." : error.message,
    });
    return;
  }

  notifySubitemsChanged();
}

async function deleteSubitemDirect(itemId, subitemName) {
  const subitem = await findSubitem(itemId, subitemName);
  if (!subitem) return;

  const confirmed = await showConfirm({
    title: "하위 할일 삭제",
    message: `“${subitem.name}”을 삭제할까요?\n이 하위 할일의 지난 기록도 함께 삭제돼요.`,
    confirmText: "삭제",
    danger: true,
  });
  if (!confirmed) return;

  const { error } = await supabase.from("sub_items").delete().eq("id", subitem.id);
  if (error) {
    await showNotice({ title: "삭제 실패", message: error.message });
    return;
  }

  notifySubitemsChanged();
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

  quickActionDialog.addEventListener("click", (event) => {
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
    const itemId = card instanceof HTMLElement ? card.dataset.itemId : null;
    quickActionDialog.close();

    if (!itemId || !subitemName) return;
    window.setTimeout(() => {
      if (action === "edit") editSubitemDirect(itemId, subitemName);
      else if (action === "delete") deleteSubitemDirect(itemId, subitemName);
    }, 0);
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

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "subitem-inline-manage-button";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "하위 할일 추가");
    addButton.title = "하위 할일 추가";
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addSubitemDirect(card.dataset.itemId, card.querySelector(".item-title")?.textContent?.trim() || "항목");
    });

    heading.append(addButton);
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

  if (root instanceof HTMLElement && root.matches(".subitem-progress")) {
    decorateProgress(root);
  }

  for (const progress of root.querySelectorAll?.(".subitem-progress") ?? []) {
    decorateProgress(progress);
  }
}

function trackItemFromClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest(".item-card[data-item-id]");
  if (!(card instanceof HTMLElement)) return;

  lastItemId = card.dataset.itemId || null;
  lastItemName = card.querySelector(".item-title")?.textContent?.trim() || "";
}

document.addEventListener("click", trackItemFromClick, true);

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const addButton = target?.closest("[data-subitem-manage]");
    if (!(addButton instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const actionDialog = addButton.closest("dialog");
    if (actionDialog?.open) actionDialog.close();

    const itemId = lastItemId;
    const itemName = lastItemName || "항목";
    window.setTimeout(() => addSubitemDirect(itemId, itemName), 0);
  },
  true
);

ensureQuickActionDialog();
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
