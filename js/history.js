import { supabase } from "./supabase.js";

const modal = document.querySelector("#history-modal");
const closeButton = document.querySelector("#history-close");
const title = document.querySelector("#history-title");
const subtitle = document.querySelector("#history-subtitle");
const previousMonthButton = document.querySelector("#history-prev-month");
const nextMonthButton = document.querySelector("#history-next-month");
const monthLabel = document.querySelector("#history-month-label");
const calendarGrid = document.querySelector("#history-calendar-grid");
const addForm = document.querySelector("#history-add-form");
const dateInput = document.querySelector("#history-date");
const addButton = document.querySelector("#history-add-button");
const message = document.querySelector("#history-message");
const recordCount = document.querySelector("#history-record-count");
const recordList = document.querySelector("#history-record-list");
const historyRecordCard = modal?.querySelector(".history-record-card");

let currentUserId = null;
let currentItem = null;
let currentRecords = [];
let currentSubitemRecords = [];
let currentSubitemNames = new Map();
let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let onRecordsChanged = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timestampToDateKey(value) {
  return toDateKey(new Date(value));
}

function formatDateKey(value) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function dateKeyToIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

function isValidPastOrToday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
  return value <= todayKey();
}

function setMessage(text) {
  message.textContent = text;
}

function renderCalendar() {
  calendarGrid.replaceChildren();

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  monthLabel.textContent = `${year}년 ${month + 1}월`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const countsByDay = new Map();
  const subitemCountsByDay = new Map();

  for (const record of currentRecords) {
    const key = timestampToDateKey(record.completed_at);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  for (const record of currentSubitemRecords) {
    const key = timestampToDateKey(record.completed_at);
    subitemCountsByDay.set(key, (subitemCountsByDay.get(key) ?? 0) + 1);
  }

  for (let index = 0; index < firstWeekday; index += 1) {
    const blank = document.createElement("span");
    blank.className = "history-calendar-blank";
    calendarGrid.append(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-calendar-day";
    button.textContent = String(day);

    if (key === todayKey()) button.classList.add("is-today");
    if (key > todayKey()) {
      button.disabled = true;
      button.classList.add("is-future");
    } else {
      button.addEventListener("click", () => {
        dateInput.value = key;
        setMessage(`${formatDateKey(key)} 기록을 추가할 수 있어요.`);
      });
    }

    const count = countsByDay.get(key) ?? 0;
    const subitemCount = subitemCountsByDay.get(key) ?? 0;

    if (count > 0) {
      button.classList.add("has-record");
      const dot = document.createElement("span");
      dot.className = "history-calendar-dot";
      dot.setAttribute("aria-hidden", "true");
      button.append(dot);
    }

    if (subitemCount > 0) {
      button.classList.add("has-subitem-record");
    }

    if (count > 0 || subitemCount > 0) {
      const parts = [];
      if (count > 0) parts.push(`상위 완료 ${count}개`);
      if (subitemCount > 0) parts.push(`하위 완료 ${subitemCount}개`);
      button.setAttribute("aria-label", `${month + 1}월 ${day}일, ${parts.join(", ")}`);
    }

    calendarGrid.append(button);
  }
}

function createSmallButton(text, className = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} history-record-button`;
  button.textContent = text;
  return button;
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

function renderSubitemHistoryList() {
  const block = ensureSubitemHistoryBlock();
  if (!(block instanceof HTMLElement)) return;

  const list = block.querySelector(".subitem-history-list");
  const count = block.querySelector(".subitem-history-count");
  if (!(list instanceof HTMLElement)) return;

  list.replaceChildren();
  if (count) count.textContent = `${currentSubitemRecords.length}개`;

  if (currentSubitemRecords.length === 0) {
    block.hidden = true;
    return;
  }

  block.hidden = false;
  for (const record of currentSubitemRecords) {
    const row = document.createElement("div");
    row.className = "subitem-history-row";

    const date = document.createElement("strong");
    date.textContent = formatDateKey(timestampToDateKey(record.completed_at));

    const name = document.createElement("span");
    name.textContent = currentSubitemNames.get(record.sub_item_id) || "하위 할일";

    row.append(date, name);
    list.append(row);
  }
}

async function saveEditedRecord(record, value, row) {
  if (!isValidPastOrToday(value)) {
    window.alert("오늘 또는 과거 날짜를 선택해 주세요.");
    return;
  }

  const { error } = await supabase
    .from("completion_records")
    .update({ completed_at: dateKeyToIso(value) })
    .eq("id", record.id)
    .eq("user_id", currentUserId);

  if (error) {
    window.alert(`기록 수정 실패: ${error.message}`);
    return;
  }

  row.dataset.editing = "false";
  await refreshAfterChange("기록 날짜를 수정했어요.");
}

function startEditingRecord(record, row) {
  if (row.dataset.editing === "true") return;
  row.dataset.editing = "true";

  const currentKey = timestampToDateKey(record.completed_at);
  const left = row.querySelector(".history-record-main");
  const actions = row.querySelector(".history-record-actions");
  left.replaceChildren();
  actions.replaceChildren();

  const input = document.createElement("input");
  input.type = "date";
  input.className = "history-record-date-input";
  input.value = currentKey;
  input.max = todayKey();
  left.append(input);

  const saveButton = createSmallButton("저장", "primary");
  saveButton.addEventListener("click", () => saveEditedRecord(record, input.value, row));

  const cancelButton = createSmallButton("취소");
  cancelButton.addEventListener("click", renderRecordList);

  actions.append(saveButton, cancelButton);
  input.focus();
}

async function deleteRecord(record, button) {
  const key = timestampToDateKey(record.completed_at);
  if (!window.confirm(`${formatDateKey(key)} 완료 기록을 삭제할까요?`)) return;

  button.disabled = true;
  const { error } = await supabase
    .from("completion_records")
    .delete()
    .eq("id", record.id)
    .eq("user_id", currentUserId);

  if (error) {
    button.disabled = false;
    window.alert(`기록 삭제 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("기록을 삭제했어요.");
}

function renderRecordList() {
  recordList.replaceChildren();
  recordCount.textContent = `${currentRecords.length}개`;

  if (currentRecords.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted history-empty";
    empty.textContent = "아직 완료 기록이 없어요.";
    recordList.append(empty);
    return;
  }

  for (const record of currentRecords) {
    const row = document.createElement("div");
    row.className = "history-record-row";
    row.dataset.editing = "false";

    const main = document.createElement("div");
    main.className = "history-record-main";

    const date = document.createElement("strong");
    date.textContent = formatDateKey(timestampToDateKey(record.completed_at));
    main.append(date);

    const actions = document.createElement("div");
    actions.className = "history-record-actions";

    const editButton = createSmallButton("날짜 수정");
    editButton.addEventListener("click", () => startEditingRecord(record, row));

    const deleteButton = createSmallButton("삭제", "secondary danger-text");
    deleteButton.addEventListener("click", () => deleteRecord(record, deleteButton));

    actions.append(editButton, deleteButton);
    row.append(main, actions);
    recordList.append(row);
  }
}

async function loadRecords() {
  if (!currentItem) return;

  recordList.textContent = "불러오는 중...";
  const { data, error } = await supabase
    .from("completion_records")
    .select("id, completed_at, note, created_at")
    .eq("item_id", currentItem.id)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  currentRecords = data ?? [];

  const { data: subitems, error: subitemError } = await supabase
    .from("sub_items")
    .select("id, name")
    .eq("item_id", currentItem.id);

  if (subitemError) throw subitemError;

  currentSubitemNames = new Map((subitems ?? []).map((subitem) => [subitem.id, subitem.name]));
  const subitemIds = (subitems ?? []).map((subitem) => subitem.id);
  currentSubitemRecords = [];

  if (subitemIds.length > 0) {
    const { data: subRecords, error: subRecordError } = await supabase
      .from("subitem_completion_records")
      .select("id, sub_item_id, completed_at")
      .in("sub_item_id", subitemIds)
      .order("completed_at", { ascending: false });

    if (subRecordError) throw subRecordError;
    currentSubitemRecords = subRecords ?? [];
  }

  renderCalendar();
  renderRecordList();
  renderSubitemHistoryList();
}

async function refreshAfterChange(text) {
  await loadRecords();
  if (onRecordsChanged) await onRecordsChanged();
  setMessage(text);
}

async function addRecord(event) {
  event.preventDefault();
  if (!currentItem || !currentUserId) return;

  const value = dateInput.value;
  if (!isValidPastOrToday(value)) {
    setMessage("오늘 또는 과거 날짜를 선택해 주세요.");
    return;
  }

  addButton.disabled = true;
  addButton.textContent = "추가 중...";

  const { error } = await supabase.from("completion_records").insert({
    user_id: currentUserId,
    item_id: currentItem.id,
    completed_at: dateKeyToIso(value),
  });

  addButton.disabled = false;
  addButton.textContent = "+ 기록 추가";

  if (error) {
    setMessage(`기록 추가 실패: ${error.message}`);
    return;
  }

  visibleMonth = new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1);
  await refreshAfterChange(`${formatDateKey(value)} 완료 기록을 추가했어요.`);
}

function moveMonth(amount) {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
  renderCalendar();
}

export async function openHistoryModal(item, userId, changedCallback) {
  currentItem = item;
  currentUserId = userId;
  onRecordsChanged = changedCallback;
  visibleMonth = new Date();
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  dateInput.value = todayKey();
  dateInput.max = todayKey();
  title.textContent = item.name;
  subtitle.textContent = "큰 원은 상위 완료, 작은 점은 하위항목을 한 기록이에요.";
  setMessage("");

  document.body.classList.add("history-modal-open");
  if (!modal.open) modal.showModal();

  try {
    await loadRecords();
  } catch (error) {
    console.error(error);
    setMessage("완료 기록을 불러오지 못했어요.");
  }
}

function closeHistoryModal() {
  if (modal.open) modal.close();
  document.body.classList.remove("history-modal-open");
  currentItem = null;
  currentRecords = [];
  currentSubitemRecords = [];
  currentSubitemNames = new Map();
  onRecordsChanged = null;
  recordList.replaceChildren();
  calendarGrid.replaceChildren();
  renderSubitemHistoryList();
  setMessage("");
}

closeButton.onclick = closeHistoryModal;
previousMonthButton.onclick = () => moveMonth(-1);
nextMonthButton.onclick = () => moveMonth(1);
addForm.onsubmit = addRecord;

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeHistoryModal();
});

modal.addEventListener("close", () => {
  document.body.classList.remove("history-modal-open");
  currentItem = null;
  currentRecords = [];
  currentSubitemRecords = [];
  currentSubitemNames = new Map();
  onRecordsChanged = null;
  renderSubitemHistoryList();
});
