import { deleteSupabaseItem } from "../utils/supabaseService";

async function deleteFakeTemplates() {
  await deleteSupabaseItem('templates', 'test_test_1785346443292');
  await deleteSupabaseItem('templates', 'test_test_1785346379654');
  console.log("Deleted fake templates.");
}

deleteFakeTemplates();
