// src/core/session.js
import { getSupabase } from "./supabase.js";

export async function requireSession() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data?.session) throw new Error("NO_SESSION");
  return data.session;
}
