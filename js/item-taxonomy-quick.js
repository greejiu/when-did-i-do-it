import { supabase } from "./supabase.js";
import { getCategories } from "./categories.js?v=10";
import { getSections } from "./sections.js?v=10";
import { initializeItemsUI } from "./items.js?v=16";
import { initializeTaxonomyUI } from "./taxonomy.js?v=13";

const categorySelect = document.querySelector("#item-category");
const sectionSelect = document.querySelector("#item-section");

function ensureStyles() {
  if (document.querySelector("#item-taxonomy-quick-styles")) return;

  const style = document.createElement("style");
  style.id = "item-taxonomy-quick-styles";
  style.textContent = `
    .quick-taxonomy-field-wrap {
      position: relative;
      min-width: 0;
    }

    .quick-taxonomy-field-wrap > label {
      display: grid;
      height: 100%;
    }

    .quick-taxonomy-add {
      position: absolute;
      top: -2px;
      right: 0;
      z-index: 2;
      min-height: 28px;
      padding: 3px 8px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #59695a;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .quick-taxonomy-add:hover {
      background: #e9eee7;
      color: #3f5141;
    }

    .quick-taxonomy-overlay {
      position: fixed;
      inset: 0;
      z-index: 1200;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(62, 66, 58, 0.34);
      backdrop-filter: blur(1px);
    }

    .quick-taxonomy-dialog {
      width: min(360px, 100%);
      padding: 18px;
      border: 1px solid #d7d5cb;
      border-radius: 18px;
      background: #fbfaf6;
      color: #30342f;
      box-shadow: 0 20px 60px rgba(58, 63, 55, 0.22);
    }

    .quick-taxonomy-dialog h3 {
      margin: 0 0 7px;
      font-size: 18px;
    }

    .quick-taxonomy-dialog p {
      margin: 0;
      color: #676d65;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line;
    }

    .quick-taxonomy-dialog input {
      width: 100%;
      box-sizing: border-box;
      margin-top: 14px;
      padding: 10px 11px;
      border: 1px solid #d7d5cb;
      border-radius: 10px;
      background: #fffefa;
      color: #30342f;
      font: inherit;
    }

    .quick-taxonomy-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }

    .quick-taxonomy-dialog-actions button {
      min-height: 36px;
      padding: 7px 13px;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .quick-taxonomy-cancel {
      border: 1px solid #d7d5cb;
      background: #fffefa;
      color: #30342f;
    }

    .quick-taxonomy-confirm {
      border: 1px solid #4f5f50;
      background: #4f5f50;
      color: #fffdf8;
    }
  `;
  document.head.append(style);
}

function getOverlayHost() {
  return document.querySelector(".quick-add-modal[open]") || document.body;
}

function showInlinePrompt({ title, message, placeholder = "" }) {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "quick-taxonomy-overlay";
    overlay.innerHTML = `
      <div class="quick-taxonomy-dialog" role="dialog" aria-modal="true">
        <h3></h3>
        <p></p>
        <input type="text" maxlength="100" />
        <div class="quick-taxonomy-dialog-actions">
          <button type="button" class="quick-taxonomy-cancel">취소</button>
          <button type="button" class="quick-taxonomy-confirm">추가</button>
        </div>
      </div>
    `;

    const titleEl = overlay.querySelector("h3");
    const messageEl = overlay.querySelector("p");
    const input = overlay.querySelector("input");
    const cancel = overlay.querySelector(".quick-taxonomy-cancel");
    const confirm = overlay.querySelector(".quick-taxonomy-confirm");

    titleEl.textContent = title;
    messageEl.textContent = message;
    input.placeholder = placeholder;

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancel.addEventListener("click", () => finish(null));
    confirm.addEventListener("click", () => finish(input.value.trim()));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirm.click();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel.click();
      }
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });

    getOverlayHost().append(overlay);
    window.setTimeout(() => input.focus(), 20);
  });
}

function showInlineNotice(title, message) {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "quick-taxonomy-overlay";
    overlay.innerHTML = `
      <div class="quick-taxonomy-dialog" role="dialog" aria-modal="true">
        <h3></h3>
        <p></p>
        <div class="quick-taxonomy-dialog-actions">
          <button type="button" class="quick-taxonomy-confirm">확인</button>
        </div>
      </div>
    `;

    overlay.querySelector("h3").textContent = title;
    overlay.querySelector("p").textContent = message;
    const confirm = overlay.querySelector(".quick-taxonomy-confirm");

    const finish = () => {
      overlay.remove();
      resolve();
    };

    confirm.addEventListener("click", finish);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish();
    });

    getOverlayHost().append(overlay);
    window.setTimeout(() => confirm.focus(), 20);
  });
}

async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function refreshTaxonomyState(userId) {
  const [categories, sections] = await Promise.all([getCategories(), getSections()]);

  await initializeItemsUI(userId, categories, sections);
  initializeTaxonomyUI(userId, categories, sections, async () => {
    await refreshTaxonomyState(userId);
  });

  return { categories, sections };
}

function wrapField(select, type, onClick) {
  if (!(select instanceof HTMLSelectElement)) return;
  const label = select.closest("label");
  if (!(label instanceof HTMLElement)) return;
  if (label.parentElement?.classList.contains("quick-taxonomy-field-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "quick-taxonomy-field-wrap";
  label.before(wrap);
  wrap.append(label);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "quick-taxonomy-add";
  button.textContent = "+ 추가";
  button.setAttribute("aria-label", `${type} 추가`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  wrap.append(button);
}

async function addCategoryInline() {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const value = await showInlinePrompt({
    title: "카테고리 추가",
    message: "이모지도 이름에 같이 입력할 수 있어요.\n예: 🧹 청소",
    placeholder: "예: 🧹 청소",
  });
  if (value === null) return;
  const name = value.trim();
  if (!name) return;

  const { error } = await supabase.from("categories").insert({
    user_id: userId,
    name,
    icon: null,
  });

  if (error) {
    await showInlineNotice("추가 실패", error.message);
    return;
  }

  const { categories } = await refreshTaxonomyState(userId);
  const created = [...categories].reverse().find((row) => row.name === name);
  if (created && categorySelect instanceof HTMLSelectElement) {
    categorySelect.value = created.id;
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

async function addSectionInline() {
  const userId = await getCurrentUserId();
  if (!userId) return;
  if (!(categorySelect instanceof HTMLSelectElement)) return;

  const categoryId = categorySelect.value;
  if (!categoryId) {
    await showInlineNotice("카테고리를 먼저 선택해 주세요", "섹션은 선택한 카테고리 안에 추가돼요.");
    return;
  }

  const categoryLabel = categorySelect.selectedOptions[0]?.textContent?.trim() || "선택한 카테고리";
  const value = await showInlinePrompt({
    title: "섹션 추가",
    message: `${categoryLabel}에 새 섹션을 추가해요.`,
    placeholder: "예: 욕실",
  });
  if (value === null) return;
  const name = value.trim();
  if (!name) return;

  const { sections: currentSections } = await refreshTaxonomyState(userId);
  const sameCategorySections = currentSections.filter((row) => row.category_id === categoryId);
  const duplicate = sameCategorySections.some((row) => row.name === name);
  if (duplicate) {
    await showInlineNotice("이미 있는 섹션이에요", `${categoryLabel} 안에 같은 이름의 섹션이 있어요.`);
    return;
  }

  const maxOrder = sameCategorySections.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);

  const { error } = await supabase.from("sections").insert({
    user_id: userId,
    category_id: categoryId,
    name,
    sort_order: maxOrder + 10,
  });

  if (error) {
    await showInlineNotice("추가 실패", error.message);
    return;
  }

  const { sections } = await refreshTaxonomyState(userId);
  const created = [...sections].reverse().find(
    (row) => row.category_id === categoryId && row.name === name
  );

  if (created && sectionSelect instanceof HTMLSelectElement) {
    sectionSelect.value = created.id;
    sectionSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

wrapField(categorySelect, "카테고리", addCategoryInline);
wrapField(sectionSelect, "섹션", addSectionInline);
