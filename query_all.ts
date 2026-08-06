import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== PATIENTS ===");
  const { data: patients, error: pErr } = await supabase.from('patients').select('*');
  if (pErr) console.error(pErr);
  else {
    console.log(`Loaded ${patients?.length} patients`);
    patients?.forEach(p => {
      if (p.referrals && p.referrals.length > 0) {
        console.log(`Patient ${p.id} (${p.name}): Status=${p.status}, AdmittedByDept=${p.admittedByDeptId}, Referrals=${JSON.stringify(p.referrals)}`);
      }
    });
  }

  console.log("\n=== APPOINTMENTS ===");
  const { data: appts, error: aErr } = await supabase.from('appointments').select('*').eq('date', '2026-08-03');
  if (aErr) console.error(aErr);
  else {
    console.log(`Loaded ${appts?.length} appointments on 2026-08-03`);
    appts?.forEach(a => {
      console.log(`Appointment ${a.id}: PatientId=${a.patientId}, DeptId=${a.deptId}, ProcId=${a.procedureId}, Start=${a.startTime}, End=${a.endTime}, Status=${a.status}`);
    });
  }

  console.log("\n=== PROCEDURES ===");
  const { data: procs, error: prErr } = await supabase.from('procedures').select('*');
  if (prErr) console.error(prErr);
  else {
    console.log(`Loaded ${procs?.length} procedures`);
    procs?.forEach(p => {
      console.log(`Procedure ${p.id}: Name="${p.name}", DeptId=${p.deptId}`);
    });
  }
}

run();
