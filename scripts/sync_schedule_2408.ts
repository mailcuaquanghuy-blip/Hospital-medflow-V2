import { createClient } from '@supabase/supabase-js';
import { timeStringToMinutes, checkConflict, getLocalDateString } from '../utils/timeUtils';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';

const SUPABASE_URL = 'https://chavuvjjrimdeomjexej.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvRaw = `LÙ THỊ MÔNG,77,Điện châm,14:41:00,15:06:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN ĐỨC MẠNH,55,Điện châm,9:54:00,10:19:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
ĐÀM THỊ MAI,75,Điện châm,10:50:00,11:15:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LA VĂN CHUYÊN,61,Điện châm,8:44:00,9:09:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
LƯỜNG VĂN HÙNG,72,Điện châm,9:12:00,9:37:00,Cầm Thị Uyên,Nguyễn Quang Huy,Hoàng Thu Hương
ĐẶNG THỊ THUNG,76,Điện châm,8:51:00,9:16:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
SA THỊ XÈN,71,Điện châm,15:37:00,16:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ LUYÊN,60,Điện châm,8:44:00,9:09:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ PHƯƠNG,51,Điện châm,8:37:00,9:02:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
ĐINH THỊ KHUẤN,65,Điện châm,14:48:00,15:13:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ GÁI,76,Điện châm,10:01:00,10:26:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ XIÊM,96,Điện châm,15:09:00,15:34:00,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Quàng Văn Hình
NGUYỄN THỊ LỊCH,72,Điện châm,10:43:00,11:08:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN THÂN,63,Điện châm,9:12:00,9:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ THƯƠNG,75,Điện châm,9:05:00,9:30:00,Cầm Thị Uyên,Nguyễn Quang Huy,Hoàng Thu Hương
LÒ THỊ MẮN,61,Điện châm,15:23:00,15:48:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LƯU THỊ BÌNH,74,Điện châm,8:31:00,8:56:00,Vũ Thị Hương Lan,Nguyễn Quang Huy,Quàng Văn Hình
ĐINH VĂN THANH,67,Điện châm,13:45:00,14:10:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HÀ NGỌC DIÊNG,64,Điện châm,16:54:00,17:19:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG VĂN ÂN,67,Điện châm,8:38:00,9:03:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
HOÀNG THỊ LUN,64,Điện châm,16:47:00,17:12:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN NHÉ,67,Điện châm,14:34:00,14:59:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ PHƯỢNG,62,Điện châm,10:22:00,10:47:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
PHẠM VIẾT CẬN,91,Điện châm,13:52:00,14:17:00,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Hoàng Thu Hương
LÒ VĂN ĐÔI,69,Điện châm,10:08:00,10:33:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HOÀNG THỊ CHAI,57,Điện châm,10:15:00,10:40:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ ÓN,76,Điện châm,15:16:00,15:41:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ MAI,48,Điện châm,9:05:00,9:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG VĂN TIÊN,60,Điện châm,8:37:00,9:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ PHÓNG,59,Điện châm,8:58:00,9:23:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
ĐÈO THỊ TOẢN,45,Điện châm,14:55:00,15:20:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ HÔM,76,Điện châm,14:06:00,14:31:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ ĐỊA,80,Điện châm,15:02:00,15:27:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ SAM,62,Điện châm,16:12:00,16:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG VĂN THÁI,64,Điện châm,16:05:00,16:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VŨ THỊ KHƯƠNG,78,Điện châm,10:57:00,11:22:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG THỊ PHỎNG,52,Điện châm,9:40:00,10:05:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LƯỜNG THỊ CHỎI,66,Điện châm,9:47:00,10:12:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÙ VĂN THÀNH,65,Điện châm,9:19:00,9:44:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ HỒNG,55,Điện châm,16:26:00,16:51:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ TIẾN,65,Điện châm,13:59:00,14:24:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
CÀ THỊ ĐOAN,66,Điện châm,13:38:00,14:03:00,Nguyễn Thị Huyền Trang,Hoàng Thu Hương,Quàng Văn Hình
NGUYỄN THỊ CƯỜNG,80,Điện châm,13:31:00,13:56:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Nguyễn Quang Huy
VÌ THỊ ĐU,62,Điện châm,15:30:00,15:55:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Nguyễn Quang Huy
LÙ THỊ MÔNG,77,Thuỷ châm,13:45:00,14:10:00,Cầm Thị Uyên,Nguyễn Quang Huy,
NGUYỄN ĐỨC MẠNH,55,Thuỷ châm,10:29:00,10:54:00,Cầm Thị Uyên,Nguyễn Quang Huy,
ĐÀM THỊ MAI,75,Thuỷ châm,10:22:00,10:47:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LA VĂN CHUYÊN,61,Thuỷ châm,10:43:00,11:08:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LƯỜNG VĂN HÙNG,72,Thuỷ châm,8:44:00,9:09:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
ĐẶNG THỊ THUNG,76,Thuỷ châm,9:40:00,10:05:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
SA THỊ XÈN,71,Thuỷ châm,15:09:00,15:34:00,Cầm Thị Uyên,Hoàng Thu Hương,
TRẦN THỊ LUYÊN,60,Thuỷ châm,9:33:00,9:58:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
LÒ THỊ PHƯƠNG,51,Thuỷ châm,9:05:00,9:30:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
ĐINH THỊ KHUẤN,65,Thuỷ châm,15:16:00,15:41:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ GÁI,76,Thuỷ châm,8:16:00,8:41:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ XIÊM,96,Thuỷ châm,15:37:00,16:02:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ LỊCH,72,Thuỷ châm,10:15:00,10:40:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ VĂN THÂN,63,Thuỷ châm,10:01:00,10:26:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÒ THỊ THƯƠNG,75,Thuỷ châm,10:08:00,10:33:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ MẮN,61,Thuỷ châm,14:55:00,15:20:00,Cầm Thị Uyên,Hoàng Thu Hương,
ĐINH VĂN THANH,67,Thuỷ châm,14:11:00,14:36:00,Cầm Thị Uyên,Hoàng Thu Hương,
HÀ NGỌC DIÊNG,64,Thuỷ châm,13:52:00,14:17:00,Cầm Thị Uyên,Hoàng Thu Hương,
HOÀNG THỊ LUN,64,Thuỷ châm,16:05:00,16:30:00,Cầm Thị Uyên,Hoàng Thu Hương,
LÒ VĂN NHÉ,67,Thuỷ châm,13:59:00,14:24:00,Cầm Thị Uyên,Hoàng Thu Hương,
VÌ THỊ PHƯỢNG,62,Thuỷ châm,9:54:00,10:19:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
PHẠM VIẾT CẬN,91,Thuỷ châm,14:18:00,14:43:00,Cầm Thị Uyên,Hoàng Thu Hương,
LÒ VĂN ĐÔI,69,Thuỷ châm,10:36:00,11:01:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
HOÀNG THỊ CHAI,57,Thuỷ châm,9:47:00,10:12:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ ÓN,76,Thuỷ châm,14:48:00,15:13:00,Cầm Thị Uyên,Hoàng Thu Hương,
TRẦN THỊ MAI,48,Thuỷ châm,8:37:00,9:02:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG VĂN TIÊN,60,Thuỷ châm,10:50:00,11:15:00,Cầm Thị Uyên,Hoàng Thu Hương,
QUÀNG THỊ PHÓNG,59,Thuỷ châm,9:26:00,9:51:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
ĐÈO THỊ TOẢN,45,Thuỷ châm,13:38:00,14:03:00,Cầm Thị Uyên,Nguyễn Quang Huy,
VÌ THỊ HÔM,76,Thuỷ châm,15:51:00,16:16:00,Cầm Thị Uyên,Hoàng Thu Hương,
QUÀNG THỊ ĐỊA,80,Thuỷ châm,15:30:00,15:55:00,Cầm Thị Uyên,Hoàng Thu Hương,
LÒ THỊ SAM,62,Thuỷ châm,15:44:00,16:09:00,Cầm Thị Uyên,Hoàng Thu Hương,
TÒNG VĂN THÁI,64,Thuỷ châm,16:54:00,17:19:00,Cầm Thị Uyên,Hoàng Thu Hương,
VŨ THỊ KHƯƠNG,78,Thuỷ châm,10:08:00,10:33:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TÒNG THỊ PHỎNG,52,Thuỷ châm,10:15:00,10:40:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LƯỜNG THỊ CHỎI,66,Thuỷ châm,9:12:00,9:37:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÙ VĂN THÀNH,65,Thuỷ châm,10:29:00,10:54:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ HỒNG,55,Thuỷ châm,17:01:00,17:26:00,Cầm Thị Uyên,Hoàng Thu Hương,
VÌ THỊ TIẾN,65,Thuỷ châm,14:27:00,14:52:00,Cầm Thị Uyên,Hoàng Thu Hương,
CÀ THỊ ĐOAN,66,Thuỷ châm,15:23:00,15:48:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ CƯỜNG,80,Thuỷ châm,15:02:00,15:27:00,Cầm Thị Uyên,Hoàng Thu Hương,
VÌ THỊ ĐU,62,Thuỷ châm,15:56:00,16:21:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
LÙ THỊ MÔNG,77,Xoa bóp,16:11:00,16:41:00,Vũ Thúy Hà,,
NGUYỄN ĐỨC MẠNH,55,Xoa bóp,7:47:00,8:17:00,Vũ Thúy Hà,,
ĐÀM THỊ MAI,75,Xoa bóp,9:16:00,9:46:00,Vũ Thị Hương Lan,,
LƯỜNG VĂN HÙNG,72,Xoa bóp,10:58:00,11:28:00,Vũ Thúy Hà,,
ĐẶNG THỊ THUNG,76,Xoa bóp,8:19:00,8:49:00,Bùi Thị Thu Hà,,
SA THỊ XÈN,71,Xoa bóp,14:34:00,15:04:00,Vũ Thúy Hà,,
TRẦN THỊ LUYÊN,60,Xoa bóp,10:57:00,11:27:00,Bùi Thị Thu Hà,,
ĐINH THỊ KHUẤN,65,Xoa bóp,14:03:00,14:33:00,Vũ Thúy Hà,,
NGUYỄN THỊ GÁI,76,Xoa bóp,10:27:00,10:57:00,Vũ Thị Hương Lan,,
NGUYỄN THỊ LỊCH,72,Xoa bóp,8:45:00,9:15:00,Vũ Thị Hương Lan,,
LÒ THỊ THƯƠNG,75,Xoa bóp,10:37:00,11:07:00,Cà Thị Oanh,,
LÒ THỊ MẮN,61,Xoa bóp,16:10:00,16:40:00,Nguyễn Tùng Lâm,,
LƯU THỊ BÌNH,74,Xoa bóp,9:21:00,9:51:00,Vũ Thúy Hà,,
ĐINH VĂN THANH,67,Xoa bóp,15:40:00,16:10:00,Vũ Thúy Hà,,
HÀ NGỌC DIÊNG,64,Xoa bóp,15:05:00,15:35:00,Vũ Thúy Hà,,
QUÀNG VĂN ÂN,67,Xoa bóp,7:48:00,8:18:00,Bùi Thị Thu Hà,,
HOÀNG THỊ LUN,64,Xoa bóp,13:32:00,14:02:00,Vũ Thúy Hà,,
LÒ VĂN NHÉ,67,Xoa bóp,15:00:00,15:30:00,Nguyễn Tùng Lâm,,
VÌ THỊ PHƯỢNG,62,Xoa bóp,8:18:00,8:48:00,Vũ Thúy Hà,,
LÒ VĂN ĐÔI,69,Xoa bóp,8:50:00,9:20:00,Vũ Thúy Hà,,
HOÀNG THỊ CHAI,57,Xoa bóp,8:50:00,9:20:00,Bùi Thị Thu Hà,,
LÒ THỊ ÓN,76,Xoa bóp,13:31:00,14:01:00,Nguyễn Tùng Lâm,,
TRẦN THỊ MAI,48,Xoa bóp,9:31:00,10:01:00,Bùi Thị Thu Hà,,
QUÀNG VĂN TIÊN,60,Xoa bóp,10:02:00,10:32:00,Bùi Thị Thu Hà,,
QUÀNG THỊ PHÓNG,59,Xoa bóp,10:00:00,10:30:00,Cà Thị Oanh,,
ĐÈO THỊ TOẢN,45,Xoa bóp,14:04:00,14:34:00,Vũ Thị Hương Lan,,
VÌ THỊ HÔM,76,Xoa bóp,15:15:00,15:45:00,Vũ Thị Hương Lan,,
QUÀNG THỊ ĐỊA,80,Xoa bóp,15:56:00,16:26:00,Vũ Thị Hương Lan,,
LÒ THỊ SAM,62,Xoa bóp,16:43:00,17:13:00,Nguyễn Tùng Lâm,,
TÒNG VĂN THÁI,64,Xoa bóp,15:31:00,16:01:00,Nguyễn Tùng Lâm,,
TÒNG THỊ PHỎNG,52,Xoa bóp,8:27:00,8:57:00,Cà Thị Oanh,,
LƯỜNG THỊ CHỎI,66,Xoa bóp,10:26:00,10:56:00,Vũ Thúy Hà,,
LÙ VĂN THÀNH,65,Xoa bóp,9:54:00,10:24:00,Vũ Thúy Hà,,
QUÀNG THỊ HỒNG,55,Xoa bóp,14:03:00,14:33:00,Nguyễn Tùng Lâm,,
VÌ THỊ TIẾN,65,Xoa bóp,16:45:00,17:15:00,Vũ Thúy Hà,,
CÀ THỊ ĐOAN,66,Xoa bóp,10:58:00,11:28:00,Vũ Thị Hương Lan,,
NGUYỄN THỊ CƯỜNG,80,Xoa bóp,10:48:00,11:18:00,Nguyễn Tùng Lâm,,
VÌ THỊ ĐU,62,Xoa bóp,16:27:00,16:57:00,Vũ Thị Hương Lan,`;

const norm = (str: string) =>
  (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ');

async function runSync2408(dryRun = false) {
  const TARGET_DATE = '2026-08-24';
  console.log(`--- RECONCILIATION AND SYNC FOR ${TARGET_DATE} (dryRun: ${dryRun}) ---`);

  // 1. Fetch current patients, staff, procedures from Supabase
  const { data: allPatientsRows, error: patErr } = await supabase.from('patients').select('*');
  if (patErr) throw patErr;
  const allPatients = (allPatientsRows || []).map(r => r.data || r);

  const { data: allStaffRows, error: staffErr } = await supabase.from('staff').select('*');
  if (staffErr) throw staffErr;
  const allStaff = (allStaffRows || []).map(r => r.data || r);

  const { data: allProcsRows, error: procErr } = await supabase.from('procedures').select('*');
  if (procErr) throw procErr;
  const allProcs = (allProcsRows || []).map(r => r.data || r);

  console.log(`Loaded ${allPatients.length} patients, ${allStaff.length} staff, ${allProcs.length} procedures.`);

  // Map active patients in dept_lao on 2026-08-24
  const patientMap = new Map<string, any>();
  const activePatients24 = allPatients.filter(p => {
    const adm = getLocalDateString(p.admissionDate);
    const dis = getLocalDateString(p.dischargeDate);
    if (adm && adm > TARGET_DATE) return false;
    if (dis && dis < TARGET_DATE) return false;
    return true;
  });

  // Prefer dept_lao active patient
  for (const p of activePatients24.filter(p => p.admittedByDeptId === 'dept_lao')) {
    patientMap.set(norm(p.name), p);
  }
  // Then any active patient
  for (const p of activePatients24) {
    if (!patientMap.has(norm(p.name))) {
      patientMap.set(norm(p.name), p);
    }
  }

  // Map staff by name
  const staffMap = new Map<string, any>();
  for (const s of allStaff) {
    if (!staffMap.has(norm(s.name)) || s.role === 'Doctor') {
      staffMap.set(norm(s.name), s);
    }
  }

  const formatTime = (t: string) => {
    const parts = t.trim().split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  };

  const lines = csvRaw.trim().split('\n');
  console.log(`Parsing ${lines.length} lines from CSV...`);

  // Machine assignment for Điện châm: L-01 to L-50
  const availableMachines = Array.from({ length: 50 }, (_, i) => `L-${String(i + 1).padStart(2, '0')}`);
  const machineBookings: Array<{ machineId: string; startMin: number; endMin: number }> = [];

  const newAppointments: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const [patName, age, procName, start, end, mainStaff, asst1, asst2] = lines[i].split(',');
    const p = patientMap.get(norm(patName));
    if (!p) {
      throw new Error(`Patient not found: ${patName}`);
    }

    const sMain = staffMap.get(norm(mainStaff));
    if (!sMain) {
      throw new Error(`Main staff not found: ${mainStaff}`);
    }

    const sAsst1 = asst1 && asst1.trim() ? staffMap.get(norm(asst1)) : null;
    const sAsst2 = asst2 && asst2.trim() ? staffMap.get(norm(asst2)) : null;

    const startTime = formatTime(start);
    const endTime = formatTime(end);
    const sMin = timeStringToMinutes(startTime);
    const eMin = timeStringToMinutes(endTime);

    let procedureId = 'pr_eqnn4i152'; // Điện châm
    let selectedDurationOptionId: string | null = 'opt_default25';
    let assignedMachineId: string | null = null;
    let mainBusyStart = 0;
    let mainBusyEnd = 6;
    let asst1BusyStart = 5;
    let asst1BusyEnd = 10;
    let asst2BusyStart = 24;
    let asst2BusyEnd = 25;

    const pType = norm(procName);
    if (pType === 'điện châm') {
      procedureId = 'pr_eqnn4i152';
      selectedDurationOptionId = 'opt_default25';
      mainBusyStart = 0;
      mainBusyEnd = 6;
      asst1BusyStart = 5;
      asst1BusyEnd = 10;
      asst2BusyStart = 24;
      asst2BusyEnd = 25;

      // Assign first available machine without time overlap
      for (const mId of availableMachines) {
        const hasOverlap = machineBookings.some(
          b => b.machineId === mId && !(eMin <= b.startMin || sMin >= b.endMin)
        );
        if (!hasOverlap) {
          assignedMachineId = mId;
          machineBookings.push({ machineId: mId, startMin: sMin, endMin: eMin });
          break;
        }
      }
    } else if (pType === 'thuỷ châm' || pType === 'thủy châm') {
      procedureId = 'pr_yosjw3y2w';
      selectedDurationOptionId = 'opt_sfh8r5rb9';
      mainBusyStart = 6;
      mainBusyEnd = 11;
      asst1BusyStart = 0;
      asst1BusyEnd = 5;
      asst2BusyStart = 0;
      asst2BusyEnd = 0;
      assignedMachineId = null;
    } else if (pType === 'xoa bóp') {
      procedureId = 'pr_rj91ghjep';
      selectedDurationOptionId = null;
      mainBusyStart = 0;
      mainBusyEnd = 30;
      asst1BusyStart = 0;
      asst1BusyEnd = 0;
      asst2BusyStart = 0;
      asst2BusyEnd = 0;
      assignedMachineId = null;
    } else {
      throw new Error(`Unknown procedure: ${procName}`);
    }

    const apptId = `appt_20260824_${String(i + 1).padStart(3, '0')}`;

    const apptData = {
      id: apptId,
      date: TARGET_DATE,
      deptId: 'dept_lao',
      status: 'PENDING',
      startTime,
      endTime,
      patientId: p.id,
      procedureId,
      staffId: sMain.id,
      assistant1Id: sAsst1 ? sAsst1.id : null,
      assistant2Id: sAsst2 ? sAsst2.id : null,
      assignedMachineId,
      selectedDurationOptionId,
      mainBusyStart,
      mainBusyEnd,
      asst1BusyStart,
      asst1BusyEnd,
      asst2BusyStart,
      asst2BusyEnd,
      restMinutes: 0,
      machineShiftId: null,
      conflictDetails: []
    };

    newAppointments.push(apptData);
  }

  console.log(`Generated ${newAppointments.length} appointments from CSV.`);
  const usedMachines = [...new Set(machineBookings.map(b => b.machineId))].sort();
  console.log(`Machine utilization: ${usedMachines.length} machines (${usedMachines.join(', ')})`);

  // 2. Preserve existing clinical examination records (Khám vào viện / Khám ra viện)
  const { data: existingAppts, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', TARGET_DATE);
  if (fetchErr) throw fetchErr;

  const existingItems = (existingAppts || []).map(r => r.data || r);
  const existingClinicalExams = existingItems.filter(
    a => a.procedureId === 'pr_fm25wiv60' || a.procedureId === 'pr_fdmxn9vp6'
  );
  console.log(`Preserving ${existingClinicalExams.length} clinical examination records.`);

  const finalAppointments = [...existingClinicalExams, ...newAppointments];
  console.log(`Total final appointments on 2026-08-24: ${finalAppointments.length}`);

  // Test conflicts on all final appointments
  let conflictCount = 0;
  for (const a of finalAppointments) {
    const res = checkConflict(
      a.startTime,
      a.endTime,
      a.date,
      a.staffId,
      a.patientId,
      finalAppointments,
      allStaff,
      allProcs,
      [],
      allPatients,
      a.procedureId,
      a.id,
      a.assistant1Id,
      a.assistant2Id,
      a
    );
    if (res.hasConflict) {
      conflictCount++;
      const pat = allPatients.find(p => p.id === a.patientId);
      console.log(`Conflict on appt ${a.id} (${pat?.name} ${a.startTime}-${a.endTime}):`, res.conflictDetails);
    }
  }
  console.log(`Conflict check summary: ${conflictCount} conflicts detected out of ${finalAppointments.length} appointments.`);

  if (dryRun) {
    console.log('DRY RUN ONLY - not writing to databases.');
    return;
  }

  // 3. Clear existing appointments for 2026-08-24 in Supabase
  const existingIds = existingAppts ? existingAppts.map(r => r.id) : [];
  console.log(`Found ${existingIds.length} existing appointments in Supabase to clear.`);
  if (existingIds.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
      const chunk = existingIds.slice(i, i + CHUNK_SIZE);
      const { error: delErr } = await supabase.from('appointments').delete().in('id', chunk);
      if (delErr) {
        console.error(`Error deleting chunk ${i}:`, delErr);
      }
    }
    console.log(`Successfully cleared old appointments in Supabase.`);
  }

  // 4. Insert final appointments into Supabase
  const upsertRows = finalAppointments.map(a => ({
    id: a.id,
    data: a
  }));

  const CHUNK_SIZE = 40;
  for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
    const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await supabase.from('appointments').upsert(chunk);
    if (insErr) {
      console.error(`Error inserting chunk ${i}:`, insErr);
      throw insErr;
    }
  }
  console.log(`Successfully inserted all ${finalAppointments.length} appointments for 2026-08-24 into Supabase!`);

  // 5. Also sync to Firestore
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
    const fApp = initializeApp(firebaseConfig, 'syncApp24');
    const fDb = initializeFirestore(fApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
    const fAuth = getAuth(fApp);
    await signInAnonymously(fAuth);

    // Delete existing on 24/8 in Firestore
    const fsSnap = await getDocs(query(collection(fDb, 'appointments'), where('date', '==', TARGET_DATE)));
    console.log(`Found ${fsSnap.size} existing appointments in Firestore for ${TARGET_DATE}`);
    if (fsSnap.size > 0) {
      const batch = writeBatch(fDb);
      fsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log('Cleared Firestore 2026-08-24 appointments.');
    }

    // Insert into Firestore in batches of 20
    for (let i = 0; i < finalAppointments.length; i += 20) {
      const chunk = finalAppointments.slice(i, i + 20);
      const batch = writeBatch(fDb);
      for (const a of chunk) {
        batch.set(doc(fDb, 'appointments', a.id), a);
      }
      await batch.commit();
    }
    console.log(`Successfully synced all ${finalAppointments.length} appointments to Firestore!`);
  } catch (fsErr) {
    console.warn('Firestore sync note:', (fsErr as any).message);
  }

  // 6. Verification
  const { data: verifyRows, error: vErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', TARGET_DATE);
  if (vErr) throw vErr;
  console.log(`Verification: Total appointments on 2026-08-24 now in Supabase = ${verifyRows?.length}`);

  console.log(`--- FINISHED SYNC FOR 2026-08-24 ---`);
  process.exit(0);
}

const isDryRun = process.argv.includes('--dry-run');
runSync2408(isDryRun).catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
