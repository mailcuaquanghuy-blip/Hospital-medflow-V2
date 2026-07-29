import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Helper to convert "HH:mm" to minutes from 00:00
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

async function analyzeLaoTemplates() {
  await signInAnonymously(auth);

  // 1. Get procedures
  const procsSnap = await getDocs(query(collection(db, "procedures"), where("deptId", "==", "dept_lao")));
  const procMap = new Map<string, any>();
  procsSnap.docs.forEach(d => {
    const p = { id: d.id, ...d.data() } as any;
    procMap.set(p.id, p);
  });

  // 2. Get templates
  const templatesSnap = await getDocs(query(collection(db, "templates"), where("deptId", "==", "dept_lao")));
  console.log(`Found ${templatesSnap.size} templates for dept_lao.`);

  const templates = templatesSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(t => !t.isFolder);

  console.log(`Analyzing ${templates.length} non-folder templates...\n`);

  let totalConflicts = 0;

  templates.forEach(t => {
    const tProcs = t.procedures || [];
    if (tProcs.length === 0) return;

    // Calculate staff busy time windows for each procedure in the template
    const procWindows = tProcs.map((tp: any, index: number) => {
      const pDef = procMap.get(tp.procedureId) || {};
      const procName = pDef.name || tp.procedureName || tp.procedureId;

      const startMins = timeToMinutes(tp.startTime);
      const endMins = timeToMinutes(tp.endTime);

      // Determine main busy times
      // New parameter for Điện châm (pr_eqnn4i152 or name "Điện châm"): 0 - 6 min
      // New parameter for Thủy châm (pr_yosjw3y2w or name "Thủy châm"): 5 - 11 min
      let mainBusyStartOffset = tp.mainBusyStart ?? pDef.mainBusyStart ?? 0;
      let mainBusyEndOffset = tp.mainBusyEnd ?? pDef.mainBusyEnd ?? pDef.durationMinutes ?? (endMins - startMins);

      if (tp.procedureId === 'pr_eqnn4i152' || procName.includes('Điện châm')) {
        mainBusyStartOffset = 0;
        mainBusyEndOffset = 6;
      } else if (tp.procedureId === 'pr_yosjw3y2w' || procName.includes('Thủy châm')) {
        mainBusyStartOffset = 5;
        mainBusyEndOffset = 11;
      } else if (tp.procedureId === 'pr_rj91ghjep' || procName.includes('Xoa bóp')) {
        mainBusyStartOffset = 0;
        mainBusyEndOffset = 30;
      }

      const mainBusyStartAbs = startMins + mainBusyStartOffset;
      const mainBusyEndAbs = startMins + mainBusyEndOffset;

      return {
        index,
        tp,
        procName,
        procedureId: tp.procedureId,
        startTime: tp.startTime,
        endTime: tp.endTime,
        startMins,
        endMins,
        mainBusyStartOffset,
        mainBusyEndOffset,
        mainBusyStartAbs,
        mainBusyEndAbs,
        staffId: tp.staffId,
        assistant1Id: tp.assistant1Id
      };
    });

    // Check for overlaps between procedures in this template
    const conflicts = [];
    for (let i = 0; i < procWindows.length; i++) {
      for (let j = i + 1; j < procWindows.length; j++) {
        const pw1 = procWindows[i];
        const pw2 = procWindows[j];

        // 1. Check main staff busy time overlap
        // Overlap condition: max(start1, start2) < min(end1, end2)
        const busyOverlapStart = Math.max(pw1.mainBusyStartAbs, pw2.mainBusyStartAbs);
        const busyOverlapEnd = Math.min(pw1.mainBusyEndAbs, pw2.mainBusyEndAbs);

        if (busyOverlapStart < busyOverlapEnd) {
          conflicts.push({
            type: 'MAIN_STAFF_BUSY_OVERLAP',
            pw1,
            pw2,
            overlapStart: minutesToTime(busyOverlapStart),
            overlapEnd: minutesToTime(busyOverlapEnd),
            overlapDuration: busyOverlapEnd - busyOverlapStart
          });
        }

        // 2. Check full procedure time overlap (if needed)
        const fullOverlapStart = Math.max(pw1.startMins, pw2.startMins);
        const fullOverlapEnd = Math.min(pw1.endMins, pw2.endMins);
        if (fullOverlapStart < fullOverlapEnd) {
          // Check if same staff is assigned or general overlap
        }
      }
    }

    if (conflicts.length > 0) {
      totalConflicts++;
      console.log(`========================================`);
      console.log(`TEMPLATE: "${t.name}" (Group: ${t.group || 'N/A'}, ID: ${t.id})`);
      console.log(`Procedures in template:`);
      procWindows.forEach(pw => {
        console.log(`  - [${pw.startTime} - ${pw.endTime}] ${pw.procName} (Bận NS chính: ${minutesToTime(pw.mainBusyStartAbs)} - ${minutesToTime(pw.mainBusyEndAbs)}, offset ${pw.mainBusyStartOffset}-${pw.mainBusyEndOffset}p)`);
      });
      console.log(`CRITICAL CONFLICTS DETECTED:`);
      conflicts.forEach(c => {
        console.log(`  ⚠️ Trùng thời gian bận nhân sự chính: "${c.pw1.procName}" (${c.pw1.startTime}-${c.pw1.endTime}, bận ${minutesToTime(c.pw1.mainBusyStartAbs)}-${minutesToTime(c.pw1.mainBusyEndAbs)}) TRÙNG VỚI "${c.pw2.procName}" (${c.pw2.startTime}-${c.pw2.endTime}, bận ${minutesToTime(c.pw2.mainBusyStartAbs)}-${minutesToTime(c.pw2.mainBusyEndAbs)}) khoảng ${c.overlapStart} - ${c.overlapEnd} (${c.overlapDuration} phút)`);
      });
      console.log(`\n`);
    }
  });

  console.log(`Total templates with conflicts: ${totalConflicts} / ${templates.length}`);
}

analyzeLaoTemplates().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
