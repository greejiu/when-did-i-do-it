function cleanCategoryName(value) {
  const text = (value || "").trim();
  if (!text) return "";

  try {
    return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "").trim() || text;
  } catch {
    return text;
  }
}

function getHeadingCategoryName(heading) {
  const title = heading.querySelector("h3");
  return cleanCategoryName(title?.textContent || "");
}

function findCategoryOption(categoryName) {
  const categorySelect = document.querySelector("#item-category");
  if (!(categorySelect instanceof HTMLSelectElement)) return null;

  return (
    [...categorySelect.options].find(
      (option) => cleanCategoryName(option.textContent || "") === categoryName
    ) || null
  );
}

let quickAddModal = null;
let quickAddTitle = null;
let quickAddSubtitle = null;
let quickAddSlot = null;
let itemFormPlaceholder = null;

function getItemForm() {
  const form = document.querySelector("#item-form");
  return form instanceof HTMLFormElement ? form : null;
}

function ensureQuickAddModal() {
  if (quickAddModal) return quickAddModal;

  quickAddModal = document.createElement("dialog");
  quickAddModal.className = "quick-add-modal";
  quickAddModal.innerHTML = `
    <div class="quick-add-modal-shell">
      <div class="quick-add-modal-header">
        <div>
          <h2 id="quick-add-title">항목 추가</h2>
          <p id="quick-add-subtitle">카테고리를 미리 고른 상태로 빠르게 추가할 수 있어요.</p>
        </div>
        <button type="button" class="secondary quick-add-close" aria-label="닫기">×</button>
      </div>
      <div class="quick-add-form-slot"></div>
    </div>
  `;

  document.body.append(quickAddModal);

  quickAddTitle = quickAddModal.querySelector("#quick-add-title");
  quickAddSubtitle = quickAddModal.querySelector("#quick-add-subtitle");
  quickAddSlot = quickAddModal.querySelector(".quick-add-form-slot");

  const closeButton = quickAddModal.querySelector(".quick-add-close");
  closeButton?.addEventListener("click", closeQuickAddModal);

  quickAddModal.addEventListener("click", (event) => {
    const rect = quickAddModal.getBoundingClientRect();
    const isBackdropClick =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isBackdropClick) {
      closeQuickAddModal();
    }
  });

  quickAddModal.addEventListener("close", restoreItemForm);
  return quickAddModal;
}

function ensurePlaceholder(form) {
  if (itemFormPlaceholder) return itemFormPlaceholder;

  itemFormPlaceholder = document.createElement("div");
  itemFormPlaceholder.hidden = true;
  itemFormPlaceholder.dataset.quickAddPlaceholder = "true";
  form.before(itemFormPlaceholder);
  return itemFormPlaceholder;
}

function restoreItemForm() {
  const form = getItemForm();
  if (!form || !itemFormPlaceholder) return;

  itemFormPlaceholder.before(form);
  itemFormPlaceholder.remove();
  itemFormPlaceholder = null;
}

function closeQuickAddModal() {
  const modal = ensureQuickAddModal();
  const cancelButton = document.querySelector("#item-cancel-button");

  if (cancelButton instanceof HTMLButtonElement) {
    cancelButton.click();
  }

  if (modal.open) {
    modal.close();
  }
}

function watchFormState(form) {
  if (form.dataset.quickAddWatching === "true") return;
  form.dataset.quickAddWatching = "true";

  const observer = new MutationObserver(() => {
    if (!quickAddModal?.open) return;
    if (form.classList.contains("hidden")) {
      quickAddModal.close();
    }
  });

  observer.observe(form, { attributes: true, attributeFilter: ["class"] });
}

function openQuickAddForCategory(categoryName) {
  const modal = ensureQuickAddModal();
  const form = getItemForm();
  const toggleButton = document.querySelector("#item-add-toggle");
  const cancelButton = document.querySelector("#item-cancel-button");
  const categorySelect = document.querySelector("#item-category");
  const nameInput = document.querySelector("#item-name");
  const message = document.querySelector("#item-message");

  if (!form || !(categorySelect instanceof HTMLSelectElement)) return;

  if (!form.classList.contains("hidden") && cancelButton instanceof HTMLButtonElement) {
    cancelButton.click();
  }

  if (form.classList.contains("hidden") && toggleButton instanceof HTMLButtonElement) {
    toggleButton.click();
  }

  ensurePlaceholder(form);
  watchFormState(form);
  quickAddSlot?.append(form);

  if (quickAddTitle) {
    quickAddTitle.textContent = `${categoryName} 항목 추가`;
  }

  if (quickAddSubtitle) {
    quickAddSubtitle.textContent = `${categoryName} 카테고리에 새 항목을 빠르게 추가해요.`;
  }

  const option = findCategoryOption(categoryName);
  if (option) {
    categorySelect.value = option.value;
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (message instanceof HTMLElement) {
    message.textContent = `${categoryName}에 새 항목을 추가해요.`;
  }

  if (!modal.open) {
    modal.showModal();
  }

  window.setTimeout(() => {
    if (nameInput instanceof HTMLInputElement) {
      nameInput.focus();
    }
  }, 40);
}

function attachQuickAddButton(heading) {
  if (!(heading instanceof HTMLElement)) return;
  if (heading.querySelector(".category-quick-add")) return;

  const categoryName = getHeadingCategoryName(heading);
  if (!categoryName) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary category-quick-add";
  button.textContent = "+";
  button.setAttribute("aria-label", `${categoryName}에 항목 추가`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openQuickAddForCategory(categoryName);
  });

  heading.append(button);
}

function enhanceCategoryHeadings(root = document) {
  for (const heading of root.querySelectorAll?.(".item-category-heading") || []) {
    attachQuickAddButton(heading);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-category-heading")) attachQuickAddButton(node);
      enhanceCategoryHeadings(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
enhanceCategoryHeadings();
