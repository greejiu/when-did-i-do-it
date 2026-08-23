import { supabase } from "./supabase.js";

const DEFAULT_HOUSE_SECTIONS = [
  { name: "내 방", sort_order: 10 },
  { name: "거실", sort_order: 20 },
  { name: "주방", sort_order: 30 },
  { name: "욕실", sort_order: 40 },
  { name: "기타", sort_order: 50 },
];

export async function ensureDefaultSections(userId, categories) {
  const householdCategory = categories.find(
    (category) => category.name === "🏠 집안일" || category.name === "집안일"
  );
  if (!householdCategory) return;

  const rows = DEFAULT_HOUSE_SECTIONS.map((section) => ({
    user_id: userId,
    category_id: householdCategory.id,
    name: section.name,
    sort_order: section.sort_order,
  }));

  const { error } = await supabase
    .from("sections")
    .upsert(rows, { onConflict: "user_id,category_id,name", ignoreDuplicates: true });

  if (error) throw error;
}

export async function getSections() {
  const { data, error } = await supabase
    .from("sections")
    .select("id, category_id, name, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
