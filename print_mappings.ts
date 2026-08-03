import fs from "fs";

const data = JSON.parse(fs.readFileSync("db_mapping.json", "utf-8"));

console.log("=== STAFF ===");
for (const [name, list] of Object.entries(data.staffByName)) {
  const s = list as any[];
  console.log(`${name}: ${s.map(x => `${x.id} (${x.role || 'no-role'})`).join(", ")}`);
}

console.log("\n=== PROCEDURES ===");
for (const [name, list] of Object.entries(data.procByName)) {
  const p = list as any[];
  console.log(`${name}: ${p.map(x => `${x.id} (dur: ${x.duration}m, dept: ${x.deptId})`).join(", ")}`);
}

console.log("\n=== PATIENTS WITH MULTIPLE RECORDS ===");
for (const [name, list] of Object.entries(data.patientByName)) {
  const p = list as any[];
  if (p.length > 1) {
    console.log(`${name}:`);
    p.forEach(x => {
      console.log(`  - ${x.id}: code=${x.code}, status=${x.status}, adm=${x.admissionDate}, dis=${x.dischargeDate}`);
    });
  }
}
