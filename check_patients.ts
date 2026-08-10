import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envVars: Record<string, string> = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
} catch (e) {}

const supabaseUrl = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: patients } = await supabase.from('patients').select('id, name, admittedByDeptId, status');
  console.log(`Total patients in Supabase: ${patients?.length}`);
  
  // Search for patients matching pieng, hac, hieng
  const matches = patients?.filter(p => {
    const name = (p.name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return name.includes('pieng') || name.includes('hac') || name.includes('hieng');
  });

  console.log("Matching patients:");
  console.log(matches);

  if (matches && matches.length > 0) {
    const ids = matches.map(m => m.id);
    const { data: appts } = await supabase.from('appointments').select('*').in('patientId', ids);
    console.log(`\nAppointments for these patients (${appts?.length}):`);
    appts?.forEach(a => {
      console.log(`[${a.date}] Patient: ${a.patientId} | Dept: ${a.deptId} | Appt ID: ${a.id} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime}`);
    });
  }
}

run();
