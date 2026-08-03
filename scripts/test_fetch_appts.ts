import { fetchSupabaseTable } from "../utils/supabaseService";

async function testFetch() {
  const appts = await fetchSupabaseTable<any>('appointments');
  console.log("Total appointments loaded via fetchSupabaseTable:", appts?.length);

  const jul31 = (appts || []).filter(a => a.date === '2026-07-31');
  console.log("Total appointments on 2026-07-31:", jul31.length);
  
  const luuJul31 = jul31.filter(a => a.patientId === 'p_s9c9eqrsw');
  console.log("Hoàng Thị Lưu appointments on 2026-07-31:", luuJul31);
}

testFetch();
