import fs from 'fs';

const data = JSON.parse(fs.readFileSync('full_appointments_backup.json', 'utf-8'));
console.log(`Total records: ${data.length}`);

const laoAppts = data.filter((a: any) => a.deptId === 'dept_lao');
console.log(`Khoa Lão records total: ${laoAppts.length}`);

// Group by date
const byDate: Record<string, number> = {};
laoAppts.forEach((a: any) => {
  byDate[a.date] = (byDate[a.date] || 0) + 1;
});

const sortedDates = Object.keys(byDate).sort();
console.log("\nDates in Khoa Lão:");
sortedDates.forEach(d => {
  console.log(`Date: ${d} -> ${byDate[d]} appointments`);
});
