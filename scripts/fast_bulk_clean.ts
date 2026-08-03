import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fastBulkClean() {
  console.log("Starting fast bulk delete...");
  const res1 = await supabase.from('appointments').delete().like('id', 'appt_1785%');
  console.log("Deleted appt_1785%:", res1.error ? res1.error.message : "Success");

  const res2 = await supabase.from('appointments').delete().like('id', 'appt_copy_1785%');
  console.log("Deleted appt_copy_1785%:", res2.error ? res2.error.message : "Success");

  // Also check if there are any other test items
  const res3 = await supabase.from('appointments').delete().like('id', 'test_%');
  console.log("Deleted test_%:", res3.error ? res3.error.message : "Success");

  // Verify remaining count
  let all: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const res = await supabase.from('appointments').select('id, date, patientId, procedureId').range(from, from + step - 1);
    if (!res.data || res.data.length === 0) break;
    all = all.concat(res.data);
    if (res.data.length < step) break;
    from += step;
  }

  console.log(`Remaining appointments count in Supabase: ${all.length}`);
}

fastBulkClean();
