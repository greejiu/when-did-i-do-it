import { supabase } from "./supabase.js";

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

ensureManagerDialog();
ensureActionDialogButton();
scheduleRefresh();
