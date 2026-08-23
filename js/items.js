import { supabase } from "./supabase.js";
import { openHistoryModal } from "./history.js?v=2";

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
const categoryFilterList = document.querySelector("#category-filter-list");
const categoryStatus = document.querySelector("#category-status");
const categoryItemList = document.querySelector("#category-item-list");
const categoryItemStatus = document.querySelector("#category-item-status");

let currentUserId = null;
let currentCategories = [];
let currentSections = [];
let currentItems = [];
let editingItemId = null;
let selectedCategoryId = null;

function setMessage(text) {
  itemMessage.textContent = text;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;
  cancelButton.disabled = isSaving;
  saveButton.textContent = isSaving ? "저장 중..." : editingItemId ? "수정 저장" : "저장";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function addMonths(date, amount) {
  const copy = new Date(date);
  const currentDay = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + amount);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(currentDay, lastDay));
  return copy;
}

function formatRelativeText(nextDueAt) {
  if (!nextDueAt) return null;

  const today = startOfDay();
  const dueDate = startOfDay(new Date(nextDueAt));
  const diffMs = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `${diffDays}일 남음`;
  if (diffDays === 0) return "오늘";
  return `${Math.abs(diffDays)}일 지남`;
}

function getSectionOptionsForCategory(categoryId) {
  return currentSections.filter((section) => section.category_id === categoryId);
}

function resetFormForCreate() {
  editingItemId = null;
  itemForm.reset();
  repeatTypeSelect.value = "daily";
  repeatNumberInput.value = "2";
  repeatUnitSelect.value = "day";
  nextDueInput.value = "";
  itemMessage.textContent = "";
  applyRepeatVisibility();
  fillCategoryOptions();
  fillSectionOptions();
  setSaving(false);
}

function openFormForCreate() {
  resetFormForCreate();
  itemForm.classList.remove("hidden");
  itemNameInput.focus();
}

function closeForm() {
  itemForm.classList.add("hidden");
  resetFormForCreate();
}

function applyRepeatVisibility() {
  const type = repeatTypeSelect.value;

  const showNumber = type === "n_days" || type === "custom";
  const showUnit = type === "custom";

  repeatNumberGroup.classList.toggle("hidden", !showNumber);
  repeatUnitGroup.classList.toggle("hidden", !showUnit);

  if (type === "n_days") {
    repeatNumberLabel.textContent = "며칠마다";
    repeatNumberInput.min = "1";
    repeatNumberInput.step = "1";
  } else if (type === "custom") {
    repeatNumberLabel.textContent = "반복 간격";
    repeatNumberInput.min = "1";
    repeatNumberInput.step = "1";
  }
}

function fillCategoryOptions() {
  const selectedValue = itemCategorySelect.value;
  itemCategorySelect.replaceChildren();

  currentCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    itemCategorySelect.append(option);
  });

  if (selectedValue && currentCategories.some((category) => category.id === selectedValue)) {
    itemCategorySelect.value = selectedValue;
    return;
  }

  if (currentCategories.length > 0) {
    itemCategorySelect.value = currentCategories[0].id;
  }
}

function fillSectionOptions(preferredId = null) {
  const categoryId = itemCategorySelect.value;
  const sections = getSectionOptionsForCategory(categoryId);
  const previousValue = preferredId ?? itemSectionSelect.value;

  itemSectionSelect.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "선택 안 함";
  itemSectionSelect.append(emptyOption);

  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    itemSectionSelect.append(option);
  });

  if (previousValue && sections.some((section) => section.id === previousValue)) {
    itemSectionSelect.value = previousValue;
  } else {
    itemSectionSelect.value = "";
  }
}

function getDueDateFromRepeat({ type, number, unit, baseDate }) {
  const basis = startOfDay(baseDate);

  switch (type) {
    case "daily":
      return addDays(basis, 1).toISOString();
    case "n_days":
      return addDays(basis, number).toISOString();
    case "weekly":
      return addDays(basis, 7).toISOString();
    case "monthly":
      return addMonths(basis, 1).toISOString();
    case "custom": {
      if (unit === "week") return addDays(basis, number * 7).toISOString();
      if (unit === "month") return addMonths(basis, number).toISOString();
      return addDays(basis, number).toISOString();
    }
    case "date_only":
      return null;
    default:
      return null;
  }
}

function buildRepeatSummary(item) {
  if (item.repeat_type === "daily") return "매일";
  if (item.repeat_type === "n_days") return `${item.repeat_interval || 1}일마다`;
  if (item.repeat_type === "weekly") return "매주";
  if (item.repeat_type === "monthly") return "매월";
  if (item.repeat_type === "custom") {
    const number = item.repeat_interval || 1;
    const unit = item.repeat_unit || "day";
    const unitText = unit === "week" ? "주" : unit === "month" ? "개월" : "일";
    return `${number}${unitText}마다`;
  }
  if (item.repeat_type === "date_only") return "반복 없음";
  return "반복 없음";
}

function createEmptyState(text) {
  const empty = document.createElement("p");
  empty.className = "muted";
  empty.textContent = text;
  return empty;
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "card item-card item-card-compact";
  card.dataset.itemId = item.id;

  const top = document.createElement("div");
  top.className = "item-card-top";

  const title = document.createElement("h4");
  title.className = "item-title";
  title.textContent = item.name;

  const topActions = document.createElement("div");
  topActions.className = "item-top-actions";

  const categoryName = currentCategories.find((category) => category.id === item.category_id)?.name ?? "";
  const categoryText = categoryName.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "").trim();

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "item-category-badge";
  categoryBadge.textContent = `(${categoryText})`;

  const overflowButton = document.createElement("button");
  overflowButton.type = "button";
  overflowButton.className = "secondary item-overflow-button hidden";
  overflowButton.textContent = "⋯";
  overflowButton.setAttribute("aria-label", `${item.name} 메뉴 열기`);

  topActions.append(categoryBadge, overflowButton);
  top.append(title, topActions);

  const bottom = document.createElement("div");
  bottom.className = "item-card-bottom";

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.append(
    Object.assign(document.createElement("span"), { textContent: buildRepeatSummary(item) }),
    Object.assign(document.createElement("span"), {
      textContent: item.last_completed_at
        ? `마지막 완료 ${formatDate(item.last_completed_at)}`
        : "아직 완료 기록 없음",
    }),
    Object.assign(document.createElement("span"), {
      textContent: item.next_due_at
        ? `다음 예정 ${formatDate(item.next_due_at)}`
        : "다음 예정 없음",
    })
  );

  const relativeText = formatRelativeText(item.next_due_at);
  if (relativeText) {
    meta.append(Object.assign(document.createElement("strong"), { textContent: relativeText }));
  }

  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.className = "primary complete-button";
  completeButton.textContent = "완료했어요";
  completeButton.addEventListener("click", async () => {
    completeButton.disabled = true;
    completeButton.textContent = "저장 중...";

    try {
      const now = new Date();
      const { error: recordError } = await supabase.from("completion_records").insert({
        user_id: currentUserId,
        item_id: item.id,
        completed_at: now.toISOString(),
      });
      if (recordError) throw recordError;

      const nextDueOverride = nextDueInput.value;
      const nextDueAt = nextDueOverride
        ? new Date(`${nextDueOverride}T12:00:00`).toISOString()
        : getDueDateFromRepeat({
            type: item.repeat_type,
            number: item.repeat_interval || 1,
            unit: item.repeat_unit || "day",
            baseDate: now,
          });

      const { error: updateError } = await supabase
        .from("items")
        .update({ last_completed_at: now.toISOString(), next_due_at: nextDueAt })
        .eq("id", item.id)
        .eq("user_id", currentUserId);

      if (updateError) throw updateError;

      setMessage(`“${item.name}” 완료를 기록했어요.`);
      await refreshItemsUI();
    } catch (error) {
      console.error(error);
      setMessage(`완료 기록 실패: ${error.message}`);
    } finally {
      completeButton.disabled = false;
      completeButton.textContent = "완료했어요";
    }
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary edit-button hidden";
  editButton.textContent = "편집";
  editButton.addEventListener("click", () => openFormForEdit(item));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "secondary danger-text delete-button hidden";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", async () => {
    const confirmed = window.confirm(`“${item.name}” 항목을 삭제할까요? 완료 기록도 함께 삭제돼요.`);
    if (!confirmed) return;

    deleteButton.disabled = true;
    try {
      const { error } = await supabase.from("items").delete().eq("id", item.id).eq("user_id", currentUserId);
      if (error) throw error;

      setMessage(`“${item.name}” 항목을 삭제했어요.`);
      await refreshItemsUI();
    } catch (error) {
      console.error(error);
      setMessage(`삭제 실패: ${error.message}`);
    } finally {
      deleteButton.disabled = false;
    }
  });

  const historyButton = document.createElement("button");
  historyButton.type = "button";
  historyButton.className = "secondary history-button hidden";
  historyButton.textContent = "기록";
  historyButton.addEventListener("click", () => {
    openHistoryModal(item, currentUserId, refreshItemsUI);
  });

  bottom.append(meta, completeButton);
  card.append(top, bottom, historyButton, editButton, deleteButton);
  return card;
}

function renderGroupedItems(container, items, emptyText) {
  container.replaceChildren();

  if (items.length === 0) {
    container.append(createEmptyState(emptyText));
    return;
  }

  currentCategories.forEach((category) => {
    const categoryItems = items.filter((item) => item.category_id === category.id);
    if (categoryItems.length === 0) return;

    const categoryGroup = document.createElement("section");
    categoryGroup.className = "card item-category-group";

    const categoryHeading = document.createElement("div");
    categoryHeading.className = "item-category-heading";
    categoryHeading.append(
      Object.assign(document.createElement("h3"), { textContent: category.name }),
      Object.assign(document.createElement("span"), {
        className: "muted",
        textContent: `${categoryItems.length}개`,
      })
    );
    categoryGroup.append(categoryHeading);

    const sections = currentSections.filter((section) => section.category_id === category.id);
    const unsectioned = categoryItems.filter((item) => !item.section_id);

    sections.forEach((section) => {
      const sectionItems = categoryItems.filter((item) => item.section_id === section.id);
      if (sectionItems.length === 0) return;

      const sectionWrap = document.createElement("div");
      sectionWrap.className = "item-section-group";

      const sectionHeading = document.createElement("div");
      sectionHeading.className = "item-section-heading";
      sectionHeading.append(
        Object.assign(document.createElement("h4"), { textContent: section.name }),
        Object.assign(document.createElement("span"), {
          className: "muted",
          textContent: `${sectionItems.length}개`,
        })
      );

      const sectionList = document.createElement("div");
      sectionList.className = "item-card-list";
      sectionItems.forEach((item) => sectionList.append(createItemCard(item)));

      sectionWrap.append(sectionHeading, sectionList);
      categoryGroup.append(sectionWrap);
    });

    if (unsectioned.length > 0) {
      const sectionWrap = document.createElement("div");
      sectionWrap.className = "item-section-group";

      const sectionHeading = document.createElement("div");
      sectionHeading.className = "item-section-heading";
      sectionHeading.append(Object.assign(document.createElement("h4"), { textContent: "섹션 없음" }));

      const sectionList = document.createElement("div");
      sectionList.className = "item-card-list";
      unsectioned.forEach((item) => sectionList.append(createItemCard(item)));

      sectionWrap.append(sectionHeading, sectionList);
      categoryGroup.append(sectionWrap);
    }

    container.append(categoryGroup);
  });
}

async function openFormForEdit(item) {
  editingItemId = item.id;
  itemForm.classList.remove("hidden");
  fillCategoryOptions();
  itemNameInput.value = item.name;
  itemCategorySelect.value = item.category_id;
  fillSectionOptions(item.section_id || "");
  repeatTypeSelect.value = item.repeat_type || "daily";
  repeatNumberInput.value = item.repeat_interval || 2;
  repeatUnitSelect.value = item.repeat_unit || "day";
  nextDueInput.value = item.next_due_at ? item.next_due_at.slice(0, 10) : "";
  applyRepeatVisibility();
  saveButton.textContent = "수정 저장";
  itemMessage.textContent = `“${item.name}” 항목을 수정하는 중이에요.`;
  itemNameInput.focus();
}

async function saveItem(event) {
  event.preventDefault();

  if (!currentUserId) return;
  if (currentCategories.length === 0) {
    setMessage("먼저 카테고리를 하나 만들어 주세요.");
    return;
  }

  const name = itemNameInput.value.trim();
  const categoryId = itemCategorySelect.value;
  const sectionId = itemSectionSelect.value || null;
  const repeatType = repeatTypeSelect.value;
  const repeatInterval = Number(repeatNumberInput.value) || 1;
  const repeatUnit = repeatUnitSelect.value || "day";
  const nextDueOverride = nextDueInput.value || null;

  if (!name) {
    setMessage("내용을 입력해 주세요.");
    itemNameInput.focus();
    return;
  }

  setSaving(true);
  try {
    const payload = {
      user_id: currentUserId,
      category_id: categoryId,
      section_id: sectionId,
      name,
      repeat_type: repeatType,
      repeat_interval: ["n_days", "custom"].includes(repeatType) ? repeatInterval : null,
      repeat_unit: repeatType === "custom" ? repeatUnit : repeatType === "n_days" ? "day" : null,
      next_due_at: nextDueOverride ? new Date(`${nextDueOverride}T12:00:00`).toISOString() : null,
    };

    let error;

    if (editingItemId) {
      ({ error } = await supabase.from("items").update(payload).eq("id", editingItemId).eq("user_id", currentUserId));
    } else {
      ({ error } = await supabase.from("items").insert(payload));
    }

    if (error) throw error;

    setMessage(editingItemId ? "항목을 수정했어요." : "새 항목을 추가했어요.");
    closeForm();
    await refreshItemsUI();
  } catch (error) {
    console.error(error);
    setMessage(`저장 실패: ${error.message}`);
  } finally {
    setSaving(false);
  }
}

function bindEvents() {
  addToggleButton.onclick = () => {
    if (itemForm.classList.contains("hidden")) openFormForCreate();
    else closeForm();
  };

  cancelButton.onclick = closeForm;
  itemCategorySelect.onchange = () => fillSectionOptions();
  repeatTypeSelect.onchange = applyRepeatVisibility;
  itemForm.onsubmit = saveItem;
}

function setCategorySummary() {
  categoryStatus.textContent = currentCategories.length > 0 ? `${currentCategories.length}개 카테고리` : "카테고리 없음";
}

function renderCategoryFilters() {
  categoryFilterList.replaceChildren();

  if (currentCategories.length === 0) {
    categoryFilterList.append(createEmptyState("카테고리가 없어요."));
    return;
  }

  currentCategories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `secondary category-filter-chip${selectedCategoryId === category.id ? " is-active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => {
      selectedCategoryId = category.id;
      renderCategoryFilters();
      renderSelectedCategoryItems();
    });
    categoryFilterList.append(button);
  });
}

function renderSelectedCategoryItems() {
  if (!selectedCategoryId && currentCategories.length > 0) {
    selectedCategoryId = currentCategories[0].id;
  }

  const category = currentCategories.find((row) => row.id === selectedCategoryId);
  const items = currentItems.filter((item) => item.category_id === selectedCategoryId);

  categoryItemStatus.textContent = category
    ? `${category.name} · ${items.length}개 항목`
    : "카테고리를 선택해 주세요.";

  renderGroupedItems(categoryItemList, items, "이 카테고리에는 아직 항목이 없어요.");
}

export async function refreshItemsUI() {
  if (!currentUserId) return;

  itemStatus.textContent = "불러오는 중...";
  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      name,
      category_id,
      section_id,
      repeat_type,
      repeat_interval,
      repeat_unit,
      last_completed_at,
      next_due_at,
      created_at
    `)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    itemStatus.textContent = "항목을 불러오지 못했어요.";
    return;
  }

  currentItems = data || [];
  itemStatus.textContent = `${currentItems.length}개`;
  setCategorySummary();
  renderGroupedItems(itemList, currentItems, "아직 등록한 항목이 없어요. 첫 항목을 추가해 보세요.");
  renderCategoryFilters();
  renderSelectedCategoryItems();
}

export async function initializeItemsUI(userId, categories, sections) {
  currentUserId = userId;
  currentCategories = categories;
  currentSections = sections;

  fillCategoryOptions();
  fillSectionOptions();
  applyRepeatVisibility();
  setCategorySummary();

  if (!selectedCategoryId && currentCategories.length > 0) {
    selectedCategoryId = currentCategories[0].id;
  }

  await refreshItemsUI();
}

export function resetItemsUI() {
  currentUserId = null;
  currentCategories = [];
  currentSections = [];
  currentItems = [];
  editingItemId = null;
  selectedCategoryId = null;
  itemList.replaceChildren();
  categoryFilterList.replaceChildren();
  categoryItemList.replaceChildren();
  itemStatus.textContent = "";
  categoryStatus.textContent = "";
  categoryItemStatus.textContent = "";
  closeForm();
}

bindEvents();