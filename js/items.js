import { supabase } from "./supabase.js";

const addToggleButton = document.querySelector("#item-add-toggle");
const itemForm = document.querySelector("#item-form");
const cancelButton = document.querySelector("#item-cancel-button");
const itemNameInput = document.querySelector("#item-name");
const itemIconInput = document.querySelector("#item-icon");
const itemCategorySelect = document.querySelector("#item-category");
const repeatTypeSelect = document.querySelector("#repeat-type");
const repeatNumberGroup = document.querySelector("#repeat-number-group");
const repeatNumberLabel = document.querySelector("#repeat-number-label");
const repeatNumberInput = document.querySelector("#repeat-number");
const repeatUnitGroup = document.querySelector("#repeat-unit-group");
const repeatUnitSelect = document.querySelector("#repeat-unit");
const nextDueInput = document.querySelector("#next-due-override");
const itemMessage = document.querySelector("#item-message");
const itemList = document.querySelector("#item-list");
const itemStatus = document.querySelector("#item-status");
const saveButton = document.querySelector("#item-save-button");

let currentUserId = null;

function setMessage(text) {
  itemMessage.textContent = text;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;
  cancelButton.disabled = isSaving;
}

function openForm() {
  itemForm.classList.remove("hidden");
  addToggleButton.classList.add("hidden");
  itemNameInput.focus();
}

function closeForm() {
  itemForm.reset();
  repeatTypeSelect.value = "daily";
  updateRepeatFields();
  setMessage("");
  itemForm.classList.add("hidden");
  addToggleButton.classList.remove("hidden");
}

function updateRepeatFields() {
  const type = repeatTypeSelect.value;
  const needsNumber = type === "n_days" || type === "custom";
  const needsUnit = type === "custom";

  repeatNumberGroup.classList.toggle("hidden", !needsNumber);
  repeatUnitGroup.classList.toggle("hidden", !needsUnit);

  repeatNumberInput.required = needsNumber;
  repeatUnitSelect.required = needsUnit;

  if (type === "n_days") {
    repeatNumberLabel.textContent = "몇 일마다";
  } else if (type === "custom") {
    repeatNumberLabel.textContent = "반복 간격";
  }
}

function getRepeatValues() {
  const type = repeatTypeSelect.value;

  if (type === "daily") return { repeat_unit: "day", repeat_interval: 1 };
  if (type === "weekly") return { repeat_unit: "week", repeat_interval: 1 };
  if (type === "monthly") return { repeat_unit: "month", repeat_interval: 1 };

  if (type === "n_days") {
    return {
      repeat_unit: "day",
      repeat_interval: Number(repeatNumberInput.value),
    };
  }

  if (type === "custom") {
    return {
      repeat_unit: repeatUnitSelect.value,
      repeat_interval: Number(repeatNumberInput.value),
    };
  }

  return { repeat_unit: null, repeat_interval: null };
}

function formatRepeat(item) {
  if (!item.repeat_unit || !item.repeat_interval) {
    return item.next_due_override ? "다음 예정일 직접 지정" : "반복 없음";
  }

  const unitLabel = {
    day: "일",
    week: "주",
    month: "개월",
  }[item.repeat_unit];

  if (item.repeat_interval === 1) {
    if (item.repeat_unit === "day") return "매일";
    if (item.repeat_unit === "week") return "매주";
    if (item.repeat_unit === "month") return "매월";
  }

  return `${item.repeat_interval}${unitLabel}마다`;
}

function renderItems(items) {
  itemList.replaceChildren();
  itemStatus.textContent = `${items.length}개`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted empty-state";
    empty.textContent = "아직 등록한 항목이 없어요.";
    itemList.append(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "item-card";

    const top = document.createElement("div");
    top.className = "item-card-top";

    const title = document.createElement("strong");
    title.className = "item-title";
    title.textContent = `${item.icon || "•"} ${item.name}`;

    const category = document.createElement("span");
    category.className = "item-category";
    category.textContent = item.categories
      ? `${item.categories.icon || ""} ${item.categories.name}`.trim()
      : "카테고리 없음";

    top.append(title, category);

    const meta = document.createElement("div");
    meta.className = "item-meta";

    const repeat = document.createElement("span");
    repeat.textContent = formatRepeat(item);
    meta.append(repeat);

    if (item.next_due_override) {
      const nextDue = document.createElement("span");
      nextDue.textContent = `다음 예정 ${item.next_due_override}`;
      meta.append(nextDue);
    }

    card.append(top, meta);
    itemList.append(card);
  }
}

async function loadItems() {
  if (!currentUserId) return;

  itemStatus.textContent = "불러오는 중...";

  const { data, error } = await supabase
    .from("items")
    .select("id, name, icon, repeat_unit, repeat_interval, next_due_override, created_at, categories(name, icon)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  renderItems(data ?? []);
}

function fillCategoryOptions(categories) {
  itemCategorySelect.replaceChildren();

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon || ""} ${category.name}`.trim();
    itemCategorySelect.append(option);
  }
}

async function saveItem(event) {
  event.preventDefault();

  if (!currentUserId) return;

  const name = itemNameInput.value.trim();
  const icon = itemIconInput.value.trim();
  const categoryId = itemCategorySelect.value;
  const repeatType = repeatTypeSelect.value;
  const nextDue = nextDueInput.value || null;
  const repeat = getRepeatValues();

  if (!name || !categoryId) {
    setMessage("내용과 카테고리를 입력해 주세요.");
    return;
  }

  if (repeat.repeat_interval !== null && (!Number.isInteger(repeat.repeat_interval) || repeat.repeat_interval < 1)) {
    setMessage("반복 간격은 1 이상의 숫자로 입력해 주세요.");
    return;
  }

  if (repeatType === "date_only" && !nextDue) {
    setMessage("다음 예정일을 선택해 주세요.");
    return;
  }

  setSaving(true);
  setMessage("저장 중...");

  const { error } = await supabase.from("items").insert({
    user_id: currentUserId,
    category_id: categoryId,
    name,
    icon: icon || null,
    repeat_unit: repeat.repeat_unit,
    repeat_interval: repeat.repeat_interval,
    next_due_override: nextDue,
  });

  setSaving(false);

  if (error) {
    console.error(error);
    setMessage(`저장 실패: ${error.message}`);
    return;
  }

  closeForm();
  await loadItems();
}

export async function initializeItemsUI(userId, categories) {
  currentUserId = userId;
  fillCategoryOptions(categories);
  updateRepeatFields();

  addToggleButton.onclick = openForm;
  cancelButton.onclick = closeForm;
  repeatTypeSelect.onchange = updateRepeatFields;
  itemForm.onsubmit = saveItem;

  try {
    await loadItems();
  } catch (error) {
    console.error(error);
    itemStatus.textContent = "불러오기 실패";
    itemList.textContent = "관리 항목을 불러오지 못했어요.";
  }
}

export function resetItemsUI() {
  currentUserId = null;
  itemList.replaceChildren();
  itemStatus.textContent = "";
  closeForm();
}
