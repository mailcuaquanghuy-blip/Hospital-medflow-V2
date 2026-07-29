import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSupabase() {
  const tables = ['patients', 'appointments', 'templates', 'backups'];
  
  for (const table of tables) {
    console.log(`\n--- Inspecting table: ${table} ---`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Error querying ${table}:`, error.message);
      continue;
    }
    console.log(`Found ${data?.length || 0} rows in ${table}.`);
    if (data && data.length > 0) {
      // Show first 3 rows as sample
      console.log('Sample data (first 3 items):');
      data.slice(0, 3).forEach(row => {
        console.log(`ID: ${row.id}`, JSON.stringify(row.data || row).substring(0, 300));
      });
      
      if (table === 'appointments') {
        const dates: Record<string, number> = {};
        data.forEach(row => {
          const appt = row.data || row;
          if (appt.date) {
            dates[appt.date] = (dates[appt.date] || 0) + 1;
          }
        });
        console.log('Appointments by Date:', dates);
      }
    }
  }
}

inspectSupabase().then(() => process.exit(0)).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
