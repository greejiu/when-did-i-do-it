import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://mmpsyajgyufdxmmnxqba.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_odr6eVpfut1PbfGcG9vDYQ_pKEVFggA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function checkSupabaseConnection() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase connection failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
