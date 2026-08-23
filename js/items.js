import { supabase } from "./supabase.js";
import { openHistoryModal } from "./history.js?v=1";

const addToggleButton = document.querySelector("#item-add-toggle");
const itemForm = document.querySelector("#item-form");
const cancelButton = document.querySelector("#item-cancel-button");
const itemNameInput = document.querySelector("#item-name");
const itemCategorySelect = document.querySelector("#item-category");
const itemSectionSelect = document.querySelector("#item-section");
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
let currentCategories = [];
let currentSections = [];
let editingItemId = null;

function setMessage(text) {
  itemMessage.textContent = text;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;
  cancelButton.disabled = isSaving;
}

function setEditingMode(itemId = null) {
  editingItemId = itemId;
  saveButton.textContent = itemId ? "수정 저장" : "저장";
}

function resetFormValues() {
  itemForm.reset();
  setEditingMode(null);
  repeatTypeSelect.value = "daily";
  updateRepeatFields();
  fillSectionOptions(itemCategorySelect.value, null, true);
  setMessage("");
}

function openForm() {
  resetFormValues();
  itemForm.classList.remove("hidden");
  addToggleButton.classList.add("hidden");
  itemNameInput.focus();
}

function closeForm() {
  resetFormValues();
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

function getRepeatTypeForItem(item) {
  if (!item.repeat_unit || !item.repeat_interval) {
    return "date_only";
  }

  if (item.repeat_unit === "day" && item.repeat_interval === 1) return "daily";
  if (item.repeat_unit === "week" && item.repeat_interval === 1) return "weekly";
  if (item.repeat_unit === "month" && item.repeat_interval === 1) return "monthly";
  if (item.repeat_unit === "day") return "n_days";
  return "custom";
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

function formatDate(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function getNextDueDate(item) {
  if (item.next_due_override) {
    return parseDateOnly(item.next_due_override);
  }

  if (!item.latest_completed_at || !item.repeat_unit || !item.repeat_interval) {
    return null;
  }

  return addRepeatInterval(new Date(item.latest_completed_at), item.repeat_unit, item.repeat_interval);
}

function getDueStatus(dueDate) {
  if (!dueDate) return null;

  const today = toLocalDay(new Date());
  const due = toLocalDay(dueDate);
  const difference = Math.round((due - today) / 86400000);

  if (difference > 0) {
    return { text: `${difference}일 남음`, className: "due-upcoming" };
  }

  if (difference === 0) {
    return { text: "오늘 예정", className: "due-today" };
  }

  return { text: `${Math.abs(difference)}일 지남`, className: "due-overdue" };
}

function sortItemsByDueDate(items) {
  return [...items].sort((a, b) => {
    const dueA = getNextDueDate(a);
    const dueB = getNextDueDate(b);
    const timeA = dueA ? toLocalDay(dueA).getTime() : Number.POSITIVE_INFINITY;
    const timeB = dueB ? toLocalDay(dueB).getTime() : Number.POSITIVE_INFINITY;

    if (timeA !== timeB) return timeA - timeB;

    const createdA = new Date(a.created_at).getTime();
    const createdB = new Date(b.created_at).getTime();
    return createdA - createdB;
  });
}

async function completeItem(item, button) {
  if (!currentUserId) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "기록 중...";

  const { error: insertError } = await supabase.from("completion_records").insert({
    user_id: currentUserId,
    item_id: item.id,
    completed_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error(insertError);
    button.disabled = false;
    button.textContent = originalText;
    window.alert(`완료 기록 저장 실패: ${insertError.message}`);
    return;
  }

  if (item.next_due_override) {
    const { error: updateError } = await supabase
      .from("items")
      .update({ next_due_override: null, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (updateError) console.error(updateError);
  }

  await loadItems();
}

function openEditForm(item) {
  setEditingMode(item.id);
  itemNameInput.value = item.name;
  itemCategorySelect.value = item.category_id;
  fillSectionOptions(item.category_id, item.section_id, false);

  const repeatType = getRepeatTypeForItem(item);
  repeatTypeSelect.value = repeatType;
  repeatNumberInput.value = String(item.repeat_interval ?? 2);
  repeatUnitSelect.value = item.repeat_unit ?? "day";
  nextDueInput.value = item.next_due_override ?? "";
  updateRepeatFields();

  setMessage("수정할 내용을 바꾼 뒤 저장해 주세요.");
  itemForm.classList.remove("hidden");
  addToggleButton.classList.add("hidden");
  itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
  itemNameInput.focus();
}

async function deleteItem(item, button) {
  const confirmed = window.confirm(
    `“${item.name}” 항목을 삭제할까요?\n이 항목의 완료 기록도 함께 삭제됩니다.`
  );

  if (!confirmed) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "삭제 중...";

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", item.id)
    .eq("user_id", currentUserId);

  if (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = originalText;
    window.alert(`삭제 실패: ${error.message}`);
    return;
  }

  if (editingItemId === item.id) closeForm();
  await loadItems();
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";

  const top = document.createElement("div");
  top.className = "item-card-top";

  const title = document.createElement("strong");
  title.className = "item-title";
  title.textContent = item.name;
  top.append(title);

  const meta = document.createElement("div");
  meta.className = "item-meta";

  const repeat = document.createElement("span");
  repeat.textContent = formatRepeat(item);
  meta.append(repeat);

  const lastCompleted = document.createElement("span");
  lastCompleted.textContent = item.latest_completed_at
    ? `마지막 완료 ${formatDate(new Date(item.latest_completed_at))}`
    : "아직 완료 기록 없음";
  meta.append(lastCompleted);

  const dueDate = getNextDueDate(item);
  const dueStatus = getDueStatus(dueDate);

  if (dueDate && dueStatus) {
    const nextDue = document.createElement("span");
    nextDue.textContent = `다음 예정 ${formatDate(dueDate)}`;
    meta.append(nextDue);

    const countdown = document.createElement("strong");
    countdown.className = `due-status ${dueStatus.className}`;
    countdown.textContent = dueStatus.text;
    meta.append(countdown);
  } else if (item.repeat_unit && item.repeat_interval) {
    const waiting = document.createElement("span");
    waiting.textContent = "첫 완료 후 다음 예정일 계산";
    meta.append(waiting);
  }

  const actions = document.createElement("div");
  actions.className = "item-card-actions";

  const historyButton = document.createElement("button");
  historyButton.type = "button";
  historyButton.className = "secondary item-action-button history-button";
  historyButton.textContent = "기록";
  historyButton.addEventListener("click", () => openHistoryModal(item, currentUserId, loadItems));

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary item-action-button edit-button";
  editButton.textContent = "편집";
  editButton.addEventListener("click", () => openEditForm(item));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "secondary item-action-button delete-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", () => deleteItem(item, deleteButton));

  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.className = "primary item-action-button complete-button";
  completeButton.textContent = "완료했어요";
  completeButton.addEventListener("click", () => completeItem(item, completeButton));

  actions.append(historyButton, editButton, deleteButton, completeButton);
  card.append(top, meta, actions);
  return card;
}

function appendSectionGroup(parent, titleText, items) {
  if (items.length === 0) return;

  const sortedItems = sortItemsByDueDate(items);
  const group = document.createElement("section");
  group.className = "item-section-group";

  const heading = document.createElement("div");
  heading.className = "item-section-heading";

  const title = document.createElement("h4");
  title.textContent = titleText;

  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = `${sortedItems.length}개`;

  heading.append(title, count);
  group.append(heading);

  const cards = document.createElement("div");
  cards.className = "item-section-cards";
  for (const item of sortedItems) cards.append(createItemCard(item));

  group.append(cards);
  parent.append(group);
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

  for (const category of currentCategories) {
    const categoryItems = items.filter((item) => item.category_id === category.id);
    if (categoryItems.length === 0) continue;

    const categoryGroup = document.createElement("section");
    categoryGroup.className = "item-category-group";

    const categoryHeading = document.createElement("div");
    categoryHeading.className = "item-category-heading";

    const categoryTitle = document.createElement("h3");
    categoryTitle.textContent = `${category.icon || ""} ${category.name}`.trim();

    const categoryCount = document.createElement("span");
    categoryCount.className = "muted";
    categoryCount.textContent = `${categoryItems.length}개`;

    categoryHeading.append(categoryTitle, categoryCount);
    categoryGroup.append(categoryHeading);

    const categorySections = currentSections.filter((section) => section.category_id === category.id);

    if (categorySections.length > 0) {
      for (const section of categorySections) {
        const sectionItems = categoryItems.filter((item) => item.section_id === section.id);
        appendSectionGroup(categoryGroup, section.name, sectionItems);
      }

      const noSectionItems = categoryItems.filter((item) => !item.section_id);
      appendSectionGroup(categoryGroup, "기타", noSectionItems);
    } else {
      const cards = document.createElement("div");
      cards.className = "item-section-cards";
      for (const item of sortItemsByDueDate(categoryItems)) cards.append(createItemCard(item));
      categoryGroup.append(cards);
    }

    itemList.append(categoryGroup);
  }
}

async function loadItems() {
  if (!currentUserId) return;

  itemStatus.textContent = "불러오는 중...";

  const { data: items, error: itemError } = await supabase
    .from("items")
    .select("id, category_id, section_id, name, repeat_unit, repeat_interval, next_due_override, created_at, categories(name, icon), sections(name, category_id)")
    .order("created_at", { ascending: true });

  if (itemError) throw itemError;

  const rows = items ?? [];
  const itemIds = rows.map((item) => item.id);
  const latestByItem = new Map();

  if (itemIds.length > 0) {
    const { data: records, error: recordError } = await supabase
      .from("completion_records")
      .select("item_id, completed_at")
      .in("item_id", itemIds)
      .order("completed_at", { ascending: false });

    if (recordError) throw recordError;

    for (const record of records ?? []) {
      if (!latestByItem.has(record.item_id)) {
        latestByItem.set(record.item_id, record.completed_at);
      }
    }
  }

  const enrichedItems = rows.map((item) => ({
    ...item,
    latest_completed_at: latestByItem.get(item.id) ?? null,
  }));

  renderItems(enrichedItems);
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

function fillSectionOptions(categoryId, selectedSectionId = null, useFallback = true) {
  itemSectionSelect.replaceChildren();
  const sections = currentSections.filter((section) => section.category_id === categoryId);

  if (sections.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "이 카테고리에는 섹션 없음";
    itemSectionSelect.append(option);
    itemSectionSelect.disabled = true;
    return;
  }

  itemSectionSelect.disabled = false;

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "섹션 선택";
  itemSectionSelect.append(emptyOption);

  for (const section of sections) {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    itemSectionSelect.append(option);
  }

  if (selectedSectionId && sections.some((section) => section.id === selectedSectionId)) {
    itemSectionSelect.value = selectedSectionId;
    return;
  }

  if (useFallback) {
    const fallback = sections.find((section) => section.name === "기타");
    if (fallback) itemSectionSelect.value = fallback.id;
  }
}

async function saveItem(event) {
  event.preventDefault();

  if (!currentUserId) return;

  const name = itemNameInput.value.trim();
  const categoryId = itemCategorySelect.value;
  const sectionId = itemSectionSelect.disabled ? null : itemSectionSelect.value || null;
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
  setMessage(editingItemId ? "수정 중..." : "저장 중...");

  const payload = {
    category_id: categoryId,
    section_id: sectionId,
    name,
    repeat_unit: repeat.repeat_unit,
    repeat_interval: repeat.repeat_interval,
    next_due_override: nextDue,
  };

  let error;

  if (editingItemId) {
    const result = await supabase
      .from("items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", editingItemId)
      .eq("user_id", currentUserId);
    error = result.error;
  } else {
    const result = await supabase.from("items").insert({
      ...payload,
      user_id: currentUserId,
    });
    error = result.error;
  }

  setSaving(false);

  if (error) {
    console.error(error);
    setMessage(`${editingItemId ? "수정" : "저장"} 실패: ${error.message}`);
    return;
  }

  closeForm();
  await loadItems();
}

export async function initializeItemsUI(userId, categories, sections) {
  currentUserId = userId;
  currentCategories = categories;
  currentSections = sections;

  fillCategoryOptions(categories);
  fillSectionOptions(itemCategorySelect.value, null, true);
  updateRepeatFields();

  addToggleButton.onclick = openForm;
  cancelButton.onclick = closeForm;
  repeatTypeSelect.onchange = updateRepeatFields;
  itemCategorySelect.onchange = () => fillSectionOptions(itemCategorySelect.value, null, true);
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
  currentCategories = [];
  currentSections = [];
  editingItemId = null;
  itemList.replaceChildren();
  itemStatus.textContent = "";
  closeForm();
}
