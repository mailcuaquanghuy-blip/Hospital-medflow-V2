import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  const tables = ['patients', 'appointments', 'staff', 'procedures', 'attendance', 'machine_shifts', 'templates', 'users'];
  
  for (const table of tables) {
    console.log(`\nTesting upsert on table: ${table}...`);
    const testId = `test_test_val_${Date.now()}`;
    const testData = { id: testId, name: "Test Row", deptId: "dept_lao", updated_at: new Date().toISOString() };
    
    const { error } = await supabase
      .from(table)
      .upsert({ id: testId, data: testData });
      
    if (error) {
      console.error(`❌ Upsert failed on table ${table}:`, error.message, error);
    } else {
      console.log(`✅ Upsert succeeded on table ${table}!`);
      
      // Clean it up
      const { error: delError } = await supabase
        .from(table)
        .delete()
        .eq('id', testId);
      if (delError) {
        console.warn(`⚠️ Cleanup failed for ${table}:`, delError.message);
      } else {
        console.log(`🧹 Cleaned up test row for ${table}.`);
      }
    }
  }
}

testConnection().then(() => process.exit(0)).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
