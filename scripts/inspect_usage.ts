import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const mapping = {
  "s_lao_101": "s_hdvlre3q6", // Vũ Thị Hương Lan
  "s_lao_102": "s_1xca9gdv3", // Hoàng Thu Hương
  "s_lao_103": "s_p085044zx", // Bùi Thị Thu Hà
  "s_lao_104": "s_j70mhmvcl", // Nguyễn Thị Huyền Trang
  "s_lao_105": "s_w8k2iebit", // Vũ Thúy Hà
  "s_lao_106": "s_z83w580hx", // Nguyễn Tùng Lâm
  "s_lao_107": "s_lbf6qsiya", // Cà Thị Oanh
  "s_lao_108": "s_jjuifzlke", // Lò Hồng Hạnh
  "s_lao_109": "s_tppw9td1m"  // Lê Hương Giang
};

async function inspectUsage() {
  console.log("Fetching appointments...");
  const { data: apptRows, error: apptErr } = await supabase.from('appointments').select('*');
  if (apptErr || !apptRows) {
    console.error("Error fetching appointments:", apptErr?.message);
    return;
  }
  const appts = apptRows.map(r => r.data || r);

  console.log("Fetching attendance...");
  const { data: attRows, error: attErr } = await supabase.from('attendance').select('*');
  if (attErr || !attRows) {
    console.error("Error fetching attendance:", attErr?.message);
    return;
  }
  const atts = attRows.map(r => r.data || r);

  console.log("Checking appointments for duplicate staff references...");
  const duplicateIds = Object.keys(mapping);
  
  appts.forEach(a => {
    if (duplicateIds.includes(a.staffId)) {
      console.log(`- Appt ${a.id} on ${a.date} (${a.startTime}-${a.endTime}): staffId is duplicate ${a.staffId}`);
    }
    if (duplicateIds.includes(a.assistant1Id)) {
      console.log(`- Appt ${a.id} on ${a.date} (${a.startTime}-${a.endTime}): assistant1Id is duplicate ${a.assistant1Id}`);
    }
    if (duplicateIds.includes(a.assistant2Id)) {
      console.log(`- Appt ${a.id} on ${a.date} (${a.startTime}-${a.endTime}): assistant2Id is duplicate ${a.assistant2Id}`);
    }
  });

  console.log("Checking attendance for duplicate staff references...");
  atts.forEach(r => {
    if (duplicateIds.includes(r.staffId)) {
      console.log(`- Attendance record ${r.id} on ${r.date}: staffId is duplicate ${r.staffId}`);
    }
  });
}

inspectUsage().catch(err => console.error(err));
