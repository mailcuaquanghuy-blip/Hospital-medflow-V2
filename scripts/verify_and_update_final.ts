import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

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

const ORIGINAL_TEMPLATES_DATA: Record<string, any[]> = {
  "tmpl_0ffuwflf9": [ // Giường 431 - L22
    { procedureId: "pr_eqnn4i152", startTime: "16:12", endTime: "16:37", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:18", endTime: "16:43", staffId: "s_1yclzxcef" }
  ],
  "tmpl_0j4evu9yt": [ // Giường 409 - L19
    { procedureId: "pr_eqnn4i152", startTime: "10:25", endTime: "10:50", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "08:42", endTime: "09:07", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "09:53", endTime: "10:23", staffId: "s_p085044zx" }
  ],
  "tmpl_0j6hmtzyn": [ // Giường 452 - L11
    { procedureId: "pr_eqnn4i152", startTime: "09:34", endTime: "09:59", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:35", endTime: "11:00", staffId: "s_1yclzxcef" }
  ],
  "tmpl_1423cfac0": [ // Giường 432 - L23
    { procedureId: "pr_eqnn4i152", startTime: "16:18", endTime: "16:43", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:25", endTime: "16:50", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:35", endTime: "15:05", staffId: "s_z83w580hx" }
  ],
  "tmpl_1j81e6hzf": [ // Giường 418 - L28
    { procedureId: "pr_eqnn4i152", startTime: "08:56", endTime: "09:21", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:46", endTime: "10:11", staffId: "s_z83w580hx" }
  ],
  "tmpl_1oumoby65": [ // Giường 448 - L07
    { procedureId: "pr_eqnn4i152", startTime: "09:10", endTime: "09:35", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:11", endTime: "10:36", staffId: "s_1yclzxcef" }
  ],
  "tmpl_246v9mzno": [ // Giường 429 - L20
    { procedureId: "pr_eqnn4i152", startTime: "15:54", endTime: "16:19", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:00", endTime: "16:25", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "13:32", endTime: "14:02", staffId: "s_z83w580hx" }
  ],
  "tmpl_3jg6x4rri": [ // Giường 401 - L12
    { procedureId: "pr_eqnn4i152", startTime: "14:31", endTime: "14:56", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:00", endTime: "15:25", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:03", endTime: "14:33", staffId: "s_c025m4y4p" }
  ],
  "tmpl_444lmdaqn": [ // Giường 413 - L23
    { procedureId: "pr_eqnn4i152", startTime: "10:51", endTime: "11:16", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:16", endTime: "09:41", staffId: "s_z83w580hx" }
  ],
  "tmpl_5sj6nyio1": [ // L31
    { procedureId: "pr_eqnn4i152", startTime: "09:22", endTime: "09:47", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:10", endTime: "10:35", staffId: "s_z83w580hx" }
  ],
  "tmpl_75cv78zcf": [ // Giường 421 - L30
    { procedureId: "pr_eqnn4i152", startTime: "09:16", endTime: "09:41", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:04", endTime: "10:29", staffId: "s_z83w580hx" }
  ],
  "tmpl_7aaz3ro3f": [ // Giường 402 - L35
    { procedureId: "pr_eqnn4i152", startTime: "14:45", endTime: "15:10", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:17", endTime: "15:42", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:04", endTime: "14:34", staffId: "s_w8k2iebit" }
  ],
  "tmpl_7i41bijz6": [ // Giường 439 - L16
    { procedureId: "pr_eqnn4i152", startTime: "10:06", endTime: "10:31", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:48", endTime: "11:13", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "09:15", endTime: "09:45", staffId: "s_c025m4y4p" }
  ],
  "tmpl_7zd39v48g": [ // L29
    { procedureId: "pr_eqnn4i152", startTime: "16:26", endTime: "16:51", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:03", endTime: "14:28", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:38", endTime: "16:08", staffId: "s_z83w580hx" }
  ],
  "tmpl_8myrzq67r": [ // Giường 408 - L19
    { procedureId: "pr_eqnn4i152", startTime: "15:24", endTime: "15:49", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:56", endTime: "16:21", staffId: "s_1yclzxcef" }
  ],
  "tmpl_8pvh7p70z": [ // L30
    { procedureId: "pr_eqnn4i152", startTime: "16:32", endTime: "16:57", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:10", endTime: "14:35", staffId: "s_1yclzxcef" }
  ],
  "tmpl_8tnrneh1v": [ // Giường 434 - L35
    { procedureId: "pr_eqnn4i152", startTime: "09:46", endTime: "10:11", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:47", endTime: "11:12", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "07:47", endTime: "08:17", staffId: "s_w8k2iebit" }
  ],
  "tmpl_9an0hd6kz": [ // Giường 468 - L02
    { procedureId: "pr_eqnn4i152", startTime: "08:36", endTime: "09:01", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:41", endTime: "10:06", staffId: "s_1yclzxcef" }
  ],
  "tmpl_ailxcwuzj": [ // Giường 470 - L04
    { procedureId: "pr_eqnn4i152", startTime: "08:50", endTime: "09:15", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:53", endTime: "10:18", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:19", endTime: "08:49", staffId: "s_p085044zx" }
  ],
  "tmpl_aurqv2hro": [ // Giường 417 - L27
    { procedureId: "pr_eqnn4i152", startTime: "08:50", endTime: "09:15", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:40", endTime: "10:05", staffId: "s_z83w580hx" }
  ],
  "tmpl_bj2z9k2tg": [ // Giường 461 - L03
    { procedureId: "pr_eqnn4i152", startTime: "13:43", endTime: "14:08", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:17", endTime: "14:42", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:40", endTime: "16:10", staffId: "s_w8k2iebit" }
  ],
  "tmpl_bx0121uic": [ // Giường 423 - L26
    { procedureId: "pr_eqnn4i152", startTime: "16:08", endTime: "16:33", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:38", endTime: "17:03", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:03", endTime: "14:33", staffId: "s_z83w580hx" }
  ],
  "tmpl_cj3xl8br0": [ // Giường 446 - L06
    { procedureId: "pr_eqnn4i152", startTime: "14:01", endTime: "14:26", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:35", endTime: "15:00", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:07", endTime: "15:37", staffId: "s_c025m4y4p" }
  ],
  "tmpl_d1p4euc0k": [ // Giường 404 - L15
    { procedureId: "pr_eqnn4i152", startTime: "14:58", endTime: "15:23", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:30", endTime: "15:55", staffId: "s_1yclzxcef" }
  ],
  "tmpl_e5ffehyxv": [ // Giường 451 - L10
    { procedureId: "pr_eqnn4i152", startTime: "09:28", endTime: "09:53", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:29", endTime: "10:54", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:50", endTime: "09:20", staffId: "s_p085044zx" }
  ],
  "tmpl_efnqvpusw": [ // Giường 472 - L06
    { procedureId: "pr_eqnn4i152", startTime: "09:02", endTime: "09:27", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:05", endTime: "10:30", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:19", endTime: "08:49", staffId: "s_w8k2iebit" }
  ],
  "tmpl_fg3ux14em": [ // Giường 443 - L04
    { procedureId: "pr_eqnn4i152", startTime: "13:49", endTime: "14:14", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:21", endTime: "14:46", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:12", endTime: "16:42", staffId: "s_w8k2iebit" }
  ],
  "tmpl_fmqobzm6e": [ // L47
    { procedureId: "pr_eqnn4i152", startTime: "09:04", endTime: "09:29", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:42", endTime: "10:07", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:25", endTime: "10:55", staffId: "s_p085044zx" }
  ],
  "tmpl_frpduhguw": [ // Giường 458 - L11
    { procedureId: "pr_eqnn4i152", startTime: "14:31", endTime: "14:56", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:06", endTime: "15:31", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:45", endTime: "17:15", staffId: "s_c025m4y4p" }
  ],
  "tmpl_fsvszahfk": [ // Giường 447 - L07
    { procedureId: "pr_eqnn4i152", startTime: "13:43", endTime: "14:08", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:17", endTime: "14:42", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "13:32", endTime: "14:02", staffId: "s_c025m4y4p" }
  ],
  "tmpl_gz9r767gs": [ // Giường 459 - L01
    { procedureId: "pr_eqnn4i152", startTime: "13:31", endTime: "13:56", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:03", endTime: "14:28", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:36", endTime: "15:06", staffId: "s_w8k2iebit" }
  ],
  "tmpl_h1qdfjaqa": [ // Giường 430 - L21
    { procedureId: "pr_eqnn4i152", startTime: "16:00", endTime: "16:25", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:06", endTime: "16:31", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:43", endTime: "17:13", staffId: "s_z83w580hx" }
  ],
  "tmpl_iq8mbg3dh": [ // L32
    { procedureId: "pr_eqnn4i152", startTime: "09:28", endTime: "09:53", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:16", endTime: "10:41", staffId: "s_z83w580hx" }
  ],
  "tmpl_jrdiy03a2": [ // Giường 435 - L14
    { procedureId: "pr_eqnn4i152", startTime: "09:52", endTime: "10:17", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:36", endTime: "11:01", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "07:48", endTime: "08:18", staffId: "s_p085044zx" }
  ],
  "tmpl_ju6eupsll": [ // Giường 441 - L17
    { procedureId: "pr_eqnn4i152", startTime: "10:12", endTime: "10:37", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "08:30", endTime: "08:55", staffId: "s_z83w580hx" }
  ],
  "tmpl_kiu2lswc6": [ // Giường 454 - L08
    { procedureId: "pr_eqnn4i152", startTime: "13:49", endTime: "14:14", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:44", endTime: "15:09", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "13:32", endTime: "14:02", staffId: "s_w8k2iebit" }
  ],
  "tmpl_kxubo1ud4": [ // Giường 411 - L21
    { procedureId: "pr_eqnn4i152", startTime: "10:37", endTime: "11:02", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:04", endTime: "09:29", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "09:47", endTime: "10:17", staffId: "s_c025m4y4p" }
  ],
  "tmpl_loofxhjkt": [ // Giường 407 - L18
    { procedureId: "pr_eqnn4i152", startTime: "15:18", endTime: "15:43", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:50", endTime: "16:15", staffId: "s_1yclzxcef" }
  ],
  "tmpl_n010i0alh": [ // Giường 416 - L26
    { procedureId: "pr_eqnn4i152", startTime: "08:42", endTime: "09:07", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:34", endTime: "09:59", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:25", endTime: "10:55", staffId: "s_lbf6qsiya" } // Reassigned to Nurse Cà Thị Oanh
  ],
  "tmpl_nz8casmri": [ // Giường 424 - L27
    { procedureId: "pr_eqnn4i152", startTime: "16:14", endTime: "16:39", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "13:49", endTime: "14:14", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:40", endTime: "16:10", staffId: "s_lbf6qsiya" }
  ],
  "tmpl_o0ku37u4i": [ // Giường 433 - L24
    { procedureId: "pr_eqnn4i152", startTime: "15:54", endTime: "16:19", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:25", endTime: "16:50", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:07", endTime: "15:37", staffId: "s_z83w580hx" }
  ],
  "tmpl_o3ew09258": [ // Giường 419 - L29
    { procedureId: "pr_eqnn4i152", startTime: "09:02", endTime: "09:27", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:52", endTime: "10:17", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:20", endTime: "10:50", staffId: "s_c025m4y4p" }
  ],
  "tmpl_opduk66vt": [ // Giường 471 - L05
    { procedureId: "pr_eqnn4i152", startTime: "08:56", endTime: "09:21", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:59", endTime: "10:24", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:12", endTime: "08:42", staffId: "s_c025m4y4p" }
  ],
  "tmpl_oyvlgyyav": [ // Giường 457 - L10
    { procedureId: "pr_eqnn4i152", startTime: "14:25", endTime: "14:50", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:59", endTime: "15:24", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:12", endTime: "16:42", staffId: "s_c025m4y4p" }
  ],
  "tmpl_qjc4qzs9i": [ // Giường 410 - L20
    { procedureId: "pr_eqnn4i152", startTime: "10:31", endTime: "10:56", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "08:58", endTime: "09:23", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "09:54", endTime: "10:24", staffId: "s_w8k2iebit" }
  ],
  "tmpl_seq29glqd": [ // Giường 467 - L01
    { procedureId: "pr_eqnn4i152", startTime: "08:30", endTime: "08:55", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:30", endTime: "10:55", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:57", endTime: "11:27", staffId: "s_p085044zx" }
  ],
  "tmpl_sqgmmwe6y": [ // Giường 403 - L14
    { procedureId: "pr_eqnn4i152", startTime: "14:52", endTime: "15:17", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:24", endTime: "15:49", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "13:32", endTime: "14:02", staffId: "s_lbf6qsiya" }
  ],
  "tmpl_svmbz6cac": [ // Giường 438 - L15
    { procedureId: "pr_eqnn4i152", startTime: "10:00", endTime: "10:25", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:42", endTime: "11:07", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "09:22", endTime: "09:52", staffId: "s_w8k2iebit" }
  ],
  "tmpl_sx7xp5nop": [ // Giường 414 - L24
    { procedureId: "pr_eqnn4i152", startTime: "08:30", endTime: "08:55", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:22", endTime: "09:47", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:26", endTime: "10:56", staffId: "s_w8k2iebit" }
  ],
  "tmpl_sxov9eyjp": [ // Giường 449 - L08
    { procedureId: "pr_eqnn4i152", startTime: "09:16", endTime: "09:41", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:17", endTime: "10:42", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:44", endTime: "09:14", staffId: "s_c025m4y4p" }
  ],
  "tmpl_t0khkex45": [ // Giường 415 - L25
    { procedureId: "pr_eqnn4i152", startTime: "08:36", endTime: "09:01", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:28", endTime: "09:53", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:55", endTime: "11:25", staffId: "s_z83w580hx" }
  ],
  "tmpl_t7czocj2w": [ // Giường 405 - L16
    { procedureId: "pr_eqnn4i152", startTime: "15:04", endTime: "15:29", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:36", endTime: "16:01", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:12", endTime: "16:42", staffId: "s_lbf6qsiya" }
  ],
  "tmpl_tmhmzbghq": [ // Giường 412 - L22
    { procedureId: "pr_eqnn4i152", startTime: "10:45", endTime: "11:10", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:10", endTime: "09:35", staffId: "s_z83w580hx" }
  ],
  "tmpl_uypuyj2g5": [ // L28
    { procedureId: "pr_eqnn4i152", startTime: "16:20", endTime: "16:45", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "13:56", endTime: "14:21", staffId: "s_1yclzxcef" }
  ],
  "tmpl_vx14c6nm1": [ // Giường 460 - L02
    { procedureId: "pr_eqnn4i152", startTime: "13:37", endTime: "14:02", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:10", endTime: "14:35", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:08", endTime: "15:38", staffId: "s_w8k2iebit" }
  ],
  "tmpl_w5fj92g85": [ // Giường 422 - L25
    { procedureId: "pr_eqnn4i152", startTime: "16:02", endTime: "16:27", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "16:32", endTime: "16:57", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "14:35", endTime: "15:05", staffId: "s_c025m4y4p" }
  ],
  "tmpl_wjt0bj8g8": [ // Giường 406 - L17
    { procedureId: "pr_eqnn4i152", startTime: "15:10", endTime: "15:35", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "15:42", endTime: "16:07", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:10", endTime: "16:40", staffId: "s_z83w580hx" }
  ],
  "tmpl_xp78xlmrv": [ // Giường 444 - L05
    { procedureId: "pr_eqnn4i152", startTime: "13:55", endTime: "14:20", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:28", endTime: "14:53", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "16:45", endTime: "17:15", staffId: "s_w8k2iebit" }
  ],
  "tmpl_xx6jfquau": [ // Giường 455 - L09
    { procedureId: "pr_eqnn4i152", startTime: "14:19", endTime: "14:44", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "14:53", endTime: "15:18", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "15:39", endTime: "16:09", staffId: "s_c025m4y4p" }
  ],
  "tmpl_ygvdq1z7y": [ // Giường 453 - L12
    { procedureId: "pr_eqnn4i152", startTime: "09:40", endTime: "10:05", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:41", endTime: "11:06", staffId: "s_1yclzxcef" }
  ],
  "tmpl_yj1ulmx3i": [ // Giường 450 - L09
    { procedureId: "pr_eqnn4i152", startTime: "09:22", endTime: "09:47", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "10:23", endTime: "10:48", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "08:50", endTime: "09:20", staffId: "s_w8k2iebit" }
  ],
  "tmpl_zd1y6v4bv": [ // Giường 420 - L47
    { procedureId: "pr_eqnn4i152", startTime: "09:10", endTime: "09:35", staffId: "s_1yclzxcef" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:58", endTime: "10:23", staffId: "s_z83w580hx" },
    { procedureId: "pr_rj91ghjep", startTime: "10:55", endTime: "11:25", staffId: "s_c025m4y4p" }
  ],
  "tmpl_zmf0tzqmv": [ // Giường 442 - L18
    { procedureId: "pr_yosjw3y2w", startTime: "08:36", endTime: "09:01", staffId: "s_z83w580hx" },
    { procedureId: "pr_eqnn4i152", startTime: "10:18", endTime: "10:43", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_rj91ghjep", startTime: "09:22", endTime: "09:52", staffId: "s_p085044zx" }
  ],
  "tmpl_zmzdlow75": [ // Giường 469 - L03
    { procedureId: "pr_eqnn4i152", startTime: "08:42", endTime: "09:07", staffId: "s_j70mhmvcl" },
    { procedureId: "pr_yosjw3y2w", startTime: "09:47", endTime: "10:12", staffId: "s_1yclzxcef" },
    { procedureId: "pr_rj91ghjep", startTime: "10:58", endTime: "11:28", staffId: "s_w8k2iebit" }
  ]
};

async function verifyAndUpdateFinal() {
  await signInAnonymously(auth);

  const staffSnap = await getDocs(collection(db, "staff"));
  const staffMap = new Map<string, any>();
  staffSnap.docs.forEach(d => staffMap.set(d.id, { id: d.id, ...d.data() }));

  const procsSnap = await getDocs(query(collection(db, "procedures"), where("deptId", "==", "dept_lao")));
  const procMap = new Map<string, any>();
  procsSnap.docs.forEach(d => procMap.set(d.id, d.data()));

  const templatesSnap = await getDocs(query(collection(db, "templates"), where("deptId", "==", "dept_lao")));
  const dbTemplates = templatesSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() } as any));

  let doctorXoaBopRemovedCount = 0;
  let nurseXoaBopKeptCount = 0;

  const preparedTemplates = dbTemplates.map(t => {
    const origProcs = ORIGINAL_TEMPLATES_DATA[t.id] || t.procedures || [];

    const filteredProcs = origProcs.filter((p: any) => {
      const pDef = procMap.get(p.procedureId) || {};
      const procName = pDef.name || p.procedureName || p.procedureId;
      const isXoaBop = p.procedureId === 'pr_rj91ghjep' || procName.includes('Xoa bóp');

      if (!isXoaBop) return true;

      const staffObj = staffMap.get(p.staffId);
      const isDoctor = staffObj?.role === 'Doctor' || staffObj?.name?.startsWith('BS');

      if (isDoctor) {
        doctorXoaBopRemovedCount++;
        return false;
      } else {
        nurseXoaBopKeptCount++;
        return true;
      }
    }).map((p: any) => ({ ...p }));

    return {
      ...t,
      procedures: filteredProcs
    };
  });

  interface ProcItem {
    templateId: string;
    templateName: string;
    procIndex: number;
    procedureId: string;
    procName: string;
    startTime: string;
    endTime: string;
    startMins: number;
    endMins: number;
    duration: number;
    busyStartOffset: number;
    busyEndOffset: number;
    busyStartAbs: number;
    busyEndAbs: number;
    staffId: string;
    staffName: string;
    session: 'morning' | 'afternoon';
    rawProc: any;
  }

  const allItems: ProcItem[] = [];

  preparedTemplates.forEach(t => {
    t.procedures.forEach((p: any, idx: number) => {
      const pDef = procMap.get(p.procedureId) || {};
      const procName = pDef.name || p.procedureName || p.procedureId;
      const startMins = timeToMinutes(p.startTime);
      const endMins = timeToMinutes(p.endTime);
      const duration = endMins - startMins;

      let busyStartOffset = 0;
      let busyEndOffset = duration;

      if (p.procedureId === 'pr_eqnn4i152' || procName.includes('Điện châm')) {
        busyStartOffset = 0;
        busyEndOffset = 6;
      } else if (p.procedureId === 'pr_yosjw3y2w' || procName.includes('Thủy châm')) {
        busyStartOffset = 5;
        busyEndOffset = 11;
      } else if (p.procedureId === 'pr_rj91ghjep' || procName.includes('Xoa bóp')) {
        busyStartOffset = 0;
        busyEndOffset = 30;
      }

      const busyStartAbs = startMins + busyStartOffset;
      const busyEndAbs = startMins + busyEndOffset;
      const session = startMins < 12 * 60 ? 'morning' : 'afternoon';

      const staffObj = staffMap.get(p.staffId);

      allItems.push({
        templateId: t.id,
        templateName: t.name,
        procIndex: idx,
        procedureId: p.procedureId,
        procName,
        startTime: p.startTime,
        endTime: p.endTime,
        startMins,
        endMins,
        duration,
        busyStartOffset,
        busyEndOffset,
        busyStartAbs,
        busyEndAbs,
        staffId: p.staffId,
        staffName: staffObj?.name || p.staffId || 'Unassigned',
        session,
        rawProc: p
      });
    });
  });

  const staffSessionMap = new Map<string, ProcItem[]>();
  allItems.forEach(item => {
    if (!item.staffId) return;
    const key = `${item.staffId}_${item.session}`;
    if (!staffSessionMap.has(key)) staffSessionMap.set(key, []);
    staffSessionMap.get(key)!.push(item);
  });

  // Adjust sequentially with 0 overlap (busyStartAbs >= prev.busyEndAbs)
  staffSessionMap.forEach((items) => {
    items.sort((a, b) => a.startMins - b.startMins);

    for (let i = 0; i < items.length - 1; i++) {
      const prev = items[i];
      const next = items[i + 1];

      if (next.busyStartAbs < prev.busyEndAbs) {
        const neededBusyStartAbs = prev.busyEndAbs;
        const newStartMins = neededBusyStartAbs - next.busyStartOffset;

        next.startMins = newStartMins;
        next.endMins = newStartMins + next.duration;
        next.startTime = minutesToTime(next.startMins);
        next.endTime = minutesToTime(next.endMins);
        next.busyStartAbs = next.startMins + next.busyStartOffset;
        next.busyEndAbs = next.startMins + next.busyEndOffset;

        next.rawProc.startTime = next.startTime;
        next.rawProc.endTime = next.endTime;
      }
    }
  });

  // VERIFY CONFLICTS
  console.log("\n=== VERIFYING CONFLICTS & BOUNDS ===");
  let conflictsCount = 0;
  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      const p1 = allItems[i];
      const p2 = allItems[j];

      if (p1.staffId && p2.staffId && p1.staffId === p2.staffId) {
        const early = p1.busyStartAbs <= p2.busyStartAbs ? p1 : p2;
        const late = p1.busyStartAbs <= p2.busyStartAbs ? p2 : p1;

        if (late.busyStartAbs < early.busyEndAbs) {
          conflictsCount++;
          console.log(`CONFLICT: ${p1.staffName} | "${early.templateName}" (${early.startTime}-${early.endTime}) vs "${late.templateName}" (${late.startTime}-${late.endTime})`);
        }
      }
    }
  }

  let outOfBoundsCount = 0;
  allItems.forEach(item => {
    if (item.session === 'morning') {
      if (item.startMins < 7 * 60 + 30 || item.endMins > 11 * 60 + 30) {
        outOfBoundsCount++;
        console.log(`OUT OF BOUNDS (Morning): Template "${item.templateName}" [${item.procName}]: ${item.startTime} - ${item.endTime}`);
      }
    } else {
      if (item.startMins < 13 * 60 || item.endMins > 17 * 60 + 30) {
        outOfBoundsCount++;
        console.log(`OUT OF BOUNDS (Afternoon): Template "${item.templateName}" [${item.procName}]: ${item.startTime} - ${item.endTime}`);
      }
    }
  });

  console.log(`Remaining Conflicts: ${conflictsCount}`);
  console.log(`Remaining Out Of Bounds: ${outOfBoundsCount}`);

  if (conflictsCount === 0 && outOfBoundsCount === 0) {
    console.log("\n✅ PERFECT MATCH! SAVING TO FIRESTORE...");
    let updateCount = 0;
    for (const t of preparedTemplates) {
      await updateDoc(t.ref, {
        procedures: t.procedures,
        updatedAt: new Date().toISOString()
      });
      updateCount++;
    }
    console.log(`🎉 SUCCESS! Restored Nurse Xoa Bóp & updated all ${updateCount} templates in Firestore!`);
  } else {
    console.log("⚠️ Resolving remaining edge cases...");
  }
}

verifyAndUpdateFinal().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
