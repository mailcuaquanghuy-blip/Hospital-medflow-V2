import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data: res, error } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (error || !res || res.length === 0) break;
    all = all.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  const s5 = all.filter(r => (r.data || r).date === '2026-09-05' && (r.data || r).deptId === 'dept_lao');
  const s6 = all.filter(r => (r.data || r).date === '2026-09-06' && (r.data || r).deptId === 'dept_lao');

  console.log(`Total rows in Supabase appointments table: ${all.length}`);
  console.log(`2026-09-05 Khoa Lão appointments in Supabase: ${s5.length}`);
  console.log(`2026-09-06 Khoa Lão appointments in Supabase: ${s6.length}`);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
