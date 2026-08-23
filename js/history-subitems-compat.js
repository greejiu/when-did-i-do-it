import { supabase } from "./supabase.js";

const historyModal = document.querySelector("#history-modal");
const historyTitle = document.querySelector("#history-title");
const monthLabel = document.querySelector("#history-month-label");
const calendarGrid = document.querySelector("#history-calendar-grid");

let lastCardItemId = null;
let lastCardItemName = "";
let currentHistoryItemId = null;
let subitemCountsByDay = new Map();
let augmentTimer = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

async function resolveCurrentItemId() {
  const title = cleanText(historyTitle?.textContent);
  if (!title) return null;

  if (lastCardItemId && cleanText(lastCardItemName) === title) {
    return lastCardItemId;
  }

  const { data, error } = await supabase
    .from("items")
    .select("id, name, created_at")
    .eq("name", title)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0]?.id ?? null;
}

async function loadSubitemHistory() {
  if (!(historyModal instanceof HTMLDialogElement) || !historyModal.open) return;

  currentHistoryItemId = await resolveCurrentItemId();
  subitemCountsByDay = new Map();
  if (!currentHistoryItemId) {
    applyDots();
    return;
  }

  const { data: subitems, error: subitemError } = await supabase
    .from("sub_items")
    .select("id")
    .eq("item_id", currentHistoryItemId);

  if (subitemError) {
    console.error(subitemError);
    applyDots();
    return;
  }

  const ids = (subitems ?? []).map((row) => row.id);
  if (ids.length === 0) {
    applyDots();
    return;
  }

  const { data: records, error: recordError } = await supabase
    .from("subitem_completion_records")
    .select("completed_at")
    .in("sub_item_id", ids);

  if (recordError) {
    console.error(recordError);
    applyDots();
    return;
  }

  for (const record of records ?? []) {
    const key = toLocalDateKey(record.completed_at);
    subitemCountsByDay.set(key, (subitemCountsByDay.get(key) ?? 0) + 1);
  }

  applyDots();
}

function getVisibleYearMonth() {
  const match = cleanText(monthLabel?.textContent).match(/(\d{4})년\s*(\d{1,2})월/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function applyDots() {
  if (!(calendarGrid instanceof HTMLElement)) return;
  const visible = getVisibleYearMonth();
  if (!visible) return;

  for (const dayButton of calendarGrid.querySelectorAll(".history-calendar-day")) {
    dayButton.classList.remove("has-subitem-record");
    const day = Number(dayButton.firstChild?.textContent ?? dayButton.textContent);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;

    const key = `${visible.year}-${pad(visible.month)}-${pad(day)}`;
    const count = subitemCountsByDay.get(key) ?? 0;
    if (count <= 0) continue;

    dayButton.classList.add("has-subitem-record");
    const existingLabel = dayButton.getAttribute("aria-label") || `${visible.month}월 ${day}일`;
    if (!existingLabel.includes("하위 완료")) {
      dayButton.setAttribute("aria-label", `${existingLabel}, 하위 완료 ${count}개`);
    }
  }
}

function scheduleAugment({ reload = false } = {}) {
  window.clearTimeout(augmentTimer);
  augmentTimer = window.setTimeout(() => {
    if (reload) loadSubitemHistory();
    else applyDots();
  }, 60);
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest(".item-card[data-item-id]");
    if (!(card instanceof HTMLElement)) return;
    lastCardItemId = card.dataset.itemId ?? null;
    lastCardItemName = card.querySelector(".item-title")?.textContent?.trim() || "";
  },
  true
);

if (historyModal instanceof HTMLDialogElement) {
  const modalObserver = new MutationObserver(() => {
    if (historyModal.open) scheduleAugment({ reload: true });
    else {
      currentHistoryItemId = null;
      subitemCountsByDay = new Map();
    }
  });
  modalObserver.observe(historyModal, { attributes: true, attributeFilter: ["open"] });
}

if (calendarGrid instanceof HTMLElement) {
  const gridObserver = new MutationObserver(() => scheduleAugment());
  gridObserver.observe(calendarGrid, { childList: true, subtree: false });
}

if (historyModal?.open) scheduleAugment({ reload: true });
