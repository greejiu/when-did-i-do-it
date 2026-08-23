import { supabase } from "./supabase.js";
import { openHistoryModal } from "./history.js?v=1";

const recordList = document.querySelector("#global-record-list");
const recordStatus = document.querySelector("#global-record-status");
const SORT_MODE_KEY_PREFIX = "when-did-i-do-it:item-sort-mode:v1";

let currentUserId = null;
let onRecordsChanged = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function getRelationName(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name ?? "";
  return value.name ?? "";
}

function toLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addRepeatInterval(date, unit, interval) {
  const result = toLocalDay(date);

  if (unit === "day") {
    result.setDate(result.getDate() + interval);
    return result;
  }

  if (unit === "week") {
    result.setDate(result.getDate() + interval * 7);
    return result;
  }

  if (unit === "month") {
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + interval);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
  }

  return null;
}

function getNextDueDate(item, latestCompletedAt) {
  if (item.next_due_override) return parseDateOnly(item.next_due_override);
  if (!latestCompletedAt || !item.repeat_unit || !item.repeat_interval) return null;
  return addRepeatInterval(new Date(latestCompletedAt), item.repeat_unit, item.repeat_interval);
}

function getSortMode() {
  if (!currentUserId) return "due";
  const stored = window.localStorage.getItem(`${SORT_MODE_KEY_PREFIX}:${currentUserId}`);
  return ["due", "recent", "oldest", "manual"].includes(stored) ? stored : "due";
}

function sortItems(items, latestByItem) {
  const mode = getSortMode();

  return [...items].sort((a, b) => {
    if (mode === "manual") {
      const orderA = Number.isFinite(a.sort_order) ? a.sort_order : Number.POSITIVE_INFINITY;
      const orderB = Number.isFinite(b.sort_order) ? b.sort_order : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
    } else if (mode === "recent" || mode === "oldest") {
      const latestA = latestByItem.get(a.id);
      const latestB = latestByItem.get(b.id);
      const timeA = latestA ? new Date(latestA).getTime() : null;
      const timeB = latestB ? new Date(latestB).getTime() : null;

      if (timeA === null && timeB !== null) return 1;
      if (timeA !== null && timeB === null) return -1;
      if (timeA !== null && timeB !== null && timeA !== timeB) {
        return mode === "recent" ? timeB - timeA : timeA - timeB;
      }
    } else {
      const dueA = getNextDueDate(a, latestByItem.get(a.id) ?? null);
      const dueB = getNextDueDate(b, latestByItem.get(b.id) ?? null);
      const timeA = dueA ? toLocalDay(dueA).getTime() : null;
      const timeB = dueB ? toLocalDay(dueB).getTime() : null;

      if (timeA === null && timeB !== null) return 1;
      if (timeA !== null && timeB === null) return -1;
      if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function renderItems(items, countsByItem, latestByItem) {
  recordList.replaceChildren();
  recordStatus.textContent = `${items.length}개`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted global-record-empty";
    empty.textContent = "아직 등록한 항목이 없어요.";
    recordList.append(empty);
    return;
  }

  for (const item of sortItems(items, latestByItem)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "record-item-button";

    const main = document.createElement("div");
    main.className = "record-item-main";

    const name = document.createElement("strong");
    name.textContent = item.name;
    main.append(name);

    const meta = document.createElement("span");
    meta.className = "muted record-item-meta";

    const categoryName = getRelationName(item.categories);
    const sectionName = getRelationName(item.sections);
    const count = countsByItem.get(item.id) ?? 0;
    const latest = latestByItem.get(item.id) ?? null;

    const location = [categoryName, sectionName].filter(Boolean).join(" · ");
    const history = latest
      ? `기록 ${count}회 · 마지막 ${formatDate(latest)}`
      : "아직 완료 기록 없음";

    meta.textContent = location ? `${location} · ${history}` : history;
    main.append(meta);

    const arrow = document.createElement("span");
    arrow.className = "record-item-arrow";
    arrow.textContent = "›";
    arrow.setAttribute("aria-hidden", "true");

    button.append(main, arrow);
    button.addEventListener("click", () => {
      openHistoryModal(
        { id: item.id, name: item.name },
        currentUserId,
        async () => {
          await loadRecordItems();
          if (onRecordsChanged) await onRecordsChanged();
        }
      );
    });

    recordList.append(button);
  }
}

async function loadRecordItems() {
  if (!currentUserId) return;

  recordStatus.textContent = "불러오는 중...";
  recordList.replaceChildren();

  const { data: items, error: itemError } = await supabase
    .from("items")
    .select("id, name, created_at, sort_order, repeat_unit, repeat_interval, next_due_override, categories(name), sections(name)")
    .order("created_at", { ascending: true });

  if (itemError) {
    console.error(itemError);
    recordStatus.textContent = "불러오기 실패";
    recordList.textContent = "항목을 불러오지 못했어요.";
    return;
  }

  const rows = items ?? [];
  const itemIds = rows.map((item) => item.id);
  const countsByItem = new Map();
  const latestByItem = new Map();

  if (itemIds.length > 0) {
    const { data: records, error: recordError } = await supabase
      .from("completion_records")
      .select("item_id, completed_at")
      .in("item_id", itemIds)
      .order("completed_at", { ascending: false });

    if (recordError) {
      console.error(recordError);
      recordStatus.textContent = "불러오기 실패";
      recordList.textContent = "완료 기록을 불러오지 못했어요.";
      return;
    }

    for (const record of records ?? []) {
      countsByItem.set(record.item_id, (countsByItem.get(record.item_id) ?? 0) + 1);
      if (!latestByItem.has(record.item_id)) {
        latestByItem.set(record.item_id, record.completed_at);
      }
    }
  }

  renderItems(rows, countsByItem, latestByItem);
}

window.addEventListener("app:sort-changed", () => {
  if (currentUserId) void loadRecordItems();
});

export async function initializeRecordsUI(userId, changedCallback) {
  currentUserId = userId;
  onRecordsChanged = changedCallback;
  await loadRecordItems();
}

export async function refreshRecordsUI() {
  await loadRecordItems();
}

export function resetRecordsUI() {
  currentUserId = null;
  onRecordsChanged = null;
  recordList.replaceChildren();
  recordStatus.textContent = "";
}
