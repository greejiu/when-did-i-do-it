import { supabase } from "./supabase.js";

const toggleButton = document.querySelector("#taxonomy-toggle");
const modal = document.querySelector("#taxonomy-modal");
const closeButton = document.querySelector("#taxonomy-close");
const backButton = document.querySelector("#taxonomy-back");
const modalTitle = document.querySelector("#taxonomy-modal-title");
const modalSubtitle = document.querySelector("#taxonomy-modal-subtitle");
const categoryView = document.querySelector("#taxonomy-category-view");
const sectionView = document.querySelector("#taxonomy-section-view");
const categoryList = document.querySelector("#taxonomy-category-list");
const addCategoryButton = document.querySelector("#taxonomy-add-category");
const sectionTitle = document.querySelector("#taxonomy-section-title");
const sectionList = document.querySelector("#taxonomy-section-list");
const addSectionButton = document.querySelector("#taxonomy-add-section");
const message = document.querySelector("#taxonomy-message");

let currentUserId = null;
let currentCategories = [];
let currentSections = [];
let onChanged = null;
let currentView = "category";
let selectedCategoryId = null;

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

function getSelectedCategory() {
  return currentCategories.find((category) => category.id === selectedCategoryId) ?? null;
}

function showCategoryView() {
  currentView = "category";
  selectedCategoryId = null;
  categoryView.classList.remove("hidden");
  sectionView.classList.add("hidden");
  backButton.classList.add("hidden");
  modalTitle.textContent = "카테고리 관리";
  modalSubtitle.textContent = "이모지는 카테고리 이름에 직접 입력할 수 있어요.";
}

function showSectionView(category) {
  currentView = "section";
  selectedCategoryId = category.id;
  categoryView.classList.add("hidden");
  sectionView.classList.remove("hidden");
  backButton.classList.remove("hidden");
  modalTitle.textContent = "섹션 관리";
  modalSubtitle.textContent = category.name;
  sectionTitle.textContent = `${category.name}의 섹션`;
  renderSectionRows();
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

    const sectionButton = smallButton("섹션 관리");
    sectionButton.addEventListener("click", () => {
      showMessage("");
      showSectionView(category);
    });

    const editButton = smallButton("편집");
    editButton.addEventListener("click", () => editCategory(category));

    const deleteButton = smallButton("삭제", "secondary danger-text");
    deleteButton.addEventListener("click", () => deleteCategory(category, deleteButton));

    actions.append(sectionButton, editButton, deleteButton);
    row.append(name, actions);
    categoryList.append(row);
  }
}

function renderSectionRows() {
  sectionList.replaceChildren();
  const category = getSelectedCategory();

  if (!category) {
    showCategoryView();
    return;
  }

  modalSubtitle.textContent = category.name;
  sectionTitle.textContent = `${category.name}의 섹션`;

  const sections = currentSections.filter((section) => section.category_id === category.id);

  if (sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted taxonomy-empty";
    empty.textContent = "아직 섹션이 없어요. 새 섹션을 추가해 주세요.";
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

  if (currentView === "section") {
    const category = getSelectedCategory();
    if (category) {
      showSectionView(category);
      return;
    }
  }

  showCategoryView();
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
  const category = getSelectedCategory();
  if (!category) return;

  const rawName = window.prompt(`${category.name}에 추가할 새 섹션 이름을 입력해 주세요.`);
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) return;

  const categorySections = currentSections.filter((section) => section.category_id === category.id);
  const maxOrder = categorySections.reduce((max, section) => Math.max(max, section.sort_order ?? 0), 0);

  const { error } = await supabase.from("sections").insert({
    user_id: currentUserId,
    category_id: category.id,
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
    showMessage("");
    showCategoryView();
    renderCategoryRows();
    if (!modal.open) modal.showModal();
  };

  closeButton.onclick = () => modal.close();
  backButton.onclick = () => {
    showMessage("");
    showCategoryView();
  };

  modal.onclick = (event) => {
    if (event.target === modal) modal.close();
  };

  modal.onclose = () => {
    showMessage("");
    showCategoryView();
  };

  addCategoryButton.onclick = addCategory;
  addSectionButton.onclick = addSection;

  renderManager();
}

export function resetTaxonomyUI() {
  currentUserId = null;
  currentCategories = [];
  currentSections = [];
  onChanged = null;
  currentView = "category";
  selectedCategoryId = null;
  if (modal.open) modal.close();
  categoryList.replaceChildren();
  sectionList.replaceChildren();
  showMessage("");
  showCategoryView();
}
