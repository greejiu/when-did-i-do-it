import "./theme-settings.js?v=1";
import "./scroll-preserve.js?v=1";
import { supabase } from "./supabase.js";

let itemRows = [];
let categoryRows = [];
let sectionRows = [];
let loadingReferenceData = null;

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

async function loadReferenceData() {
  if (loadingReferenceData) return loadingReferenceData;

  loadingReferenceData = (async () => {
    const [{ data: items, error: itemError }, { data: categories, error: categoryError }, { data: sections, error: sectionError }] =
      await Promise.all([
        supabase.from("items").select("id, name, category_id, section_id, created_at").order("created_at", { ascending: true }),
        supabase.from("categories").select("id, name"),
        supabase.from("sections").select("id, category_id, name"),
      ]);

    if (itemError) throw itemError;
    if (categoryError) throw categoryError;
    if (sectionError) throw sectionError;

    itemRows = items ?? [];
    categoryRows = categories ?? [];
    sectionRows = sections ?? [];
  })().finally(() => {
    loadingReferenceData = null;
  });

  return loadingReferenceData;
}

function findItemForCard(card) {
  const title = cleanText(card.querySelector(".item-title")?.textContent);
  if (!title) return null;

  let candidates = itemRows.filter((item) => cleanText(item.name) === title);
  if (candidates.length <= 1) return candidates[0] ?? null;

  const categoryHeading = cleanText(
    card.closest(".item-category-group")?.querySelector(".item-category-heading h3")?.textContent
  );
  if (categoryHeading) {
    const category = categoryRows.find((row) => cleanText(row.name) === categoryHeading);
    if (category) {
      const narrowed = candidates.filter((item) => item.category_id === category.id);
      if (narrowed.length > 0) candidates = narrowed;
    }
  }

  const sectionHeading = cleanText(
    card.closest(".item-section-group")?.querySelector(".item-section-heading h4")?.textContent
  );
  if (sectionHeading && sectionHeading !== "섹션 없음" && candidates.length > 1) {
    const sectionIds = sectionRows
      .filter((row) => cleanText(row.name) === sectionHeading)
      .map((row) => row.id);
    const narrowed = candidates.filter((item) => sectionIds.includes(item.section_id));
    if (narrowed.length > 0) candidates = narrowed;
  }

  return candidates[0] ?? null;
}

function assignIds(root = document) {
  const cards = root.matches?.(".item-card")
    ? [root]
    : [...(root.querySelectorAll?.(".item-card") ?? [])];

  for (const card of cards) {
    if (!(card instanceof HTMLElement)) continue;
    if (card.dataset.itemId) continue;
    const item = findItemForCard(card);
    if (item) card.dataset.itemId = item.id;
  }
}

async function refreshAndAssign(root = document) {
  try {
    await loadReferenceData();
    assignIds(root);
  } catch (error) {
    console.error("하위 할일 연결용 항목 정보를 불러오지 못했어요.", error);
  }
}

await refreshAndAssign();

const observer = new MutationObserver(async (mutations) => {
  const roots = [];
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(".item-card") || node.querySelector(".item-card")) roots.push(node);
    }
  }

  if (roots.length === 0) return;
  await refreshAndAssign();
  for (const root of roots) assignIds(root);
});

observer.observe(document.body, { childList: true, subtree: true });

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (!session?.user) {
    itemRows = [];
    categoryRows = [];
    sectionRows = [];
    return;
  }

  await refreshAndAssign();
});

await import("./subitems.js?v=1");
await import("./history-subitems-compat.js?v=1");
