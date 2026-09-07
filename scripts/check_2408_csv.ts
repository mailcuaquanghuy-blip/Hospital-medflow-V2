import { createClient } from '@supabase/supabase-js';
import { timeStringToMinutes, checkConflict, getLocalDateString } from '../utils/timeUtils';

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

const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFC').replace(/\s+/g, ' ');

async function check2408() {
  const TARGET_DATE = '2026-08-24';
  console.log(`Checking matching for ${TARGET_DATE}...`);

  const { data: pRows } = await supabase.from('patients').select('*');
  const allPatients = (pRows || []).map(r => r.data || r);

  const { data: sRows } = await supabase.from('staff').select('*');
  const allStaff = (sRows || []).map(r => r.data || r);

  const { data: procRows } = await supabase.from('procedures').select('*');
  const allProcs = (procRows || []).map(r => r.data || r);

  console.log(`Database has: ${allPatients.length} patients, ${allStaff.length} staff, ${allProcs.length} procs`);

  // Active patients on 2026-08-24
  const activePatients = allPatients.filter(p => {
    const adm = getLocalDateString(p.admissionDate);
    const dis = getLocalDateString(p.dischargeDate);
    if (adm && adm > TARGET_DATE) return false;
    if (dis && dis < TARGET_DATE) return false;
    return true;
  });

  const laoActive = activePatients.filter(p => p.admittedByDeptId === 'dept_lao');
  console.log(`Active patients in hospital on ${TARGET_DATE}: ${activePatients.length}, in dept_lao: ${laoActive.length}`);

  const lines = csvRaw.trim().split('\n');
  console.log('Total lines in CSV:', lines.length);

  const pNames = [...new Set(lines.map(l => l.split(',')[0].trim()))];
  console.log('Unique patients in CSV:', pNames.length);

  const missingPatients: string[] = [];
  const patientMatchMap = new Map<string, any>();

  for (const name of pNames) {
    const pLao = laoActive.find(p => norm(p.name) === norm(name));
    if (pLao) {
      patientMatchMap.set(norm(name), pLao);
    } else {
      const pAny = activePatients.find(p => norm(p.name) === norm(name));
      if (pAny) {
        patientMatchMap.set(norm(name), pAny);
      } else {
        // Find if in allPatients
        const inAll = allPatients.filter(p => norm(p.name) === norm(name));
        missingPatients.push(`${name} (found ${inAll.length} in DB: ${inAll.map(x => `${x.id} adm:${x.admissionDate?.slice(0,10)} dis:${x.dischargeDate?.slice(0,10)} dept:${x.admittedByDeptId}`).join(' | ')})`);
      }
    }
  }

  console.log('Missing patients:', missingPatients);
  console.log(`Matched patients: ${patientMatchMap.size} / ${pNames.length}`);

  // Check staff names
  const allStaffNamesInCsv = new Set<string>();
  lines.forEach(l => {
    const [, , , , , main, a1, a2] = l.split(',');
    if (main && main.trim()) allStaffNamesInCsv.add(main.trim());
    if (a1 && a1.trim()) allStaffNamesInCsv.add(a1.trim());
    if (a2 && a2.trim()) allStaffNamesInCsv.add(a2.trim());
  });

  console.log('Unique staff in CSV:', [...allStaffNamesInCsv]);
  const missingStaff: string[] = [];
  allStaffNamesInCsv.forEach(sName => {
    const s = allStaff.find(st => norm(st.name) === norm(sName));
    if (!s) missingStaff.push(sName);
  });
  console.log('Missing staff:', missingStaff);
}

check2408();
