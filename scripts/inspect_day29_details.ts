import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectDay29() {
  console.log("=== Querying Day 29 Appointments from Supabase ===");
  const { data: appts, error: apptsError } = await supabase.from('appointments').select('*');
  if (apptsError) {
    console.error('Error fetching appointments:', apptsError.message);
    return;
  }
  
  const { data: patients, error: patsError } = await supabase.from('patients').select('*');
  if (patsError) {
    console.error('Error fetching patients:', patsError.message);
    return;
  }
  
  const patMap = new Map<string, string>();
  patients.forEach(row => {
    const p = row.data || row;
    patMap.set(row.id, p.name);
  });
  
  const day29Appts = appts.filter(row => {
    const a = row.data || row;
    return a.date === '2026-07-29';
  }).map(row => {
    const a = row.data || row;
    return {
      id: row.id,
      patientId: a.patientId,
      patientName: patMap.get(a.patientId) || 'Unknown',
      procedureId: a.procedureId,
      startTime: a.startTime,
      endTime: a.endTime,
      staffId: a.staffId,
      note: a.note || ''
    };
  });
  
  console.log(`Found ${day29Appts.length} appointments for 2026-07-29:`);
  day29Appts.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  day29Appts.forEach((a, i) => {
    console.log(`[${i+1}] ID: ${a.id} | Patient: ${a.patientName} | Time: ${a.startTime}-${a.endTime} | Proc: ${a.procedureId} | Note: "${a.note}"`);
  });
}

inspectDay29().then(() => process.exit(0)).catch(err => console.error(err));
