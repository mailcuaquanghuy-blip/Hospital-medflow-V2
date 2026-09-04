const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  "https://chavuvjjrimdeomjexej.supabase.co",
  "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a"
);

function removeDiacritics(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function syncAll() {
  console.log("Starting reconciliation of procedures for Khoa Lão...");

  // 1. Fetch metadata
  const { data: staffList } = await supabase.from("staff").select("id, data");
  const { data: patientList } = await supabase.from("patients").select("id, data");
  const { data: procedureList } = await supabase.from("procedures").select("id, data");

  const staffMap = {};
  for (const s of staffList || []) {
    const name = s.data?.name || "";
    staffMap[removeDiacritics(name)] = s.id;
  }

  const patientMap = {};
  for (const p of patientList || []) {
    const name = p.data?.name || p.data?.fullName || "";
    patientMap[removeDiacritics(name)] = p.id;
  }

  // 2. Read all data chunk files
  const dataFiles = [
    "./scripts/data_chunk_1.js",
    "./scripts/data/day_01_02.js",
    "./scripts/data/day_04_07.js"
  ];

  let rawLines = [];
  for (const f of dataFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, "utf8");
      const lines = content.split(/\r?\n/).filter(l => l.includes(",") && !l.startsWith("Họ") && !l.startsWith("module.exports") && !l.startsWith("//"));
      console.log(`Read ${lines.length} lines from ${f}`);
      rawLines = rawLines.concat(lines);
    }
  }

  // Deduplicate raw lines based on patient, date, start time, end time
  const uniqueRecords = new Map();
  let skipped = 0;

  for (const line of rawLines) {
    const parts = line.split(",");
    if (parts.length < 6) continue;
    const patName = parts[0].trim();
    const startRaw = parts[3].trim(); // e.g. 01/08/2026 16:05:00
    const endRaw = parts[4].trim();   // e.g. 01/08/2026 16:30:00
    const staffRaw = parts.slice(5).join(",").trim();

    if (!patName || !startRaw || !endRaw) continue;

    // Parse date & time
    const startMatch = startRaw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
    const endMatch = endRaw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
    if (!startMatch || !endMatch) continue;

    const [ , sDay, sMonth, sYear, startTime ] = startMatch;
    const [ , , , , endTime ] = endMatch;
    const dateStr = `${sYear}-${sMonth}-${sDay}`;

    const pId = patientMap[removeDiacritics(patName)];
    if (!pId) {
      console.warn(`Warning: Patient "${patName}" not found in database!`);
      continue;
    }

    const staffTokens = staffRaw.split(/;/).map(s => s.trim()).filter(Boolean);
    const mainStaffId = staffMap[removeDiacritics(staffTokens[0])] || "s_z83w580hx";
    const asst1Id = staffTokens[1] ? (staffMap[removeDiacritics(staffTokens[1])] || null) : null;
    const asst2Id = staffTokens[2] ? (staffMap[removeDiacritics(staffTokens[2])] || null) : null;

    // Determine procedure ID based on staff or duration
    let procedureId = "pr_eqnn4i152"; // Điện châm default
    if (staffTokens[0] && removeDiacritics(staffTokens[0]).includes("ha")) {
      procedureId = "pr_yosjw3y2w"; // Thủy châm
    } else if (staffTokens[0] && removeDiacritics(staffTokens[0]).includes("lam")) {
      procedureId = "pr_rj91ghjep"; // Xoa bóp
    }

    const key = `${pId}_${dateStr}_${startTime}_${endTime}`;
    if (!uniqueRecords.has(key)) {
      uniqueRecords.set(key, {
        id: `appt_lao_${pId.replace("p_", "")}_${dateStr.replace(/-/g, "")}_${startTime.replace(":", "")}`,
        patientId: pId,
        deptId: "dept_lao",
        date: dateStr,
        startTime,
        endTime,
        staffId: mainStaffId,
        assistant1Id: asst1Id,
        assistant2Id: asst2Id,
        procedureId,
        status: "COMPLETED",
        notes: `Thực hiện: ${staffTokens.join(", ")}`,
        selectedDurationOptionId: "default",
        conflictDetails: []
      });
    } else {
      skipped++;
    }
  }

  const apptsToInsert = Array.from(uniqueRecords.values());
  console.log(`Total valid unique procedures to sync: ${apptsToInsert.length} (Skipped duplicates: ${skipped})`);

  // Target dates
  const dates = Array.from(new Set(apptsToInsert.map(a => a.date))).sort();
  console.log("Target dates:", dates);

  // Batch upsert to Supabase
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < apptsToInsert.length; i += batchSize) {
    const chunk = apptsToInsert.slice(i, i + batchSize).map(item => ({
      id: item.id,
      data: item
    }));

    const { error } = await supabase.from("appointments").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`Error inserting batch ${i} - ${i + batchSize}:`, error);
    } else {
      inserted += chunk.length;
      console.log(`Upserted ${inserted}/${apptsToInsert.length} appointments...`);
    }
  }

  console.log(`Successfully reconciled and synchronized ${inserted} procedures for Khoa Lão!`);
}

syncAll().catch(console.error);
