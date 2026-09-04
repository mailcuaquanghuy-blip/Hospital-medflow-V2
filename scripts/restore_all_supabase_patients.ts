import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function restorePatients() {
  console.log("=== RESTORING SUPABASE PATIENTS TO AUTHENTIC STATE ===");
  const data = JSON.parse(fs.readFileSync("db_mapping.json", "utf8"));
  const pList: any[] = [];
  for (const [k, arr] of Object.entries(data.patientByName)) {
    (arr as any[]).forEach(p => pList.push(p));
  }
  console.log(`Loaded ${pList.length} authentic patient records from db_mapping.json.`);

  // 1. Prepare batch of upserts
  const batch = pList.map(p => {
    // Ensure no undefined values
    const cleanPatient = JSON.parse(JSON.stringify(p, (key, value) => value === undefined ? null : value));
    return {
      id: cleanPatient.id,
      data: cleanPatient
    };
  });

  // Upsert in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('patients').upsert(chunk);
    if (error) {
      console.error(`Error in chunk ${i}-${i + chunk.length}:`, error.message);
      // Fallback individual upsert
      for (const item of chunk) {
        const { error: singleErr } = await supabase.from('patients').upsert(item);
        if (singleErr) {
          console.error(`Error upserting patient ${item.id}:`, singleErr.message);
        }
      }
    } else {
      console.log(`Upserted batch ${i + 1} - ${Math.min(i + CHUNK_SIZE, batch.length)} / ${batch.length}`);
    }
  }

  // 2. Verification
  let pRows: any[] = [];
  let from = 0;
  while (true) {
    const { data: res } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!res || res.length === 0) break;
    pRows = pRows.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  const restoredPatients = pRows.map(r => r.data || r);
  console.log(`\nVerified: Total patients in Supabase is now: ${restoredPatients.length}`);

  const treating = restoredPatients.filter(p => p.status === 'TREATING');
  const discharged = restoredPatients.filter(p => p.status === 'DISCHARGED');
  console.log(`TREATING patients: ${treating.length}`);
  console.log(`DISCHARGED patients: ${discharged.length}`);

  // Check visible on 2026-09-03, 2026-09-05, 2026-09-06 for Khoa Lão
  const checkVisible = (date: string) => {
    return restoredPatients.filter(p => {
      if (p.admittedByDeptId !== 'dept_lao') return false;
      const adm = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
      if (adm && date < adm) return false;
      const isDis = p.status === 'DISCHARGED';
      const dis = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';
      if (isDis && dis && dis < date) return false;
      return true;
    }).length;
  };

  console.log(`Visible Lao patients on 2026-09-03: ${checkVisible('2026-09-03')}`);
  console.log(`Visible Lao patients on 2026-09-05: ${checkVisible('2026-09-05')}`);
  console.log(`Visible Lao patients on 2026-09-06: ${checkVisible('2026-09-06')}`);
}

restorePatients().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
