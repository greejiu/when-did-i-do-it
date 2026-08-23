import { supabase } from "./supabase.js";
import { openHistoryModal } from "./history.js?v=1";

const recordList = document.querySelector("#global-record-list");
const recordStatus = document.querySelector("#global-record-status");

let currentUserId = null;
let onRecordsChanged = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateKey(value) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function getItem(record) {
  if (Array.isArray(record.items)) return record.items[0] ?? null;
  return record.items ?? null;
}

function getCategoryName(item) {
  if (!item?.categories) return "";
  if (Array.isArray(item.categories)) return item.categories[0]?.name ?? "";
  return item.categories.name ?? "";
}

function renderRecords(records) {
  recordList.replaceChildren();
  recordStatus.textContent = `${records.length}개`;

  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted global-record-empty";
    empty.textContent = "아직 완료 기록이 없어요.";
    recordList.append(empty);
    return;
  }

  const groups = new Map();
  for (const record of records) {
    const key = toDateKey(record.completed_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  for (const [dateKey, dayRecords] of groups) {
    const group = document.createElement("section");
    group.className = "global-record-group";

    const heading = document.createElement("div");
    heading.className = "global-record-date";

    const date = document.createElement("strong");
    date.textContent = formatDateKey(dateKey);

    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = `${dayRecords.length}개`;

    heading.append(date, count);
    group.append(heading);

    const rows = document.createElement("div");
    rows.className = "global-record-rows";

    for (const record of dayRecords) {
      const item = getItem(record);
      if (!item) continue;

      const row = document.createElement("div");
      row.className = "global-record-row";

      const main = document.createElement("div");
      main.className = "global-record-main";

      const itemName = document.createElement("strong");
      itemName.textContent = item.name;
      main.append(itemName);

      const categoryName = getCategoryName(item);
      if (categoryName) {
        const category = document.createElement("span");
        category.className = "muted global-record-category";
        category.textContent = categoryName;
        main.append(category);
      }

      const calendarButton = document.createElement("button");
      calendarButton.type = "button";
      calendarButton.className = "secondary global-record-button";
      calendarButton.textContent = "달력";
      calendarButton.addEventListener("click", () => {
        openHistoryModal(
          { id: item.id, name: item.name },
          currentUserId,
          async () => {
            await loadGlobalRecords();
            if (onRecordsChanged) await onRecordsChanged();
          }
        );
      });

      row.append(main, calendarButton);
      rows.append(row);
    }

    group.append(rows);
    recordList.append(group);
  }
}

async function loadGlobalRecords() {
  if (!currentUserId) return;

  recordStatus.textContent = "불러오는 중...";
  recordList.textContent = "";

  const { data, error } = await supabase
    .from("completion_records")
    .select("id, item_id, completed_at, items(id, name, categories(name))")
    .order("completed_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    recordStatus.textContent = "불러오기 실패";
    recordList.textContent = "완료 기록을 불러오지 못했어요.";
    return;
  }

  renderRecords(data ?? []);
}

export async function initializeRecordsUI(userId, changedCallback) {
  currentUserId = userId;
  onRecordsChanged = changedCallback;
  await loadGlobalRecords();
}

export async function refreshRecordsUI() {
  await loadGlobalRecords();
}

export function resetRecordsUI() {
  currentUserId = null;
  onRecordsChanged = null;
  recordList.replaceChildren();
  recordStatus.textContent = "";
}
