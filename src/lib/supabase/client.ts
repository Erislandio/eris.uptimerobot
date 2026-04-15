import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    console.error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL. Please set it in .env.local",
    );
    // Return a dummy client or handle appropriately to prevent crash during build/dev
  }

  return createBrowserClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseKey || "placeholder",
  );
}
