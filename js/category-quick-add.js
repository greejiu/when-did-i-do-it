import "./duplicate-guard.js?v=1";

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
let bypassMainAddIntercept = false;
let interceptingEdit = false;
let pendingEditName = "";

function getItemForm() {
  const form = document.querySelector("#item-form");
  return form instanceof HTMLFormElement ? form : null;
}

function getMainAddButton() {
  const button = document.querySelector("#item-add-toggle");
  return button instanceof HTMLButtonElement ? button : null;
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
          <p id="quick-add-subtitle">카테고리와 섹션을 선택해 새 항목을 추가해요.</p>
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

    if (isBackdropClick) closeQuickAddModal();
  });

  quickAddModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeQuickAddModal();
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

  if (modal.open) modal.close();
}

function watchFormState(form) {
  if (form.dataset.quickAddWatching === "true") return;
  form.dataset.quickAddWatching = "true";

  const observer = new MutationObserver(() => {
    if (!quickAddModal?.open) return;
    if (form.classList.contains("hidden")) quickAddModal.close();
  });

  observer.observe(form, { attributes: true, attributeFilter: ["class"] });
}

function moveFormIntoModal(form) {
  ensurePlaceholder(form);
  watchFormState(form);
  quickAddSlot?.append(form);
}

function presentFormInModal({ categoryName = "" } = {}) {
  const modal = ensureQuickAddModal();
  const form = getItemForm();
  const nameInput = document.querySelector("#item-name");
  const categorySelect = document.querySelector("#item-category");
  const message = document.querySelector("#item-message");

  if (!form || !(categorySelect instanceof HTMLSelectElement)) return;

  moveFormIntoModal(form);

  if (categoryName) {
    if (quickAddTitle) quickAddTitle.textContent = `${categoryName} 항목 추가`;
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
  } else {
    if (quickAddTitle) quickAddTitle.textContent = "항목 추가";
    if (quickAddSubtitle) {
      quickAddSubtitle.textContent = "카테고리와 섹션을 선택해 새 항목을 추가해요.";
    }
    if (message instanceof HTMLElement) message.textContent = "";
  }

  if (!modal.open) modal.showModal();

  window.setTimeout(() => {
    if (nameInput instanceof HTMLInputElement) nameInput.focus();
  }, 40);
}

function presentEditFormInModal(itemName = "") {
  const modal = ensureQuickAddModal();
  const form = getItemForm();
  const nameInput = document.querySelector("#item-name");

  if (!form || form.classList.contains("hidden")) return;

  moveFormIntoModal(form);

  if (quickAddTitle) quickAddTitle.textContent = itemName ? `${itemName} 수정` : "항목 수정";
  if (quickAddSubtitle) quickAddSubtitle.textContent = "내용을 수정한 뒤 수정 저장을 눌러주세요.";

  if (!modal.open) modal.showModal();

  window.setTimeout(() => {
    if (nameInput instanceof HTMLInputElement) nameInput.focus();
  }, 40);
}

function runOriginalAddButton() {
  const button = getMainAddButton();
  if (!button) return false;

  bypassMainAddIntercept = true;
  button.click();
  bypassMainAddIntercept = false;
  return true;
}

function openGeneralAddModal() {
  const form = getItemForm();
  const cancelButton = document.querySelector("#item-cancel-button");

  if (!form) return;

  if (!form.classList.contains("hidden") && cancelButton instanceof HTMLButtonElement) {
    cancelButton.click();
  }

  if (form.classList.contains("hidden") && !runOriginalAddButton()) return;
  presentFormInModal();
}

function openQuickAddForCategory(categoryName) {
  const form = getItemForm();
  const cancelButton = document.querySelector("#item-cancel-button");

  if (!form) return;

  if (!form.classList.contains("hidden") && cancelButton instanceof HTMLButtonElement) {
    cancelButton.click();
  }

  if (form.classList.contains("hidden") && !runOriginalAddButton()) return;
  presentFormInModal({ categoryName });
}

function attachMainAddPopupBehavior() {
  const button = getMainAddButton();
  if (!button || button.dataset.popupBound === "true") return;
  button.dataset.popupBound = "true";

  button.addEventListener(
    "click",
    (event) => {
      if (bypassMainAddIntercept) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openGeneralAddModal();
    },
    true
  );
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

/* 기존 편집 로직이 홈 탭으로 이동하려는 동작만 막고, 입력값 채우기는 그대로 사용한다. */
document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target.closest(".edit-button") : null;
    if (!(target instanceof HTMLButtonElement)) return;

    interceptingEdit = true;
    pendingEditName = target.closest(".item-card")?.querySelector(".item-title")?.textContent?.trim() || "";

    window.setTimeout(() => {
      interceptingEdit = false;
    }, 100);
  },
  true
);

window.addEventListener(
  "app:navigate",
  (event) => {
    if (!interceptingEdit || event.detail?.view !== "home") return;
    event.stopImmediatePropagation();
  },
  true
);

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest(".edit-button") : null;
  if (!(target instanceof HTMLButtonElement)) return;

  const itemName = pendingEditName;
  window.setTimeout(() => {
    presentEditFormInModal(itemName);
    interceptingEdit = false;
    pendingEditName = "";
  }, 0);
});

const observer = new MutationObserver((mutations) => {
  attachMainAddPopupBehavior();

  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-category-heading")) attachQuickAddButton(node);
      enhanceCategoryHeadings(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
attachMainAddPopupBehavior();
enhanceCategoryHeadings();
