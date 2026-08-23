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

  return [...categorySelect.options].find(
    (option) => cleanCategoryName(option.textContent || "") === categoryName
  ) || null;
}

function openQuickAddForCategory(categoryName) {
  const homeButton = document.querySelector('[data-nav-view="home"]');
  if (homeButton instanceof HTMLButtonElement) {
    homeButton.click();
  }

  window.setTimeout(() => {
    const form = document.querySelector("#item-form");
    const toggleButton = document.querySelector("#item-add-toggle");
    const categorySelect = document.querySelector("#item-category");
    const nameInput = document.querySelector("#item-name");

    if (!(form instanceof HTMLElement)) return;
    if (!(categorySelect instanceof HTMLSelectElement)) return;

    if (form.classList.contains("hidden") && toggleButton instanceof HTMLButtonElement) {
      toggleButton.click();
    }

    const option = findCategoryOption(categoryName);
    if (option) {
      categorySelect.value = option.value;
      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const message = document.querySelector("#item-message");
    if (message instanceof HTMLElement) {
      message.textContent = `${categoryName}에 새 항목을 추가해요.`;
    }

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    if (nameInput instanceof HTMLInputElement) {
      nameInput.focus();
    }
  }, 80);
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
