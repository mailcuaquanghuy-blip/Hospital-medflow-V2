import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Patient, Staff, Procedure, Appointment, PatientStatus, AppointmentStatus, AttendanceRecord, AttendanceStatus } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

function cleanVN(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Data set 1: Day 13 (June 13)
const day13Csv = `Số giường,Họ và tên,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2
411,Vũ Thị Vân,Điện châm,08:30,08:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
411,Vũ Thị Vân,Thủy châm,09:01,09:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
409,Nguyễn Thị Gái,Điện châm,08:36,09:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
409,Nguyễn Thị Gái,Thủy châm,09:07,09:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
410,Phạm Thị Hải Yến,Điện châm,08:42,09:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
410,Phạm Thị Hải Yến,Thủy châm,09:13,09:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
471,Cầm Thị Thuyết,Điện châm,08:48,09:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
471,Cầm Thị Thuyết,Thủy châm,09:19,09:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
449,Hà Thị Thái,Điện châm,08:54,09:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
449,Hà Thị Thái,Thủy châm,09:25,09:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
421,Lò Thị Hinh,Điện châm,09:00,09:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
421,Lò Thị Hinh,Thủy châm,08:31,08:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
420,Tòng Thị Sương,Điện châm,09:06,09:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
420,Tòng Thị Sương,Thủy châm,08:37,09:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
418,Lò Thị Hiến,Điện châm,09:12,09:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
418,Lò Thị Hiến,Thủy châm,08:43,09:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
415,Lò Thị Liến,Điện châm,09:18,09:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
415,Lò Thị Liến,Thủy châm,08:49,09:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
419,Lò Thị Xem,Điện châm,09:24,09:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
419,Lò Thị Xem,Thủy châm,08:55,09:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
416,Lò Thị Chơm,Điện châm,09:30,09:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
416,Lò Thị Chơm,Thủy châm,10:01,10:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
439,Nguyễn Thị Huệ,Điện châm,09:36,10:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
439,Nguyễn Thị Huệ,Thủy châm,10:07,10:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
434,Vì Văn May,Điện châm,09:42,10:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
434,Vì Văn May,Thủy châm,10:13,10:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
469,Đỗ Văn Dổ,Điện châm,09:48,10:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
469,Đỗ Văn Dổ,Thủy châm,10:19,10:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
467,Nguyễn Văn Dần,Điện châm,09:54,10:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
467,Nguyễn Văn Dần,Thủy châm,10:25,10:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
452,Lò Thị May,Điện châm,10:00,10:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
452,Lò Thị May,Thủy châm,09:31,09:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
451,Tòng Văn Đoàn,Điện châm,10:06,10:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
451,Tòng Văn Đoàn,Thủy châm,09:37,10:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
453,Nguyễn Thị Nhung,Điện châm,10:12,10:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
453,Nguyễn Thị Nhung,Thủy châm,09:43,10:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
402,Cà Thị Tỏi,Điện châm,10:18,10:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
402,Cà Thị Tỏi,Thủy châm,09:49,10:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
435,Quàng Thị Đại,Điện châm,10:24,10:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
435,Quàng Thị Đại,Thủy châm,09:55,10:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
480,Trần Thị Điều,Điện châm,13:30,13:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
480,Trần Thị Điều,Thủy châm,14:01,14:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
403,Đèo Văn Tuyên,Điện châm,13:36,14:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
403,Đèo Văn Tuyên,Thủy châm,14:07,14:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
455,Quàng Thị Miên,Điện châm,13:42,14:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
455,Quàng Thị Miên,Thủy châm,14:13,14:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
457,Lò Văn Xương,Điện châm,13:48,14:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
457,Lò Văn Xương,Thủy châm,14:19,14:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
404,Lèo Thị Thơi,Điện châm,13:54,14:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
404,Lèo Thị Thơi,Thủy châm,14:25,14:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
431,Hoàng Văn Thương,Điện châm,14:00,14:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
431,Hoàng Văn Thương,Thủy châm,13:31,13:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
454,Lường Thị Tun,Điện châm,14:06,14:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
454,Lường Thị Tun,Thủy châm,13:37,14:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
423,Lò Thị Xin,Điện châm,14:12,14:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
423,Lò Thị Xin,Thủy châm,14:43,15:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
447,Phạm Thị Huê,Điện châm,14:18,14:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
447,Phạm Thị Huê,Thủy châm,14:49,15:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
429,Lù Văn Ương,Điện châm,14:24,14:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
429,Lù Văn Ương,Thủy châm,14:55,15:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
405,Tòng Thị Pè,Điện châm,14:30,14:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
405,Tòng Thị Pè,Thủy châm,15:01,15:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
408,Lò Thị Hịa,Điện châm,14:36,15:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
408,Lò Thị Hịa,Thủy châm,15:07,15:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
401,Quàng Thị Lả,Điện châm,14:42,15:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
401,Quàng Thị Lả,Thủy châm,15:13,15:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
406,Quàng Thị Số,Điện châm,14:48,15:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
406,Quàng Thị Số,Thủy châm,13:43,14:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
407,Quàng Thị Hoa,Điện châm,14:54,15:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
407,Quàng Thị Hoa,Thủy châm,13:49,14:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
422,Nguyễn Thị Thúy,Điện châm,15:00,15:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
422,Nguyễn Thị Thúy,Thủy châm,13:55,14:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
424,Bạc Thanh Minh,Điện châm,15:06,15:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
424,Bạc Thanh Minh,Thủy châm,14:37,15:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
460,Lò Thị Biêng,Điện châm,15:12,15:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
460,Lò Thị Biêng,Thủy châm,14:31,14:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
432,Lò Thị Khổ,Điện châm,15:18,15:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
432,Lò Thị Khổ,Thủy châm,15:49,16:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
433,Lò Văn Soan,Điện châm,15:24,15:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
433,Lò Văn Soan,Thủy châm,15:55,16:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
477,Nguyễn Thị Là,Điện châm,15:30,15:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
477,Nguyễn Thị Là,Thủy châm,16:01,16:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
478,Bùi Thị Kim Ngân,Điện châm,15:36,16:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
478,Bùi Thị Kim Ngân,Thủy châm,16:07,16:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
473,Nguyễn Thị Thu Hà,Điện châm,15:42,16:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
473,Nguyễn Thị Thu Hà,Thủy châm,16:13,16:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
443,Quàng Thị Lả,Điện châm,15:48,16:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
443,Quàng Thị Lả,Thủy châm,15:19,15:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
446,Đàm Thị Mai,Điện châm,15:54,16:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
446,Đàm Thị Mai,Thủy châm,15:25,15:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
444,Nguyễn Thị Lịch,Điện châm,16:00,16:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
444,Nguyễn Thị Lịch,Thủy châm,15:31,15:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
458,Quàng Thị Vinh,Điện châm,16:06,16:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
458,Quàng Thị Vinh,Thủy châm,15:37,16:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
430,Quàng Văn Quang,Điện châm,16:12,16:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
430,Quàng Văn Quang,Thủy châm,15:43,16:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,`;

// Data set 2: Day 30 (June 30)
const day30Csv = `Số giường,Họ tên người bệnh,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2,
420,Phan Thị Lộc,Điện châm,07:40,08:05,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
420,Phan Thị Lộc,Thủy châm,08:06,08:31,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
409,Quách Đình Thiều,Điện châm,07:52,08:17,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
409,Quách Đình Thiều,Thủy châm,08:18,08:43,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
410,Vũ Thị Cúc,Điện châm,07:58,08:23,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
410,Vũ Thị Cúc,Thủy châm,08:24,08:49,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
415,Lò Thị Nọi,Điện châm,08:04,08:29,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
415,Lò Thị Nọi,Thủy châm,08:30,08:55,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
416,Cà Thị Đôi,Điện châm,08:10,08:35,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
416,Cà Thị Đôi,Thủy châm,08:36,09:01,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
421,Cà Thị Ýnh,Điện châm,08:16,08:41,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
421,Cà Thị Ýnh,Thủy châm,08:42,09:07,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
439,Quàng Thị Xum,Điện châm,08:22,08:47,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
439,Quàng Thị Xum,Thủy châm,08:48,09:13,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
417,Đinh Thị Mơ,Điện châm,08:28,08:53,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
417,Đinh Thị Mơ,Thủy châm,08:54,09:19,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
414,Lù Thị Hiếng,Điện châm,08:34,08:59,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
414,Lù Thị Hiếng,Thủy châm,09:00,09:25,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
467,Nguyễn Hữu Vệ,Điện châm,08:40,09:05,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
467,Nguyễn Hữu Vệ,Thủy châm,08:12,08:37,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
468,Lò Minh Phiệng,Điện châm,08:46,09:11,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
468,Lò Minh Phiệng,Thủy châm,07:54,08:19,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
470,Lù Thị Mông,Điện châm,08:52,09:17,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
470,Lù Thị Mông,Thủy châm,09:18,09:43,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
472,Bùi Thị Xiêm,Điện châm,08:58,09:23,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
472,Bùi Thị Xiêm,Thủy châm,09:24,09:49,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
452,Trương Thị Minh Thư,Điện châm,09:04,09:29,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
452,Trương Thị Minh Thư,Thủy châm,09:30,09:55,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
453,Đỗ Kim Bằng,Điện châm,09:10,09:35,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
453,Đỗ Kim Bằng,Thủy châm,09:36,10:01,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
412,Mã Nguyên Mục,Điện châm,09:16,09:41,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
412,Mã Nguyên Mục,Thủy châm,09:42,10:07,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
442,Hà Thị Hoa,Điện châm,09:22,09:47,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
442,Hà Thị Hoa,Thủy châm,09:48,10:13,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
429,Hoàng Đức Vượt,Điện châm,13:30,13:55,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
429,Hoàng Đức Vượt,Thủy châm,14:01,14:26,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
477B,Nguyễn Hữu Kiêm,Điện châm,13:36,14:01,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
477B,Nguyễn Hữu Kiêm,Thủy châm,14:07,14:32,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
474,Trần Thị Liên,Điện châm,13:42,14:07,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
474,Trần Thị Liên,Thủy châm,14:13,14:38,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
422,Nguyễn Thị Lý,Điện châm,13:48,14:13,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
422,Nguyễn Thị Lý,Thủy châm,14:19,14:44,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
423,Lò Văn Khé,Điện châm,13:54,14:19,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
423,Lò Văn Khé,Thủy châm,14:25,14:50,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
424,Trần Thị Bình,Điện châm,14:00,14:25,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
424,Trần Thị Bình,Thủy châm,13:31,13:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
401,Cầm Hòa Bình,Điện châm,14:06,14:31,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
401,Cầm Hòa Bình,Thủy châm,13:37,14:02,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
402,Đèo Văn Sinh,Điện châm,14:12,14:37,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
402,Đèo Văn Sinh,Thủy châm,13:43,14:08,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
473,Đỗ Đình Khiển,Điện châm,14:18,14:43,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
473,Đỗ Đình Khiển,Thủy châm,13:49,14:14,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
444,Lèo Thị Hẹ,Điện châm,14:24,14:49,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
444,Lèo Thị Hẹ,Thủy châm,13:55,14:20,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
443,Lường Thị Hặc,Điện châm,14:30,14:55,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
443,Lường Thị Hặc,Thủy châm,15:01,15:26,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
446,Lò Thị Ón,Điện châm,14:36,15:01,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
446,Lò Thị Ón,Thủy châm,15:07,15:32,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
458,Trần Văn Sơn,Điện châm,14:42,15:07,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
458,Trần Văn Sơn,Thủy châm,15:13,15:38,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
432,Quàng Thị Đại,Điện châm,14:48,15:13,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
432,Quàng Thị Đại,Thủy châm,15:19,15:44,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
478,Nguyễn Thanh Hải,Điện châm,14:54,15:19,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
478,Nguyễn Thanh Hải,Thủy châm,15:25,15:50,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
430,Dương thị Thúy,Điện châm,15:00,15:25,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
430,Dương thị Thúy,Thủy châm,15:31,15:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
461,Doãn Thị Lực,Điện châm,15:06,15:31,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
461,Doãn Thị Lực,Thủy châm,14:31,14:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
459,Nguyễn Văn Bằng,Điện châm,15:12,15:37,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
459,Nguyễn Văn Bằng,Thủy châm,14:37,15:02,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
479,Đỗ Thị Thanh Bình,Điện châm,15:18,15:43,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
479,Đỗ Thị Thanh Bình,Thủy châm,14:43,15:08,Nguyễn Tùng Lâm,Vũ Thúy Hà,,`;

// Data set 3: July 18
const july18Csv = `434,VÌ VĂN MAY,Điện châm,7:44,8:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
435,HOÀNG ĐỨC VƯỢT,Điện châm,7:50,8:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
409,LƯỜNG THỊ VÉT,Điện châm,7:56,8:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
470,BẠC THANH MINH,Điện châm,8:02,8:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
439,LÙ THỊ BINH,Điện châm,8:08,8:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
441,LÒ THỊ ĐOAN,Điện châm,8:14,8:39,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
471,NGUYỄN THỊ THUÝ,Điện châm,8:20,8:45,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
410,TRƯƠNG THỊ KHÁNH,Điện châm,8:26,8:51,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
472,LÒ THỊ THƯƠNG,Điện châm,8:32,8:57,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
412,PHẠM THỊ HẢI YẾN,Điện châm,8:38,9:03,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
414,BẠC THỊ KEM,Điện châm,8:44,9:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
415,HOÀNG THỊ È,Điện châm,8:50,9:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
416,LÒ THỊ CHOM,Điện châm,8:56,9:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
449,TRỊNH THỊ LƯU,Điện châm,9:02,9:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
417,LÒ VĂN DIÊU,Điện châm,9:08,9:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
418,LÒ THỊ NGOAN,Điện châm,9:14,9:39,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
419,HOÀNG THỊ BÓNG,Điện châm,9:20,9:45,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
451,LÒ VĂN CHƠN,Điện châm,9:26,9:51,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
452,VÌ VĂN NE,Điện châm,9:32,9:57,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
420,HÀ THỊ HƯƠNG,Điện châm,9:38,10:03,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
453,TÒNG THỊ NGHỊCH,Điện châm,9:44,10:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
421,PHẠM THỊ HUÊ,Điện châm,9:50,10:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
467,ĐÀO VĂN PHÚ,Điện châm,9:56,10:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
469,NGUYỄN HỮU VỆ,Điện châm,10:02,10:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
462,Lò Văn Nọi,Điện châm,10:08,10:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
431,QUÀNG THỊ HƯƠI,Điện châm,13:31,13:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
401,LÒ THỊ XIN,Điện châm,13:37,14:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
402,TÒNG THỊ XƯƠNG,Điện châm,13:43,14:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
429,HOÀNG VĂN TƯƠI,Điện châm,13:49,14:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
403,LÒ THỊ PỎM,Điện châm,13:55,14:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
404,LÒ THỊ LÍCH,Điện châm,14:01,14:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
432,QUÀNG THỊ ĐẠI,Điện châm,14:07,14:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
433,VÌ THỊ CUA,Điện châm,14:13,14:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
405,HOÀNG THỊ LIÊN,Điện châm,14:19,14:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
406,BẠC THỊ DỌN,Điện châm,14:25,14:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
407,LÒ THỊ NGOAI,Điện châm,14:31,14:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
408,QUÀNG THỊ MAI,Điện châm,14:37,15:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
454,LÒ THỊ HƯỞNG,Điện châm,14:43,15:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
443,QUÀNG THỊ XUÂN,Điện châm,14:49,15:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
444,LÒ THỊ HỎA,Điện châm,14:55,15:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
446,VÌ THỊ SAN,Điện châm,15:01,15:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
447,HÀ THỊ ÓNG,Điện châm,15:07,15:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
422,LƯỜNG VĂN TIM,Điện châm,15:13,15:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
423,ĐÀO THANH TRÀ,Điện châm,15:19,15:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
424,LƯỜNG VĂN HỢP,Điện châm,15:25,15:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
459,LÒ VĂN SOAN,Điện châm,15:31,15:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
461,TRẦN THỊ TÝ,Điện châm,15:37,16:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
460,LÒ THỊ KHỔ,Điện châm,15:43,16:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
466,NGUYỄN VĂN HỘI,Điện châm,15:49,16:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
430,LÈO VĂN TIẾN,Điện châm,15:55,16:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
465,AN THỊ LỊCH,Điện châm,16:01,16:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
474,PHẠM VĂN TRỊNH,Điện châm,16:07,16:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
475,NGUYỄN VĂN VẼ,Điện châm,16:13,16:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
479,ĐÀO THỊ LAN,Điện châm,16:19,16:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
478,LÊ THỊ HOÀNG,Điện châm,16:25,16:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
479B,LÊ THỊ LAN,Điện châm,16:31,16:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
477,PHAN THỊ HẰNG,Điện châm,16:37,17:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
480,PHẠM THỊ MÂY,Điện châm,16:43,17:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
476,NGUYỄN THỊ GIẢO,Điện châm,16:49,17:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang`;

async function masterImport() {
  console.log("=== MASTER LINK DATA SCRIPT STARTED ===");
  await signInAnonymously(auth);

  // 1. Collect all unique patients from all 3 CSVs
  const patientMap = new Map<string, { bedNumber: string; name: string }>();

  const processCsvForPatients = (csv: string) => {
    const lines = csv.trim().split("\n");
    for (const line of lines) {
      if (!line.trim() || line.startsWith("Số giường")) continue;
      const parts = line.split(",");
      if (parts.length >= 2) {
        const bed = parts[0].trim();
        const name = parts[1].trim();
        if (bed && name) {
          const key = cleanVN(name) + "_" + bed;
          if (!patientMap.has(key)) {
            patientMap.set(key, { bedNumber: bed, name: name });
          }
        }
      }
    }
  };

  processCsvForPatients(day13Csv);
  processCsvForPatients(day30Csv);
  processCsvForPatients(july18Csv);

  console.log(`Extracted ${patientMap.size} unique patients from CSV datasets.`);

  // 2. Fetch existing patients from Firestore
  const pSnap = await getDocs(collection(db, "patients"));
  const existingPatients = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
  console.log(`Existing patients in Firestore: ${existingPatients.length}`);

  const patientDocMap = new Map<string, Patient>();
  existingPatients.forEach(p => {
    patientDocMap.set(cleanVN(p.name) + "_" + (p.bedNumber || ""), p);
    patientDocMap.set(cleanVN(p.name), p);
  });

  // Save new patients to Firestore
  let newlyCreatedPatients = 0;
  let idx = 100;
  for (const [key, pData] of patientMap.entries()) {
    let match = patientDocMap.get(key) || patientDocMap.get(cleanVN(pData.name));
    if (!match) {
      idx++;
      const roomNum = `P.${Math.floor(Number(pData.bedNumber.replace(/\D/g, '')) / 10) || '401'}`;
      const newP: Patient = {
        id: `p_bed_${pData.bedNumber.replace(/\W/g, '_')}_${idx}`,
        name: pData.name,
        dob: '1955-06-15',
        gender: pData.name.toLowerCase().includes('văn') || pData.name.toLowerCase().includes('đức') || pData.name.toLowerCase().includes('hữu') ? 'Nam' : 'Nữ',
        code: `BN-LAO-${pData.bedNumber}`,
        bedNumber: pData.bedNumber,
        roomNumber: roomNum,
        admissionDate: '2026-06-01T08:00',
        status: PatientStatus.TREATING,
        admittedByDeptId: 'dept_lao',
        bedType: 'Nội trú',
        insuranceLevel: '100%'
      };
      await setDoc(doc(db, "patients", newP.id), newP);
      patientDocMap.set(key, newP);
      patientDocMap.set(cleanVN(pData.name), newP);
      newlyCreatedPatients++;
    }
  }
  console.log(`Created ${newlyCreatedPatients} new patients in Firestore!`);

  // 3. Collect all staff members mentioned in CSVs
  const staffNamesSet = new Set<string>();
  const collectStaff = (csv: string) => {
    const lines = csv.trim().split("\n");
    for (const line of lines) {
      if (!line.trim() || line.startsWith("Số giường")) continue;
      const parts = line.split(",");
      if (parts.length >= 8) {
        if (parts[5].trim()) staffNamesSet.add(parts[5].trim());
        if (parts[6].trim()) staffNamesSet.add(parts[6].trim());
        if (parts[7].trim()) staffNamesSet.add(parts[7].trim());
      }
    }
  };
  collectStaff(day13Csv);
  collectStaff(day30Csv);
  collectStaff(july18Csv);

  const sSnap = await getDocs(collection(db, "staff"));
  const existingStaff = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
  const staffDocMap = new Map<string, Staff>();
  existingStaff.forEach(s => staffDocMap.set(cleanVN(s.name), s));

  let sIdx = 100;
  for (const sName of staffNamesSet) {
    if (!staffDocMap.has(cleanVN(sName))) {
      sIdx++;
      const isDoctor = sName.toLowerCase().includes('bác sĩ') || sName.toLowerCase().includes('lâm') || sName.toLowerCase().includes('trang');
      const newStaff: Staff = {
        id: `s_lao_${sIdx}`,
        name: sName,
        role: isDoctor ? 'Doctor' : 'Technician',
        deptId: 'dept_lao',
        capabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'],
        mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'],
        assistantCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop']
      };
      await setDoc(doc(db, "staff", newStaff.id), newStaff);
      staffDocMap.set(cleanVN(sName), newStaff);
      console.log(`Created staff: ${sName}`);
    }
  }

  // 4. Ensure Khoa Lão Procedures exist
  const procSnap = await getDocs(collection(db, "procedures"));
  const existingProcs = procSnap.docs.map(d => ({ id: d.id, ...d.data() } as Procedure));
  const procDocMap = new Map<string, Procedure>();
  existingProcs.forEach(pr => {
    if (pr.deptId === 'dept_lao') {
      procDocMap.set(cleanVN(pr.name), pr);
    }
  });

  const defaultLaoProcs: any[] = [
    { id: 'pr_lao_diencham', name: 'Điện châm (Khoa Lão)', requiredRoles: ['Doctor'], deptId: 'dept_lao', createdByDeptId: 'dept_lao' },
    { id: 'pr_lao_thuycham', name: 'Thủy châm (Khoa Lão)', requiredRoles: ['Doctor'], deptId: 'dept_lao', createdByDeptId: 'dept_lao' },
    { id: 'pr_lao_cuu', name: 'Cứu ngải (Khoa Lão)', requiredRoles: ['Technician'], deptId: 'dept_lao', createdByDeptId: 'dept_lao' },
    { id: 'pr_lao_xoa_bop', name: 'Xoa bóp bấm huyệt (Khoa Lão)', requiredRoles: ['Technician'], deptId: 'dept_lao', createdByDeptId: 'dept_lao' }
  ];

  for (const pr of defaultLaoProcs) {
    await setDoc(doc(db, "procedures", pr.id), pr);
    procDocMap.set(cleanVN(pr.name), pr);
    procDocMap.set(cleanVN(pr.name.replace(' (khoa lao)', '')), pr);
  }

  // Helper to parse CSV and build Appointment objects
  const parseAppointmentsFromCsv = (csv: string, dateStr: string): Appointment[] => {
    const lines = csv.trim().split("\n");
    const appts: Appointment[] = [];
    let counter = 0;

    for (const line of lines) {
      if (!line.trim() || line.startsWith("Số giường")) continue;
      const parts = line.split(",");
      if (parts.length < 5) continue;

      const bedNumber = parts[0].trim();
      const patientName = parts[1].trim();
      const procedureName = parts[2].trim();
      const startTime = parts[3].trim().padStart(5, '0');
      const endTime = parts[4].trim().padStart(5, '0');
      const mainStaffName = parts[5]?.trim() || '';
      const asst1Name = parts[6]?.trim() || '';
      const asst2Name = parts[7]?.trim() || '';

      const matchedPatient = patientDocMap.get(cleanVN(patientName) + "_" + bedNumber) || patientDocMap.get(cleanVN(patientName));
      if (!matchedPatient) {
        console.warn(`Patient not found for: ${patientName} (${bedNumber})`);
        continue;
      }

      let matchedProc = procDocMap.get(cleanVN(procedureName)) || procDocMap.get(cleanVN(procedureName) + " (khoa lao)");
      if (!matchedProc) {
        matchedProc = defaultLaoProcs[0]; // fallback to Điện châm
      }

      const mainStaff = staffDocMap.get(cleanVN(mainStaffName));
      const asst1 = staffDocMap.get(cleanVN(asst1Name));
      const asst2 = staffDocMap.get(cleanVN(asst2Name));

      counter++;
      const appt: any = {
        id: `apt_lao_${dateStr}_${counter}`,
        patientId: matchedPatient.id,
        procedureId: matchedProc.id,
        staffId: mainStaff ? mainStaff.id : (existingStaff[0]?.id || 's_lao1'),
        assistant1Id: asst1 ? asst1.id : undefined,
        assistant2Id: asst2 ? asst2.id : undefined,
        date: dateStr,
        startTime: startTime,
        endTime: endTime,
        status: AppointmentStatus.COMPLETED,
        deptId: 'dept_lao',
        note: `Chỉ định ${procedureName} tại giường ${bedNumber}`
      };
      const cleanAppt = Object.fromEntries(
        Object.entries(appt).filter(([_, v]) => v !== undefined)
      ) as unknown as Appointment;
      appts.push(cleanAppt);
    }
    return appts;
  };

  // 5. Import appointments for all target dates:
  // - 2026-06-13
  // - 2026-06-30
  // - 2026-07-18
  // - 2026-07-29 (TODAY!)

  const todayStr = '2026-07-29';
  const datesToProcess = [
    { csv: day13Csv, date: '2026-06-13' },
    { csv: day30Csv, date: '2026-06-30' },
    { csv: july18Csv, date: '2026-07-18' },
    { csv: day30Csv, date: todayStr } // Copy day30 schedule to today (2026-07-29) so live app shows active appointments!
  ];

  for (const item of datesToProcess) {
    console.log(`\nImporting appointments for date: ${item.date}...`);
    // Delete existing appts for this date & dept_lao
    const existing = await getDocs(collection(db, "appointments"));
    const toDelete = existing.docs.filter(d => d.data().date === item.date && d.data().deptId === 'dept_lao');
    for (const d of toDelete) {
      await deleteDoc(doc(db, "appointments", d.id));
    }

    const appts = parseAppointmentsFromCsv(item.csv, item.date);
    console.log(`Generated ${appts.length} appointments for ${item.date}. Saving to Firestore...`);
    for (const a of appts) {
      // If it's today, mark some as IN_PROGRESS or PENDING based on current time
      if (item.date === todayStr) {
        if (a.startTime > '15:00') a.status = AppointmentStatus.PENDING;
        else if (a.startTime >= '13:30') a.status = AppointmentStatus.IN_PROGRESS;
        else a.status = AppointmentStatus.COMPLETED;
      }
      await setDoc(doc(db, "appointments", a.id), a);
    }

    // Set attendance to DUTY for all involved staff on this date
    const staffIdsInUse = new Set<string>();
    appts.forEach(a => {
      if (a.staffId) staffIdsInUse.add(a.staffId);
      if (a.assistant1Id) staffIdsInUse.add(a.assistant1Id);
      if (a.assistant2Id) staffIdsInUse.add(a.assistant2Id);
    });

    for (const sId of staffIdsInUse) {
      const attId = `att_${item.date}_${sId}`;
      const record: any = {
        id: attId,
        staffId: sId,
        date: item.date,
        status: AttendanceStatus.DUTY
      };
      await setDoc(doc(db, "attendance", attId), record);
    }
  }

  console.log("\n=== MASTER LINK DATA COMPLETED SUCCESSFULLY! ===");
}

masterImport().then(() => process.exit(0)).catch(err => {
  console.error("Master import failed:", err);
  process.exit(1);
});
