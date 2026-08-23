import { supabase } from "./supabase.js";

const toggleButton = document.querySelector("#taxonomy-toggle");
const modal = document.querySelector("#taxonomy-modal");
const closeButton = document.querySelector("#taxonomy-close");
const categoryList = document.querySelector("#taxonomy-category-list");
const addCategoryButton = document.querySelector("#taxonomy-add-category");
const sectionCategorySelect = document.querySelector("#taxonomy-section-category");
const sectionList = document.querySelector("#taxonomy-section-list");
const addSectionButton = document.querySelector("#taxonomy-add-section");
const message = document.querySelector("#taxonomy-message");

let currentUserId = null;
let currentCategories = [];
let currentSections = [];
let onChanged = null;

function showMessage(text) {
  message.textContent = text;
}

function smallButton(text, className = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} taxonomy-action-button`;
  button.textContent = text;
  return button;
}

async function refreshAfterChange(text) {
  showMessage(text);
  if (onChanged) await onChanged();
}

function renderSectionCategoryOptions() {
  const previous = sectionCategorySelect.value;
  sectionCategorySelect.replaceChildren();

  for (const category of currentCategories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    sectionCategorySelect.append(option);
  }

  if (currentCategories.some((category) => category.id === previous)) {
    sectionCategorySelect.value = previous;
  }

  sectionCategorySelect.disabled = currentCategories.length === 0;
  addSectionButton.disabled = currentCategories.length === 0;
}

function renderCategoryRows() {
  categoryList.replaceChildren();

  if (currentCategories.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted taxonomy-empty";
    empty.textContent = "카테고리가 없어요. 새 카테고리를 추가해 주세요.";
    categoryList.append(empty);
    return;
  }

  for (const category of currentCategories) {
    const row = document.createElement("div");
    row.className = "taxonomy-row";

    const name = document.createElement("span");
    name.className = "taxonomy-name";
    name.textContent = category.name;

    const actions = document.createElement("div");
    actions.className = "taxonomy-row-actions";

    const editButton = smallButton("편집");
    editButton.addEventListener("click", () => editCategory(category));

    const deleteButton = smallButton("삭제", "secondary danger-text");
    deleteButton.addEventListener("click", () => deleteCategory(category, deleteButton));

    actions.append(editButton, deleteButton);
    row.append(name, actions);
    categoryList.append(row);
  }
}

function renderSectionRows() {
  sectionList.replaceChildren();
  const categoryId = sectionCategorySelect.value;
  const sections = currentSections.filter((section) => section.category_id === categoryId);

  if (!categoryId) {
    const empty = document.createElement("p");
    empty.className = "muted taxonomy-empty";
    empty.textContent = "먼저 카테고리를 추가해 주세요.";
    sectionList.append(empty);
    return;
  }

  if (sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted taxonomy-empty";
    empty.textContent = "이 카테고리에는 아직 섹션이 없어요.";
    sectionList.append(empty);
    return;
  }

  for (const section of sections) {
    const row = document.createElement("div");
    row.className = "taxonomy-row";

    const name = document.createElement("span");
    name.className = "taxonomy-name";
    name.textContent = section.name;

    const actions = document.createElement("div");
    actions.className = "taxonomy-row-actions";

    const editButton = smallButton("편집");
    editButton.addEventListener("click", () => editSection(section));

    const deleteButton = smallButton("삭제", "secondary danger-text");
    deleteButton.addEventListener("click", () => deleteSection(section, deleteButton));

    actions.append(editButton, deleteButton);
    row.append(name, actions);
    sectionList.append(row);
  }
}

function renderManager() {
  renderCategoryRows();
  renderSectionCategoryOptions();
  renderSectionRows();
}

async function addCategory() {
  if (!currentUserId) return;

  const rawName = window.prompt("새 카테고리 이름을 입력해 주세요. 이모지도 같이 입력할 수 있어요.\n예: 🧹 청소");
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) return;

  const { error } = await supabase.from("categories").insert({
    user_id: currentUserId,
    name,
    icon: null,
  });

  if (error) {
    window.alert(`카테고리 추가 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("카테고리를 추가했어요.");
}

async function editCategory(category) {
  const rawName = window.prompt(
    "카테고리 이름을 수정해 주세요. 이모지도 이름 안에서 바꿀 수 있어요.",
    category.name
  );
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) return;

  const { error } = await supabase
    .from("categories")
    .update({ name, icon: null })
    .eq("id", category.id)
    .eq("user_id", currentUserId);

  if (error) {
    window.alert(`카테고리 수정 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("카테고리를 수정했어요.");
}

async function deleteCategory(category, button) {
  const { count, error: countError } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", category.id);

  if (countError) {
    window.alert(`연결 항목 확인 실패: ${countError.message}`);
    return;
  }

  if ((count ?? 0) > 0) {
    window.alert(`이 카테고리에는 관리 항목이 ${count}개 있어요.\n먼저 항목을 다른 카테고리로 옮기거나 삭제해 주세요.`);
    return;
  }

  const confirmed = window.confirm(`“${category.name}” 카테고리를 삭제할까요?\n안에 있는 섹션도 함께 삭제됩니다.`);
  if (!confirmed) return;

  button.disabled = true;
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", category.id)
    .eq("user_id", currentUserId);

  if (error) {
    button.disabled = false;
    window.alert(`카테고리 삭제 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("카테고리를 삭제했어요.");
}

async function addSection() {
  if (!currentUserId) return;
  const categoryId = sectionCategorySelect.value;
  if (!categoryId) return;

  const rawName = window.prompt("새 섹션 이름을 입력해 주세요.");
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) return;

  const categorySections = currentSections.filter((section) => section.category_id === categoryId);
  const maxOrder = categorySections.reduce((max, section) => Math.max(max, section.sort_order ?? 0), 0);

  const { error } = await supabase.from("sections").insert({
    user_id: currentUserId,
    category_id: categoryId,
    name,
    sort_order: maxOrder + 10,
  });

  if (error) {
    window.alert(`섹션 추가 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("섹션을 추가했어요.");
}

async function editSection(section) {
  const rawName = window.prompt("섹션 이름", section.name);
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) return;

  const { error } = await supabase
    .from("sections")
    .update({ name })
    .eq("id", section.id)
    .eq("user_id", currentUserId);

  if (error) {
    window.alert(`섹션 수정 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("섹션을 수정했어요.");
}

async function deleteSection(section, button) {
  const { count, error: countError } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("section_id", section.id);

  if (countError) {
    window.alert(`연결 항목 확인 실패: ${countError.message}`);
    return;
  }

  if ((count ?? 0) > 0) {
    window.alert(`이 섹션에는 관리 항목이 ${count}개 있어요.\n먼저 항목의 섹션을 바꾸거나 삭제해 주세요.`);
    return;
  }

  const confirmed = window.confirm(`“${section.name}” 섹션을 삭제할까요?`);
  if (!confirmed) return;

  button.disabled = true;
  const { error } = await supabase
    .from("sections")
    .delete()
    .eq("id", section.id)
    .eq("user_id", currentUserId);

  if (error) {
    button.disabled = false;
    window.alert(`섹션 삭제 실패: ${error.message}`);
    return;
  }

  await refreshAfterChange("섹션을 삭제했어요.");
}

export function initializeTaxonomyUI(userId, categories, sections, changedCallback) {
  currentUserId = userId;
  currentCategories = categories;
  currentSections = sections;
  onChanged = changedCallback;

  toggleButton.onclick = () => {
    if (!modal.open) modal.showModal();
  };

  closeButton.onclick = () => modal.close();

  modal.onclick = (event) => {
    if (event.target === modal) modal.close();
  };

  addCategoryButton.onclick = addCategory;
  addSectionButton.onclick = addSection;
  sectionCategorySelect.onchange = renderSectionRows;

  renderManager();
}

export function resetTaxonomyUI() {
  currentUserId = null;
  currentCategories = [];
  currentSections = [];
  onChanged = null;
  if (modal.open) modal.close();
  categoryList.replaceChildren();
  sectionList.replaceChildren();
  sectionCategorySelect.replaceChildren();
  showMessage("");
}
