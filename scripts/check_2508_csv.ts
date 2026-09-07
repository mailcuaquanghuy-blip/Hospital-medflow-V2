import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://chavuvjjrimdeomjexej.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvRaw = `LÙ THỊ MÔNG,77,Điện châm,14:41:00,15:06:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN ĐỨC MẠNH,55,Điện châm,9:54:00,10:19:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
ĐÀM THỊ MAI,75,Điện châm,10:50:00,11:15:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LA VĂN CHUYÊN,61,Điện châm,8:44:00,9:09:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
LƯỜNG VĂN HÙNG,72,Điện châm,8:37:00,9:02:00,Vũ Thị Hương Lan,Nguyễn Quang Huy,Lê Hương Giang
ĐẶNG THỊ THUNG,76,Điện châm,8:51:00,9:16:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
SA THỊ XÈN,71,Điện châm,15:37:00,16:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ LUYÊN,60,Điện châm,8:44:00,9:09:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ PHƯƠNG,51,Điện châm,8:37:00,9:02:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
ĐINH THỊ KHUẤN,65,Điện châm,13:38:00,14:03:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ GÁI,76,Điện châm,9:33:00,9:58:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ XIÊM,96,Điện châm,11:04:00,11:29:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ LỊCH,72,Điện châm,10:43:00,11:08:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ BIỂN,69,Điện châm,10:01:00,10:26:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Hoàng Thu Hương
LÒ VĂN THÂN,63,Điện châm,8:58:00,9:23:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Nguyễn Quang Huy
LÒ THỊ THƯƠNG,75,Điện châm,8:30:00,8:55:00,Vũ Thị Hương Lan,Quàng Văn Hình,Hoàng Thu Hương
LÒ THỊ MẮN,61,Điện châm,8:44:00,9:09:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Nguyễn Quang Huy
ĐINH VĂN THANH,67,Điện châm,8:51:00,9:16:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Nguyễn Quang Huy
HÀ NGỌC DIÊNG,64,Điện châm,14:34:00,14:59:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HOÀNG THỊ LUN,64,Điện châm,16:47:00,17:12:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN NHÉ,67,Điện châm,16:54:00,17:19:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ PHƯỢNG,62,Điện châm,10:29:00,10:54:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
PHẠM VIẾT CẬN,91,Điện châm,13:31:00,13:56:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Hoàng Thu Hương
LÒ VĂN ĐÔI,69,Điện châm,10:08:00,10:33:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HOÀNG THỊ CHAI,57,Điện châm,10:15:00,10:40:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ ÓN,76,Điện châm,15:16:00,15:41:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ MAI,48,Điện châm,9:05:00,9:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG VĂN TIÊN,60,Điện châm,8:37:00,9:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ PHÓNG,59,Điện châm,8:58:00,9:23:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
ĐÈO THỊ TOẢN,45,Điện châm,14:27:00,14:52:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ HÔM,76,Điện châm,14:06:00,14:31:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ ĐỊA,80,Điện châm,15:03:00,15:28:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Hoàng Thu Hương
LÒ THỊ SAM,62,Điện châm,16:12:00,16:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG VĂN THÁI,64,Điện châm,16:05:00,16:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VŨ THỊ KHƯƠNG,78,Điện châm,10:36:00,11:01:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG THỊ PHỎNG,52,Điện châm,9:40:00,10:05:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LƯỜNG THỊ CHỎI,66,Điện châm,9:47:00,10:12:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÙ VĂN THÀNH,65,Điện châm,9:12:00,9:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ HỒNG,55,Điện châm,16:26:00,16:51:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ TIẾN,65,Điện châm,13:59:00,14:24:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
CÀ THỊ ĐOAN,66,Điện châm,13:52:00,14:17:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ CƯỜNG,80,Điện châm,14:13:00,14:38:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ ĐU,62,Điện châm,14:20:00,14:45:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN KIM,54,Điện châm,15:51:00,16:16:00,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Hoàng Thu Hương
TRẦN THỊ TỴ,86,Điện châm,13:45:00,14:10:00,Nguyễn Thị Huyền Trang,Hoàng Thu Hương,Quàng Văn Hình
NGUYỄN THỊ TÌNH,63,Điện châm,15:44:00,16:09:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Nguyễn Quang Huy
LÒ THỊ TÂM,52,Điện châm,15:30:00,15:55:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Nguyễn Quang Huy
NGUYỄN THỊ HỒNG,57,Điện châm,15:23:00,15:48:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Nguyễn Quang Huy
LÙ THỊ MÔNG,77,Thuỷ châm,13:45:00,14:10:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
NGUYỄN ĐỨC MẠNH,55,Thuỷ châm,10:57:00,11:22:00,Cầm Thị Uyên,Nguyễn Quang Huy,
ĐÀM THỊ MAI,75,Thuỷ châm,8:55:00,9:20:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LA VĂN CHUYÊN,61,Thuỷ châm,9:10:00,9:35:00,Cầm Thị Uyên,Nguyễn Quang Huy,
ĐẶNG THỊ THUNG,76,Thuỷ châm,9:40:00,10:05:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
SA THỊ XÈN,71,Thuỷ châm,15:09:00,15:34:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TRẦN THỊ LUYÊN,60,Thuỷ châm,9:33:00,9:58:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
LÒ THỊ PHƯƠNG,51,Thuỷ châm,10:01:00,10:26:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
ĐINH THỊ KHUẤN,65,Thuỷ châm,15:16:00,15:41:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ GÁI,76,Thuỷ châm,8:16:00,8:41:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ XIÊM,96,Thuỷ châm,9:02:00,9:27:00,Cầm Thị Uyên,Nguyễn Quang Huy,
NGUYỄN THỊ LỊCH,72,Thuỷ châm,8:48:00,9:13:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ BIỂN,69,Thuỷ châm,10:43:00,11:08:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
HÀ NGỌC DIÊNG,64,Thuỷ châm,13:52:00,14:17:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
HOÀNG THỊ LUN,64,Thuỷ châm,16:05:00,16:30:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÒ VĂN NHÉ,67,Thuỷ châm,13:59:00,14:24:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
VÌ THỊ PHƯỢNG,62,Thuỷ châm,9:54:00,10:19:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
PHẠM VIẾT CẬN,91,Thuỷ châm,13:57:00,14:22:00,Vũ Thị Hương Lan,Hoàng Thu Hương,
LÒ VĂN ĐÔI,69,Thuỷ châm,10:36:00,11:01:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
HOÀNG THỊ CHAI,57,Thuỷ châm,9:24:00,9:49:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ ÓN,76,Thuỷ châm,14:48:00,15:13:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TRẦN THỊ MAI,48,Thuỷ châm,8:37:00,9:02:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG VĂN TIÊN,60,Thuỷ châm,10:50:00,11:15:00,Cầm Thị Uyên,Hoàng Thu Hương,
QUÀNG THỊ PHÓNG,59,Thuỷ châm,9:47:00,10:12:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
ĐÈO THỊ TOẢN,45,Thuỷ châm,13:38:00,14:03:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
VÌ THỊ HÔM,76,Thuỷ châm,15:51:00,16:16:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ ĐỊA,80,Thuỷ châm,15:30:00,15:55:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÒ THỊ SAM,62,Thuỷ châm,15:44:00,16:09:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TÒNG VĂN THÁI,64,Thuỷ châm,16:54:00,17:19:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
VŨ THỊ KHƯƠNG,78,Thuỷ châm,10:08:00,10:33:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TÒNG THỊ PHỎNG,52,Thuỷ châm,10:15:00,10:40:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LƯỜNG THỊ CHỎI,66,Thuỷ châm,9:12:00,9:37:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÙ VĂN THÀNH,65,Thuỷ châm,10:29:00,10:54:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ HỒNG,55,Thuỷ châm,17:01:00,17:26:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
VÌ THỊ TIẾN,65,Thuỷ châm,14:27:00,14:52:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
CÀ THỊ ĐOAN,66,Thuỷ châm,14:20:00,14:45:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ CƯỜNG,80,Thuỷ châm,14:41:00,15:06:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
VÌ THỊ ĐU,62,Thuỷ châm,13:31:00,13:56:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
LÒ VĂN KIM,54,Thuỷ châm,15:02:00,15:27:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TRẦN THỊ TỴ,86,Thuỷ châm,14:11:00,14:36:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ TÌNH,63,Thuỷ châm,14:55:00,15:20:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÒ THỊ TÂM,52,Thuỷ châm,14:34:00,14:59:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ HỒNG,57,Thuỷ châm,16:11:00,16:36:00,Nguyễn Tùng Lâm,Quàng Văn Hình,
LÙ THỊ MÔNG,77,Xoa bóp,15:38:00,16:08:00,Cà Thị Oanh,,
LƯỜNG VĂN HÙNG,72,Xoa bóp,9:21:00,9:51:00,Bùi Thị Thu Hà,,
ĐẶNG THỊ THUNG,76,Xoa bóp,8:19:00,8:49:00,Bùi Thị Thu Hà,,
SA THỊ XÈN,71,Xoa bóp,14:36:00,15:06:00,Cà Thị Oanh,,
TRẦN THỊ LUYÊN,60,Xoa bóp,10:57:00,11:27:00,Bùi Thị Thu Hà,,
ĐINH THỊ KHUẤN,65,Xoa bóp,14:04:00,14:34:00,Cà Thị Oanh,,
LÒ VĂN THÂN,63,Xoa bóp,10:00:00,10:30:00,Cà Thị Oanh,,
LÒ THỊ THƯƠNG,75,Xoa bóp,10:37:00,11:07:00,Cà Thị Oanh,,
LÒ THỊ MẮN,61,Xoa bóp,9:52:00,10:22:00,Bùi Thị Thu Hà,,
ĐINH VĂN THANH,67,Xoa bóp,10:23:00,10:53:00,Bùi Thị Thu Hà,,
HÀ NGỌC DIÊNG,64,Xoa bóp,15:07:00,15:37:00,Cà Thị Oanh,,
HOÀNG THỊ LUN,64,Xoa bóp,14:09:00,14:39:00,Vũ Thị Hương Lan,,
LÒ VĂN NHÉ,67,Xoa bóp,14:40:00,15:10:00,Vũ Thị Hương Lan,,
VÌ THỊ PHƯỢNG,62,Xoa bóp,8:58:00,9:28:00,Cà Thị Oanh,,
PHẠM VIẾT CẬN,91,Xoa bóp,16:43:00,17:13:00,Cà Thị Oanh,,
HOÀNG THỊ CHAI,57,Xoa bóp,8:50:00,9:20:00,Bùi Thị Thu Hà,,
LÒ THỊ ÓN,76,Xoa bóp,16:12:00,16:42:00,Cà Thị Oanh,,
TRẦN THỊ MAI,48,Xoa bóp,9:31:00,10:01:00,Vũ Thị Hương Lan,,
QUÀNG THỊ PHÓNG,59,Xoa bóp,10:13:00,10:43:00,Vũ Thị Hương Lan,,
ĐÈO THỊ TOẢN,45,Xoa bóp,15:11:00,15:41:00,Vũ Thị Hương Lan,,
VÌ THỊ HÔM,76,Xoa bóp,16:23:00,16:53:00,Nguyễn Tùng Lâm,,
QUÀNG THỊ ĐỊA,80,Xoa bóp,13:32:00,14:02:00,Cà Thị Oanh,,
LÒ THỊ SAM,62,Xoa bóp,16:38:00,17:08:00,Vũ Thị Hương Lan,,
TÒNG THỊ PHỎNG,52,Xoa bóp,8:27:00,8:57:00,Cà Thị Oanh,,
LƯỜNG THỊ CHỎI,66,Xoa bóp,10:44:00,11:14:00,Vũ Thị Hương Lan,,
QUÀNG THỊ HỒNG,55,Xoa bóp,15:42:00,16:12:00,Vũ Thị Hương Lan,`;

const norm = (str: string) =>
  (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ');

async function validateCSV() {
  const { data: allPatientsRows } = await supabase.from('patients').select('*');
  const allPatients = (allPatientsRows || []).map(r => r.data || r);

  const { data: allStaffRows } = await supabase.from('staff').select('*');
  const allStaff = (allStaffRows || []).map(r => r.data || r);

  const { data: allProcsRows } = await supabase.from('procedures').select('*');
  const allProcs = (allProcsRows || []).map(r => r.data || r);

  console.log(`Checking matching for 2026-08-25...`);
  console.log(`Database has: ${allPatients.length} patients, ${allStaff.length} staff, ${allProcs.length} procs`);

  const TARGET_DATE = '2026-08-25';
  const patMap = new Map();
  for (const p of allPatients) {
    patMap.set(norm(p.name), p);
  }

  const staffMap = new Map();
  for (const s of allStaff) {
    if (!staffMap.has(norm(s.name)) || s.role === 'Doctor') {
      staffMap.set(norm(s.name), s);
    }
  }

  const lines = csvRaw.trim().split('\n');
  console.log(`Total lines in CSV: ${lines.length}`);

  const missingPats = new Set<string>();
  const missingStaff = new Set<string>();

  const uniquePatientsInCSV = new Set<string>();
  for (const line of lines) {
    const [pName, age, proc, start, end, mainS, a1, a2] = line.split(',');
    uniquePatientsInCSV.add(pName.trim());
    if (!patMap.has(norm(pName))) {
      missingPats.add(pName.trim());
    }
    if (mainS && !staffMap.has(norm(mainS))) {
      missingStaff.add(mainS.trim());
    }
    if (a1 && a1.trim() && !staffMap.has(norm(a1))) {
      missingStaff.add(a1.trim());
    }
    if (a2 && a2.trim() && !staffMap.has(norm(a2))) {
      missingStaff.add(a2.trim());
    }
  }

  console.log(`Unique patients in CSV: ${uniquePatientsInCSV.size}`);
  console.log('Missing patients:', Array.from(missingPats));
  console.log('Missing staff:', Array.from(missingStaff));

  // Check if any matched patient is discharged before 25/8 or admitted after 25/8
  for (const pName of uniquePatientsInCSV) {
    const p = patMap.get(norm(pName));
    if (p) {
      const adm = (p.admissionDate || '').split('T')[0];
      const dis = (p.dischargeDate || '').split('T')[0];
      if (adm && adm > TARGET_DATE) {
        console.warn(`WARNING: Patient ${p.name} admitted AFTER 25/8: ${adm}`);
      }
      if (dis && dis < TARGET_DATE) {
        console.warn(`WARNING: Patient ${p.name} discharged BEFORE 25/8: ${dis}`);
      }
    }
  }
}

validateCSV();
