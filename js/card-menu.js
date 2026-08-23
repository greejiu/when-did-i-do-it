function closeAllMenus(except = null) {
  for (const menu of document.querySelectorAll(".item-overflow-menu")) {
    if (menu === except) continue;
    menu.classList.add("hidden");
    const button = menu.parentElement?.querySelector(".item-overflow-button");
    if (button) button.setAttribute("aria-expanded", "false");
  }
}

function cleanCategoryName(value) {
  const text = (value || "").trim();
  if (!text) return "";

  try {
    return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "").trim() || text;
  } catch {
    return text;
  }
}

function getCategoryName(card) {
  const group = card.closest(".item-category-group");
  const heading = group?.querySelector(".item-category-heading h3");
  return cleanCategoryName(heading?.textContent || "");
}

function enhanceCard(card) {
  if (!(card instanceof HTMLElement)) return;
  if (card.dataset.compactEnhanced === "true") return;

  const top = card.querySelector(".item-card-top");
  const meta = card.querySelector(".item-meta");
  const actions = card.querySelector(".item-card-actions");
  const historyButton = actions?.querySelector(".history-button");
  const editButton = actions?.querySelector(".edit-button");
  const deleteButton = actions?.querySelector(".delete-button");
  const completeButton = actions?.querySelector(".complete-button");

  if (!top || !meta || !actions || !completeButton) return;

  card.dataset.compactEnhanced = "true";
  card.classList.add("item-card-compact");

  const topActions = document.createElement("div");
  topActions.className = "item-top-actions";

  const categoryName = getCategoryName(card);
  if (categoryName) {
    const badge = document.createElement("span");
    badge.className = "item-category-badge";
    badge.textContent = `(${categoryName})`;
    topActions.append(badge);
  }

  const menuWrap = document.createElement("div");
  menuWrap.className = "item-overflow-wrap";

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "item-overflow-button";
  menuButton.textContent = "⋯";
  menuButton.setAttribute("aria-label", `${card.querySelector(".item-title")?.textContent || "항목"} 메뉴`);
  menuButton.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "item-overflow-menu hidden";

  for (const button of [historyButton, editButton, deleteButton]) {
    if (!button) continue;
    button.classList.add("item-overflow-action");
    menu.append(button);
  }

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.classList.contains("hidden");
    closeAllMenus(willOpen ? menu : null);
    menu.classList.toggle("hidden", !willOpen);
    menuButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLButtonElement) {
      menu.classList.add("hidden");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  menuWrap.append(menuButton, menu);
  topActions.append(menuWrap);
  top.append(topActions);

  const bottom = document.createElement("div");
  bottom.className = "item-card-bottom";
  bottom.append(meta, completeButton);
  card.append(bottom);

  actions.remove();
}

function enhanceAllCards(root = document) {
  for (const card of root.querySelectorAll?.(".item-card") || []) {
    enhanceCard(card);
  }
}

document.addEventListener("click", () => closeAllMenus());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllMenus();
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-card")) enhanceCard(node);
      enhanceAllCards(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
enhanceAllCards();
