import { createClient } from "@supabase/supabase-js";

// fallback ກັນ build ລົ້ມເມື່ອ env ຍັງບໍ່ຖືກຕັ້ງ — ຕົວຈິງຕ້ອງຕັ້ງ env ສະເໝີ
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(url, key);
