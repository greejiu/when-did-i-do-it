import { supabase } from "./supabase.js";
import { openHistoryModal } from "./history.js?v=2";

const recordList = document.querySelector("#global-record-list");
const recordStatus = document.querySelector("#global-record-status");

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

  for (const item of items) {
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
    .select("id, name, created_at, categories(name), sections(name)")
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
