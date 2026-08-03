import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("=== Patients ===");
  const { data: patientsData } = await supabase.from("patients").select("*");
  const patients = (patientsData || []).map((row: any) => ({ id: row.id, ...row.data }));
  console.log(`Fetched ${patients.length} patients.`);
  
  // Save mapping of name to id
  const patientByName: { [key: string]: any[] } = {};
  patients.forEach(p => {
    const nameNorm = p.name.trim().toUpperCase();
    if (!patientByName[nameNorm]) patientByName[nameNorm] = [];
    patientByName[nameNorm].push(p);
  });

  console.log("\n=== Staff ===");
  const { data: staffData } = await supabase.from("staff").select("*");
  const staff = (staffData || []).map((row: any) => ({ id: row.id, ...row.data }));
  console.log(`Fetched ${staff.length} staff members.`);
  const staffByName: { [key: string]: any[] } = {};
  staff.forEach(s => {
    const nameNorm = s.name.trim().toUpperCase();
    if (!staffByName[nameNorm]) staffByName[nameNorm] = [];
    staffByName[nameNorm].push(s);
  });

  console.log("\n=== Procedures ===");
  const { data: procData } = await supabase.from("procedures").select("*");
  const procedures = (procData || []).map((row: any) => ({ id: row.id, ...row.data }));
  console.log(`Fetched ${procedures.length} procedures.`);
  const procByName: { [key: string]: any[] } = {};
  procedures.forEach(pr => {
    const nameNorm = pr.name.trim().toUpperCase();
    if (!procByName[nameNorm]) procByName[nameNorm] = [];
    procByName[nameNorm].push(pr);
  });

  console.log("\n=== Appointments for July 29-31, 2026 ===");
  const { data: apptsData } = await supabase.from("appointments").select("*");
  const appts = (apptsData || []).map((row: any) => ({ id: row.id, ...row.data }));
  const targetAppts = appts.filter(a => a.date === "2026-07-29" || a.date === "2026-07-30" || a.date === "2026-07-31");
  console.log(`Fetched ${targetAppts.length} target appointments out of ${appts.length} total.`);

  // Write mapping data to file
  fs.writeFileSync("db_mapping.json", JSON.stringify({
    patientByName,
    staffByName,
    procByName,
    targetAppts
  }, null, 2));
  console.log("Wrote mapping data to db_mapping.json");
}

run().catch(console.error);
