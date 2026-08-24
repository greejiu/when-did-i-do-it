import { supabase } from "./supabase.js";
import { showConfirm, showPrompt, showNotice } from "./app-dialog.js?v=1";

let currentUserId = null;
let subitemsByItem = new Map();
let currentRecordBySubitem = new Map();
let lastActionItemId = null;
let lastActionItemName = "";
let refreshTimer = null;
let refreshPromise = null;

let managerDialog = null;
let managerTitle = null;
let managerList = null;
let managerMessage = null;
let managerForm = null;
let managerInput = null;
let managerItemId = null;
let managerItemName = "";

let quickActionDialog = null;
let quickActionTitle = null;
let activeCard = null;
let activeSubitemName = "";
let lastItemId = null;
let lastItemName = "";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function getUserId() {
  if (currentUserId) return currentUserId;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUserId = session?.user?.id ?? null;
  return currentUserId;
}

function getVisibleItemIds() {
  return unique(
    [...document.querySelectorAll(".item-card[data-item-id]")].map((card) => card.dataset.itemId)
  );
}

function setManagerMessage(text = "") {
  if (managerMessage) managerMessage.textContent = text;
}

function ensureManagerDialog() {
  if (managerDialog) return managerDialog;

  managerDialog = document.createElement("dialog");
  managerDialog.className = "subitem-manager-dialog";
  managerDialog.innerHTML = `
    <div class="subitem-manager-shell">
      <div class="subitem-manager-header">
        <div>
          <h3 class="subitem-manager-title">하위항목 관리</h3>
          <p>작게 나눠서 체크해요. 상위항목을 완료하면 새 회차로 시작돼요.</p>
        </div>
        <button type="button" class="subitem-manager-close" aria-label="닫기">×</button>
      </div>
      <div class="subitem-manager-list"></div>
      <form class="subitem-add-form">
        <input type="text" maxlength="100" placeholder="예: 욕실 바닥 한쪽 청소하기" required />
        <button type="submit">+ 하위항목</button>
      </form>
      <p class="subitem-manager-message" aria-live="polite"></p>
    </div>
  `;

  document.body.append(managerDialog);
  managerTitle = managerDialog.querySelector(".subitem-manager-title");
  managerList = managerDialog.querySelector(".subitem-manager-list");
  managerMessage = managerDialog.querySelector(".subitem-manager-message");
  managerForm = managerDialog.querySelector(".subitem-add-form");
  managerInput = managerDialog.querySelector(".subitem-add-form input");

  managerDialog.querySelector(".subitem-manager-close")?.addEventListener("click", () => {
    if (managerDialog.open) managerDialog.close();
  });

  managerDialog.addEventListener("click", (event) => {
    if (event.target === managerDialog) managerDialog.close();
  });

  managerDialog.addEventListener("close", () => {
    managerItemId = null;
    managerItemName = "";
    setManagerMessage("");
  });

  managerForm.addEventListener("submit", addSubitem);
  return managerDialog;
}

async function addSubitem(event) {
  event.preventDefault();
  const userId = await getUserId();
  const name = managerInput?.value.trim() ?? "";
  if (!userId || !managerItemId || !name) return;

  const rows = subitemsByItem.get(managerItemId) ?? [];
  const maxOrder = rows.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);

  const submitButton = managerForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setManagerMessage("추가 중...");

  const { error } = await supabase.from("sub_items").insert({
    user_id: userId,
    item_id: managerItemId,
    name,
    sort_order: maxOrder + 10,
  });

  if (submitButton) submitButton.disabled = false;

  if (error) {
    setManagerMessage(
      error.code === "23505" ? "같은 이름의 하위항목이 이미 있어요." : `추가 실패: ${error.message}`
    );
    return;
  }

  if (managerInput) managerInput.value = "";
  await refreshAll();
  setManagerMessage("하위항목을 추가했어요.");
  managerInput?.focus();
}

function startEditSubitem(rowElement, subitem) {
  const nameArea = rowElement.querySelector(".subitem-manager-name");
  const actions = rowElement.querySelector(".subitem-manager-row-actions");
  if (!nameArea || !actions) return;

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 100;
  input.value = subitem.name;
  nameArea.replaceChildren(input);

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "취소";
  cancel.addEventListener("click", renderManagerList);

  const save = document.createElement("button");
  save.type = "button";
  save.className = "is-primary";
  save.textContent = "저장";
  save.addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) return;

    save.disabled = true;
    const { error } = await supabase
      .from("sub_items")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", subitem.id)
      .eq("user_id", currentUserId);

    if (error) {
      save.disabled = false;
      setManagerMessage(
        error.code === "23505" ? "같은 이름의 하위항목이 이미 있어요." : `수정 실패: ${error.message}`
      );
      return;
    }

    await refreshAll();
    setManagerMessage("하위항목 이름을 수정했어요.");
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel.click();
    }
  });

  actions.replaceChildren(cancel, save);
  input.focus();
  input.select();
}

function startDeleteSubitem(rowElement, subitem) {
  const nameArea = rowElement.querySelector(".subitem-manager-name");
  const actions = rowElement.querySelector(".subitem-manager-row-actions");
  if (!nameArea || !actions) return;

  nameArea.textContent = `“${subitem.name}” 삭제할까요?`;

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "취소";
  cancel.addEventListener("click", renderManagerList);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "is-danger";
  remove.textContent = "삭제";
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    const { error } = await supabase
      .from("sub_items")
      .delete()
      .eq("id", subitem.id)
      .eq("user_id", currentUserId);

    if (error) {
      remove.disabled = false;
      setManagerMessage(`삭제 실패: ${error.message}`);
      return;
    }

    await refreshAll();
    setManagerMessage("하위항목과 그 기록을 삭제했어요.");
  });

  actions.replaceChildren(cancel, remove);
}

function renderManagerList() {
  if (!managerList || !managerItemId) return;
  managerList.replaceChildren();

  const rows = subitemsByItem.get(managerItemId) ?? [];
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subitem-manager-empty";
    empty.textContent = "아직 하위항목이 없어요. 아래에서 첫 하위항목을 추가해 보세요.";
    managerList.append(empty);
    return;
  }

  for (const subitem of rows) {
    const row = document.createElement("div");
    row.className = "subitem-manager-row";

    const name = document.createElement("div");
    name.className = "subitem-manager-name";
    name.textContent = subitem.name;

    const actions = document.createElement("div");
    actions.className = "subitem-manager-row-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "수정";
    edit.addEventListener("click", () => startEditSubitem(row, subitem));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "is-danger";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => startDeleteSubitem(row, subitem));

    actions.append(edit, remove);
    row.append(name, actions);
    managerList.append(row);
  }
}

async function openManager(itemId, itemName) {
  if (!itemId) return;
  const dialog = ensureManagerDialog();
  managerItemId = itemId;
  managerItemName = itemName || "항목";
  if (managerTitle) managerTitle.textContent = `${managerItemName} · 하위항목`;
  if (managerInput) managerInput.value = "";
  setManagerMessage("");

  await refreshAll();
  renderManagerList();
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => managerInput?.focus(), 20);
}

async function toggleSubitem(subitem, shouldCheck, input) {
  const userId = await getUserId();
  if (!userId) return;
  input.disabled = true;

  if (shouldCheck) {
    const { error } = await supabase.from("subitem_completion_records").insert({
      user_id: userId,
      sub_item_id: subitem.id,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      input.checked = false;
      input.disabled = false;
      return;
    }
  } else {
    const current = currentRecordBySubitem.get(subitem.id);
    if (current) {
      const { error } = await supabase
        .from("subitem_completion_records")
        .delete()
        .eq("id", current.id)
        .eq("user_id", userId);

      if (error) {
        input.checked = true;
        input.disabled = false;
        return;
      }
    }
  }

  await refreshAll();
}

function renderCardSubitems(card) {
  if (!(card instanceof HTMLElement)) return;
  const itemId = card.dataset.itemId;
  if (!itemId) return;

  card.querySelector(".subitem-progress")?.remove();
  const rows = subitemsByItem.get(itemId) ?? [];
  if (rows.length === 0) return;

  const checkedCount = rows.filter((row) => currentRecordBySubitem.has(row.id)).length;
  const wrap = document.createElement("div");
  wrap.className = "subitem-progress";

  const heading = document.createElement("div");
  heading.className = "subitem-progress-heading";
  heading.innerHTML = `<span>하위항목</span><span>${checkedCount}/${rows.length}</span>`;

  const list = document.createElement("div");
  list.className = "subitem-progress-list";

  for (const subitem of rows) {
    const checked = currentRecordBySubitem.has(subitem.id);
    const label = document.createElement("label");
    label.className = `subitem-check-row${checked ? " is-checked" : ""}`;
    label.addEventListener("click", (event) => event.stopPropagation());

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.setAttribute("aria-label", `${subitem.name} 완료`);
    input.addEventListener("change", () => toggleSubitem(subitem, input.checked, input));

    const text = document.createElement("span");
    text.textContent = subitem.name;
    label.append(input, text);
    list.append(label);
  }

  wrap.append(heading, list);
  const bottom = card.querySelector(".item-card-bottom");
  if (bottom) card.insertBefore(wrap, bottom);
  else card.append(wrap);
}

function renderAllCards() {
  for (const card of document.querySelectorAll(".item-card[data-item-id]")) {
    renderCardSubitems(card);
  }
}

async function refreshAll() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const userId = await getUserId();
    const itemIds = getVisibleItemIds();

    subitemsByItem = new Map();
    currentRecordBySubitem = new Map();

    if (!userId || itemIds.length === 0) {
      renderAllCards();
      return;
    }

    const { data: subitems, error: subitemError } = await supabase
      .from("sub_items")
      .select("id, item_id, name, sort_order, created_at")
      .in("item_id", itemIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (subitemError) {
      console.error(subitemError);
      return;
    }

    for (const subitem of subitems ?? []) {
      if (!subitemsByItem.has(subitem.item_id)) subitemsByItem.set(subitem.item_id, []);
      subitemsByItem.get(subitem.item_id).push(subitem);
    }

    const { data: parentRecords, error: parentError } = await supabase
      .from("completion_records")
      .select("item_id, completed_at")
      .in("item_id", itemIds)
      .order("completed_at", { ascending: false });

    if (parentError) {
      console.error(parentError);
      return;
    }

    const latestParentByItem = new Map();
    for (const record of parentRecords ?? []) {
      if (!latestParentByItem.has(record.item_id)) {
        latestParentByItem.set(record.item_id, new Date(record.completed_at).getTime());
      }
    }

    const subitemIds = (subitems ?? []).map((subitem) => subitem.id);
    if (subitemIds.length > 0) {
      const { data: records, error: recordError } = await supabase
        .from("subitem_completion_records")
        .select("id, sub_item_id, completed_at")
        .in("sub_item_id", subitemIds)
        .order("completed_at", { ascending: false });

      if (recordError) {
        console.error(recordError);
        return;
      }

      const parentItemBySubitem = new Map((subitems ?? []).map((row) => [row.id, row.item_id]));
      for (const record of records ?? []) {
        if (currentRecordBySubitem.has(record.sub_item_id)) continue;
        const itemId = parentItemBySubitem.get(record.sub_item_id);
        const parentCompletedAt = latestParentByItem.get(itemId) ?? Number.NEGATIVE_INFINITY;
        const subCompletedAt = new Date(record.completed_at).getTime();
        if (subCompletedAt > parentCompletedAt) {
          currentRecordBySubitem.set(record.sub_item_id, record);
        }
      }
    }

    renderAllCards();
    if (managerDialog?.open && managerItemId) renderManagerList();
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshAll, 80);
}

function ensureActionDialogButton() {
  const list = document.querySelector(".item-action-dialog-list");
  if (!(list instanceof HTMLElement)) return;
  if (list.querySelector("[data-subitem-manage]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.subitemManage = "true";
  button.textContent = "하위항목 관리";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = lastActionItemId;
    const itemName = lastActionItemName;
    const actionDialog = button.closest("dialog");
    if (actionDialog?.open) actionDialog.close();
    window.setTimeout(() => openManager(itemId, itemName), 0);
  });

  const deleteButton = list.querySelector('[data-item-action="delete"]');
  if (deleteButton) list.insertBefore(button, deleteButton);
  else list.prepend(button);
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest(".item-card[data-item-id]");
    if (!(card instanceof HTMLElement)) return;

    lastActionItemId = card.dataset.itemId ?? null;
    lastActionItemName = card.querySelector(".item-title")?.textContent?.trim() || "항목";
    window.setTimeout(ensureActionDialogButton, 0);
  },
  true
);

const observer = new MutationObserver((mutations) => {
  let hasNewCards = false;
  let needsActionButton = false;

  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-card") || node.querySelector(".item-card")) hasNewCards = true;
      if (node.matches(".item-action-dialog") || node.querySelector(".item-action-dialog")) {
        needsActionButton = true;
      }
    }
  }

  if (hasNewCards) scheduleRefresh();
  if (needsActionButton) window.setTimeout(ensureActionDialogButton, 0);
});

observer.observe(document.body, { childList: true, subtree: true });

supabase.auth.onAuthStateChange((_event, session) => {
  currentUserId = session?.user?.id ?? null;
  scheduleRefresh();
});

window.addEventListener("app:subitems-changed", scheduleRefresh);

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

ensureManagerDialog();
ensureActionDialogButton();
ensureQuickActionDialog();
decorateAll();
scheduleRefresh();

const inlineObserver = new MutationObserver((mutations) => {
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

inlineObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
