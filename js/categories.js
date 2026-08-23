import { supabase } from "./supabase.js";

const DEFAULT_CATEGORIES = [
  { name: "집안일", icon: "🏠" },
  { name: "공적인 일 관리", icon: "📋" },
  { name: "반려동물 관리", icon: "🐾" },
];

export async function ensureDefaultCategories(userId) {
  const rows = DEFAULT_CATEGORIES.map((category) => ({
    user_id: userId,
    name: category.name,
    icon: category.icon,
  }));

  const { error } = await supabase
    .from("categories")
    .upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
