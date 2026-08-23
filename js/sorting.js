import { supabase } from "./supabase.js";

const SORT_MODE_KEY_PREFIX = "when-did-i-do-it:item-sort-mode:v1";
const DEFAULT_SORT_MODE = "due";
const VALID_SORT_MODES = new Set(["due", "recent", "oldest", "manual"]);

let currentUserId = null;
let currentSortMode = DEFAULT_SORT_MODE;
let manualOrder = [];
let manualOrderLoadedFor = null;
let applyTimer = null;
let dragState = null;

function modeStorageKey() {
  return `${SORT_MODE_KEY_PREFIX}:${currentUserId || "guest"}`;
}

function readStoredSortMode() {
  const stored = window.localStorage.getItem(modeStorageKey());
  return VALID_SORT_MODES.has(stored) ? stored : DEFAULT_SORT_MODE;
}

function saveSortMode(mode) {
  window.localStorage.setItem(modeStorageKey(), mode);
}

function getSettingsBlock() {
  const headings = document.querySelectorAll("#settings-view .settings-block-heading h3");
  for (const heading of headings) {
    if (heading.textContent?.trim() === "표시·정렬") {
      return heading.closest(".settings-block");
    }
  }
  return null;
}

function getSortHelperText(mode) {
  if (mode === "recent") return "마지막 완료일이 최근인 항목부터 보여줘요. 완료 기록이 없는 항목은 아래로 내려가요.";
  if (mode === "oldest") return "마지막 완료일이 오래된 항목부터 보여줘요. 완료 기록이 없는 항목은 아래로 내려가요.";
  if (mode === "manual") return "항목 왼쪽의 ≡ 손잡이를 끌어서 원하는 순서로 바꿀 수 있어요. 수동 순서는 계정에 저장돼요.";
  return "기한 지난 항목 → 오늘 → 남은 날짜가 적은 항목 순으로 보여줘요. 예정일이 없는 항목은 아래로 내려가요.";
}

function injectStyles() {
  if (document.querySelector("#item-sorting-style")) return;

  const style = document.createElement("style");
  style.id = "item-sorting-style";
  style.textContent = `
    .sort-setting-control {
      margin-top: 14px;
      display: grid;
      gap: 8px;
    }

    .sort-setting-control label {
      display: grid;
      gap: 7px;
      font-weight: 700;
    }

    .sort-setting-control select {
      width: 100%;
      min-height: 44px;
    }

    .sort-setting-helper {
      margin: 0;
    }

    .sort-drag-handle {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      min-width: 34px;
      padding: 0;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .sort-drag-handle:active {
      cursor: grabbing;
    }

    .item-card.is-sort-dragging {
      opacity: 0.62;
      transform: scale(0.995);
    }

    body:not(.item-sort-mode-manual) .sort-drag-handle {
      display: none;
    }
  `;
  document.head.append(style);
}

function ensureSortControls() {
  const block = getSettingsBlock();
  if (!block) return null;

  let control = block.querySelector("#item-sort-setting");
  if (!control) {
    control = document.createElement("div");
    control.id = "item-sort-setting";
    control.className = "sort-setting-control";

    const label = document.createElement("label");
    label.htmlFor = "item-sort-mode";
    label.append(document.createTextNode("항목 정렬"));

    const select = document.createElement("select");
    select.id = "item-sort-mode";
    select.innerHTML = `
      <option value="due">임박순</option>
      <option value="recent">최근 날짜순</option>
      <option value="oldest">오래된 날짜순</option>
      <option value="manual">수동</option>
    `;
    label.append(select);

    const helper = document.createElement("p");
    helper.id = "item-sort-helper";
    helper.className = "helper sort-setting-helper";

    control.append(label, helper);
    block.append(control);

    select.addEventListener("change", async () => {
      const nextMode = VALID_SORT_MODES.has(select.value) ? select.value : DEFAULT_SORT_MODE;
      currentSortMode = nextMode;
      saveSortMode(nextMode);

      if (nextMode === "manual") {
        await loadManualOrder(true);
      }

      syncSortControl();
      scheduleApplySort();
    });
  }

  syncSortControl();
  return control;
}

function syncSortControl() {
  const select = document.querySelector("#item-sort-mode");
  const helper = document.querySelector("#item-sort-helper");

  if (select instanceof HTMLSelectElement) select.value = currentSortMode;
  if (helper instanceof HTMLElement) helper.textContent = getSortHelperText(currentSortMode);

  document.body.classList.toggle("item-sort-mode-manual", currentSortMode === "manual");
  syncDragHandles();
}

function parseDateText(text, prefix) {
  if (!text?.startsWith(prefix)) return null;
  const match = text.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

function findMetaDate(card, prefix) {
  for (const node of card.querySelectorAll(".item-meta span")) {
    const value = parseDateText(node.textContent?.trim(), prefix);
    if (value !== null) return value;
  }
  return null;
}

function getManualRank(card) {
  const id = card.dataset.itemId;
  const index = id ? manualOrder.indexOf(id) : -1;
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function getCardSortValue(card, mode = currentSortMode) {
  if (mode === "manual") return getManualRank(card);
  if (mode === "recent" || mode === "oldest") return findMetaDate(card, "마지막 완료");
  return findMetaDate(card, "다음 예정");
}

function compareCards(a, b) {
  const valueA = getCardSortValue(a);
  const valueB = getCardSortValue(b);
  const missingA = valueA === null || !Number.isFinite(valueA);
  const missingB = valueB === null || !Number.isFinite(valueB);

  if (missingA !== missingB) return missingA ? 1 : -1;
  if (!missingA && valueA !== valueB) {
    return currentSortMode === "recent" ? valueB - valueA : valueA - valueB;
  }

  const titleA = a.querySelector(".item-title")?.textContent?.trim() || "";
  const titleB = b.querySelector(".item-title")?.textContent?.trim() || "";
  return titleA.localeCompare(titleB, "ko");
}

function getGroupSortValue(group) {
  const cards = Array.from(group.querySelectorAll(".item-card"));
  const values = cards
    .map((card) => getCardSortValue(card))
    .filter((value) => value !== null && Number.isFinite(value));

  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return currentSortMode === "recent" ? Math.max(...values) : Math.min(...values);
}

function compareGroups(a, b) {
  const valueA = getGroupSortValue(a);
  const valueB = getGroupSortValue(b);
  const missingA = !Number.isFinite(valueA);
  const missingB = !Number.isFinite(valueB);

  if (missingA !== missingB) return missingA ? 1 : -1;
  if (!missingA && valueA !== valueB) {
    return currentSortMode === "recent" ? valueB - valueA : valueA - valueB;
  }

  const titleA = a.querySelector("h3, h4")?.textContent?.trim() || "";
  const titleB = b.querySelector("h3, h4")?.textContent?.trim() || "";
  return titleA.localeCompare(titleB, "ko");
}

function reorderChildren(parent, desired) {
  const current = Array.from(parent.children).filter((child) => desired.includes(child));
  if (current.length !== desired.length) return;
  if (current.every((child, index) => child === desired[index])) return;

  for (const child of desired) parent.append(child);
}

function sortCardsInContainer(container) {
  const cards = Array.from(container.querySelectorAll(":scope > .item-card"));
  if (cards.length < 2) return;
  const desired = [...cards].sort(compareCards);
  reorderChildren(container, desired);
}

function sortSectionGroups(categoryGroup) {
  const groups = Array.from(categoryGroup.querySelectorAll(":scope > .item-section-group"));
  if (groups.length < 2) return;
  const desired = [...groups].sort(compareGroups);
  reorderChildren(categoryGroup, desired);
}

function sortCategoryGroups(root) {
  const groups = Array.from(root.querySelectorAll(":scope > .item-category-group"));
  if (groups.length < 2) return;
  const desired = [...groups].sort(compareGroups);
  reorderChildren(root, desired);
}

function applySort() {
  ensureSortControls();

  for (const root of [document.querySelector("#item-list"), document.querySelector("#category-item-list")]) {
    if (!(root instanceof HTMLElement)) continue;

    for (const container of root.querySelectorAll(".item-section-cards")) {
      sortCardsInContainer(container);
    }

    for (const categoryGroup of root.querySelectorAll(".item-category-group")) {
      sortSectionGroups(categoryGroup);
    }

    sortCategoryGroups(root);
  }

  syncDragHandles();
}

function scheduleApplySort() {
  window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(applySort, 30);
}

async function loadManualOrder(force = false) {
  if (!currentUserId) {
    manualOrder = [];
    manualOrderLoadedFor = null;
    return;
  }

  if (!force && manualOrderLoadedFor === currentUserId) return;

  const { data, error } = await supabase
    .from("items")
    .select("id, sort_order, created_at")
    .eq("user_id", currentUserId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("수동 정렬 순서를 불러오지 못했어요.", error);
    manualOrder = [];
    manualOrderLoadedFor = currentUserId;
    return;
  }

  manualOrder = (data ?? []).map((item) => item.id);
  manualOrderLoadedFor = currentUserId;
}

function mergeContainerOrder(container) {
  const ids = Array.from(container.querySelectorAll(":scope > .item-card"))
    .map((card) => card.dataset.itemId)
    .filter(Boolean);

  if (ids.length === 0) return [];

  for (const id of ids) {
    if (!manualOrder.includes(id)) manualOrder.push(id);
  }

  const idSet = new Set(ids);
  const positions = manualOrder
    .map((id, index) => (idSet.has(id) ? index : -1))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  ids.forEach((id, index) => {
    if (positions[index] !== undefined) manualOrder[positions[index]] = id;
  });

  return ids;
}

async function persistContainerOrder(container) {
  if (!currentUserId) return;

  if (manualOrderLoadedFor !== currentUserId) {
    await loadManualOrder(true);
  }

  const changedIds = mergeContainerOrder(container);
  if (changedIds.length === 0) return;

  const updates = changedIds.map(async (id) => {
    const sortOrder = manualOrder.indexOf(id);
    const { error } = await supabase
      .from("items")
      .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", currentUserId);

    if (error) throw error;
  });

  try {
    await Promise.all(updates);
  } catch (error) {
    console.error("수동 정렬 순서를 저장하지 못했어요.", error);
    await loadManualOrder(true);
  }

  scheduleApplySort();
}

function finishPointerDrag(handle, pointerId, cancelled = false) {
  if (!dragState || dragState.handle !== handle || dragState.pointerId !== pointerId) return;

  const { card, container } = dragState;
  card.classList.remove("is-sort-dragging");

  try {
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
  } catch {
    // 이미 포인터 캡처가 끝난 경우는 무시한다.
  }

  dragState = null;
  if (!cancelled) void persistContainerOrder(container);
}

function attachDragHandle(card) {
  let handle = card.querySelector(":scope .sort-drag-handle");
  if (!(handle instanceof HTMLButtonElement)) {
    handle = document.createElement("button");
    handle.type = "button";
    handle.className = "sort-drag-handle";
    handle.textContent = "≡";
    handle.setAttribute("aria-label", "순서 바꾸기");
    handle.title = "끌어서 순서 바꾸기";

    const top = card.querySelector(".item-card-top");
    if (top) top.prepend(handle);
  }

  if (handle.dataset.sortBound === "true") return;
  handle.dataset.sortBound = "true";

  handle.addEventListener("pointerdown", (event) => {
    if (currentSortMode !== "manual") return;
    const container = card.parentElement;
    if (!(container instanceof HTMLElement) || !container.classList.contains("item-section-cards")) return;

    event.preventDefault();
    dragState = { card, container, handle, pointerId: event.pointerId };
    card.classList.add("is-sort-dragging");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.handle !== handle || dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".item-card");
    if (!(target instanceof HTMLElement)) return;
    if (target === dragState.card || target.parentElement !== dragState.container) return;

    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    dragState.container.insertBefore(dragState.card, before ? target : target.nextSibling);
  });

  handle.addEventListener("pointerup", (event) => finishPointerDrag(handle, event.pointerId, false));
  handle.addEventListener("pointercancel", (event) => finishPointerDrag(handle, event.pointerId, true));

  handle.addEventListener("keydown", (event) => {
    if (currentSortMode !== "manual") return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const container = card.parentElement;
    if (!(container instanceof HTMLElement)) return;

    const sibling = event.key === "ArrowUp" ? card.previousElementSibling : card.nextElementSibling;
    if (!(sibling instanceof HTMLElement) || !sibling.classList.contains("item-card")) return;

    event.preventDefault();
    if (event.key === "ArrowUp") container.insertBefore(card, sibling);
    else container.insertBefore(sibling, card);

    void persistContainerOrder(container);
    handle.focus();
  });
}

function syncDragHandles() {
  for (const card of document.querySelectorAll(".item-card")) {
    attachDragHandle(card);
  }
}

async function setCurrentUser(userId) {
  currentUserId = userId || null;
  currentSortMode = readStoredSortMode();
  manualOrder = [];
  manualOrderLoadedFor = null;

  if (currentSortMode === "manual" && currentUserId) {
    await loadManualOrder(true);
  }

  syncSortControl();
  scheduleApplySort();
}

async function initializeUser() {
  const { data } = await supabase.auth.getUser();
  await setCurrentUser(data.user?.id ?? null);
}

injectStyles();
ensureSortControls();
void initializeUser();

supabase.auth.onAuthStateChange((_event, session) => {
  void setCurrentUser(session?.user?.id ?? null);
});

const observer = new MutationObserver((mutations) => {
  let shouldApply = false;

  for (const mutation of mutations) {
    if (mutation.type === "childList" && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
      shouldApply = true;
      break;
    }
  }

  if (shouldApply) scheduleApplySort();
});

observer.observe(document.body, { childList: true, subtree: true });
