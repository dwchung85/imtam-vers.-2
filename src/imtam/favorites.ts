import { supabase } from "@/integrations/supabase/client";

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase.from("favorites").select("house_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.house_id);
}

export async function setFavorite(userId: string, houseId: string, on: boolean) {
  if (on) {
    const { error } = await supabase.from("favorites").insert({ user_id: userId, house_id: houseId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("house_id", houseId);
    if (error) throw error;
  }
}
