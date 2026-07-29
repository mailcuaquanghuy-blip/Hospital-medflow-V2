import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord } from "../types";
import { checkConflict } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const csvData = `Lò Thị Anh,Nữ • 60t • Nội trú,435 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,08:42 - 09:07,L-03
Lò Thị Anh,Nữ • 60t • Nội trú,435 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:13 - 09:38,-
Bùi Thị Bé,Nữ • 81t • Nội trú,438 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:42 - 10:07,L-03
Bùi Thị Bé,Nữ • 81t • Nội trú,438 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:13 - 10:38,-
Cầm Hòa Bình,Nam • 60t • Nội trú,401 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:48 - 15:13,L-04
Cầm Hòa Bình,Nam • 60t • Nội trú,401 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,15:19 - 15:44,-
Trần Thị Bình,Nữ • 71t • Nội trú,424 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:42 - 15:07,L-03
Trần Thị Bình,Nữ • 71t • Nội trú,424 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,15:13 - 15:38,-
Lò Văn Bỉnh,Nam • 48t • Nội trú,407 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,13:37 - 14:02,-
Lò Văn Bỉnh,Nam • 48t • Nội trú,407 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:06 - 14:31,L-02
Hoàng Văn Cấu,Nam • 78t • Nội trú,412 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:24 - 09:49,L-05
Hoàng Văn Cấu,Nam • 78t • Nội trú,412 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:55 - 10:20,-
Tòng Văn Cong,Nam • 68t • Nội trú,449 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:36 - 10:01,L-02
Tòng Văn Cong,Nam • 68t • Nội trú,449 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:07 - 10:32,-
Vũ Thị Cúc,Nữ • 75t • Nội trú,410 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:06 - 10:31,L-02
Vũ Thị Cúc,Nữ • 75t • Nội trú,410 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:37 - 11:02,-
Quàng Thị Đại,Nữ • 67t • Nội trú,432 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:55 - 15:20,-
Quàng Thị Đại,Nữ • 67t • Nội trú,432 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:24 - 15:49,L-05
Lò Văn Điệu,Nam • 80t • Nội trú,461 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,13:31 - 13:56,-
Lò Văn Điệu,Nam • 80t • Nội trú,461 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:00 - 14:25,L-01
Lò Văn Điệu,Nam • 80t • Nội trú,461 - P:K.Lão,Khoa Lão,Xoa bóp,Vũ Thúy Hà,,,15:59 - 16:29,-
Cà Thị Đôi,Nữ • 64t • Nội trú,416 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:18 - 10:43,L-04
Cà Thị Đôi,Nữ • 64t • Nội trú,416 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:49 - 11:14,-
Nguyễn Thị Gái,Nữ • 76t • Nội trú,411 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:00 - 09:25,L-01
Nguyễn Thị Gái,Nữ • 76t • Nội trú,411 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:31 - 09:56,-
Lường Thị Hặc,Nữ • 50t • Nội trú,443 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:37 - 15:02,-
Lường Thị Hặc,Nữ • 50t • Nội trú,443 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:06 - 15:31,L-02
Lèo Thị Hẹ,Nữ • 67t • Nội trú,444 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:31 - 14:56,-
Lèo Thị Hẹ,Nữ • 67t • Nội trú,444 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:00 - 15:25,L-01
Lù Thị Hiếng,Nữ • 66t • Nội trú,414 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,08:43 - 09:08,-
Lù Thị Hiếng,Nữ • 66t • Nội trú,414 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:42 - 11:07,L-03
Lò Thị Hoa,Nữ • 44t • Nội trú,434 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,08:48 - 09:13,L-04
Lò Thị Hoa,Nữ • 44t • Nội trú,434 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:19 - 09:44,-
Quàng Thị Hoa,Nữ • 69t • Nội trú,418 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:12 - 09:37,L-03
Quàng Thị Hoa,Nữ • 69t • Nội trú,418 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:43 - 10:08,-
Hà Văn Học,Nam • 66t • Nội trú,408 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,13:42 - 14:07,L-03
Hà Văn Học,Nam • 66t • Nội trú,408 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:13 - 14:38,-
Cà Thị Hương,Nữ • 54t • Nội trú,441 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:48 - 10:13,L-04
Cà Thị Hương,Nữ • 54t • Nội trú,441 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:19 - 10:44,-
Cao Thị Lan Hường,Nữ • 54t • Nội trú ban ngày,475B - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:30 - 15:55,L-01
Cao Thị Lan Hường,Nữ • 54t • Nội trú ban ngày,475B - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,16:37 - 17:02,-
Lò Thị In,Nữ • 68t • Nội trú,451 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,08:54 - 09:19,L-05
Lò Thị In,Nữ • 68t • Nội trú,451 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:25 - 09:50,-
Lò Văn Khé,Nam • 76t • Nội trú,423 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:36 - 15:01,L-02
Lò Văn Khé,Nam • 76t • Nội trú,423 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,15:07 - 15:32,-
Đỗ Đình Khiển,Nam • 62t • Nội trú ban ngày,473 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,08:49 - 09:14,-
Đỗ Đình Khiển,Nam • 62t • Nội trú ban ngày,473 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:48 - 11:13,L-04
Lò Thị Khin,Nữ • 66t • Nội trú,448 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:30 - 09:55,L-01
Lò Thị Khin,Nữ • 66t • Nội trú,448 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:01 - 10:26,-
Nguyễn Hữu Kiêm,Nam • 74t • Nội trú,477B - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:42 - 16:07,L-03
Nguyễn Hữu Kiêm,Nam • 74t • Nội trú,477B - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,16:49 - 17:14,-
Trần Thị Liên,Nữ • 84t • Nội trú ban ngày,474 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:48 - 16:13,L-04
Trần Thị Liên,Nữ • 84t • Nội trú ban ngày,474 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,16:55 - 17:20,-
Phan Thị Lộc,Nữ • 66t • Nội trú,420 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:54 - 10:19,L-05
Phan Thị Lộc,Nữ • 66t • Nội trú,420 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:25 - 10:50,-
Lò Văn Lun,Nam • 60t • Nội trú,453 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,08:36 - 09:01,L-02
Lò Văn Lun,Nam • 60t • Nội trú,453 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:07 - 09:32,-
Nguyễn Thị Lý,Nữ • 72t • Nội trú,422 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:30 - 14:55,L-01
Nguyễn Thị Lý,Nữ • 72t • Nội trú,422 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,15:01 - 15:26,-
Đinh Thị Mơ,Nữ • 72t • Nội trú,417 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,08:37 - 09:02,-
Đinh Thị Mơ,Nữ • 72t • Nội trú,417 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:36 - 11:01,L-02
Đặng Thị Nga,Nam • 57t • Nội trú ban ngày,475B - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:36 - 16:01,L-02
Đặng Thị Nga,Nam • 57t • Nội trú ban ngày,475B - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,16:43 - 17:08,-
Đặng Văn Nhuế,Nam • 80t • Nội trú,447 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,13:55 - 14:20,-
Đặng Văn Nhuế,Nam • 80t • Nội trú,447 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:24 - 14:49,L-05
Lường Thị Nía,Nữ • 76t • Nội trú,459 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,13:54 - 14:19,L-05
Lường Thị Nía,Nữ • 76t • Nội trú,459 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:25 - 14:50,-
Lường Thị Nía,Nữ • 76t • Nội trú,459 - P:K.Lão,Khoa Lão,Xoa bóp,Vũ Thúy Hà,,,16:30 - 17:00,-
Lò Thị Nọi,Nữ • 72t • Nội trú,415 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:12 - 10:37,L-03
Lò Thị Nọi,Nữ • 72t • Nội trú,415 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:43 - 11:08,-
Lò Thị Ón,Nữ • 59t • Nội trú,446 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:43 - 15:08,-
Lò Thị Ón,Nữ • 59t • Nội trú,446 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:12 - 15:37,L-03
Ngần Văn Phọng,Nam • 55t • Nội trú,405 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:01 - 14:26,-
Ngần Văn Phọng,Nam • 55t • Nội trú,405 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,16:56 - 17:21,L-06
Lò Văn Phủ,Nam • 70t • Nội trú,454 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,13:48 - 14:13,L-04
Lò Văn Phủ,Nam • 70t • Nội trú,454 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:19 - 14:44,-
Lò Văn Phủ,Nam • 70t • Nội trú,454 - P:K.Lão,Khoa Lão,Xoa bóp,Bùi Thị Thu Hà,,,16:02 - 16:32,-
Trần Hữu Phúc,Nam • 76t • Nội trú,413 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:18 - 09:43,L-04
Trần Hữu Phúc,Nam • 76t • Nội trú,413 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:49 - 10:14,-
Phạm Thị Phương,Nữ • 86t • Nội trú,455 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,13:43 - 14:08,-
Phạm Thị Phương,Nữ • 86t • Nội trú,455 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:12 - 14:37,L-03
Vàng Chụ Pó,Nam • 48t • Nội trú,406 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,13:36 - 14:01,L-02
Vàng Chụ Pó,Nam • 48t • Nội trú,406 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:07 - 14:32,-
Đèo Văn Sinh,Nữ • 61t • Nội trú,402B - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:54 - 15:19,L-05
Đèo Văn Sinh,Nữ • 61t • Nội trú,402B - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,15:25 - 15:50,-
Quàng Thị Số,Nữ • 63t • Nội trú,419 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,09:06 - 09:31,L-02
Quàng Thị Số,Nữ • 63t • Nội trú,419 - P:K.Lão,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,09:37 - 10:02,-
Trần Văn Sơn,Nam • 62t • Nội trú,458 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,14:49 - 15:14,-
Trần Văn Sơn,Nam • 62t • Nội trú,458 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,15:18 - 15:43,L-04
Lê Trọng Sỹ,Nam • 49t • Nội trú,469 - P:K.Lão,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,08:30 - 08:55,L-01
Lê Trọng Sỹ,Nam • 49t • Nội trú,469 - P:K.Lão,Khoa Lão,Xoa bóp,Vũ Thúy Hà,,,10:59 - 11:29,-
Quách Đình Thiều,Nam • 86t • Nội trú,409 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:00 - 10:25,L-01
Quách Đình Thiều,Nam • 86t • Nội trú,409 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:31 - 10:56,-
Hoàng Đức Vượt,Nam • 51t • Nội trú,429 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,13:49 - 14:14,-
Hoàng Đức Vượt,Nam • 51t • Nội trú,429 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,14:18 - 14:43,L-04
Quàng Thị Xum,Nữ • 58t • Nội trú,439 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,08:31 - 08:56,-
Quàng Thị Xum,Nữ • 58t • Nội trú,439 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:30 - 10:55,L-01
Cà Thị Ýnh,Nữ • 70t • Nội trú,421 - P:?,Khoa Lão,Điện châm,Cầm Thị Uyên,Vũ Thúy Hà,Lê Hương Giang,10:24 - 10:49,L-05
Cà Thị Ýnh,Nữ • 70t • Nội trú,421 - P:?,Khoa Lão,Thủy châm,Nguyễn Thị Huyền Trang,Bùi Thị Thu Hà,,10:55 - 11:20,-`;

async function run() {
  await signInAnonymously(auth);

  // 1. Fetch collections
  const patientsSnap = await getDocs(collection(db, "patients"));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];

  const staffSnap = await getDocs(collection(db, "staff"));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Staff[];

  const proceduresSnap = await getDocs(collection(db, "procedures"));
  const procedures = proceduresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Procedure[];

  const attendanceSnap = await getDocs(query(collection(db, "attendance"), where("date", "==", "2026-05-24")));
  const attendanceRecords = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];

  const existingApptsSnap = await getDocs(collection(db, "appointments"));
  const appointmentsHistory = existingApptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  console.log(`Loaded base data: ${patients.length} patients, ${staff.length} staff, ${procedures.length} procedures, ${attendanceRecords.length} attendance, ${appointmentsHistory.length} existing appointments.`);

  const lines = csvData.trim().split("\n");
  const processedAppointments: Appointment[] = [];
  let successCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 10) continue;

    const patientName = parts[0].trim();
    const info = parts[1].trim();
    const bedRoom = parts[2].trim();
    const deptWork = parts[3].trim(); 
    const procedureName = parts[4].trim();
    const mainStaffName = parts[5].trim();
    const asst1Name = parts[6].trim();
    const asst2Name = parts[7].trim();
    const timeRange = parts[8].trim();
    const machineCode = parts[9].trim();

    // Match patient (by name)
    const foundPatient = patients.find(p => p.name.toLowerCase() === patientName.toLowerCase());
    if (!foundPatient) {
      console.error(`Patient not found: ${patientName}`);
      continue;
    }

    // Match procedure specifically for (deptId = "dept_lao")
    const foundProc = procedures.find(p => p.name.toLowerCase() === procedureName.toLowerCase() && p.deptId === "dept_lao");
    if (!foundProc) {
      console.error(`Procedure not found or wrong dept for ${procedureName}`);
      continue;
    }

    // Match main staff
    const foundMainStaff = staff.find(s => s.name.toLowerCase() === mainStaffName.toLowerCase());
    if (!foundMainStaff && mainStaffName) {
      console.error(`Main staff not found: ${mainStaffName}`);
      continue;
    }

    // Match assistant 1
    let foundAsst1 = null;
    if (asst1Name) {
      foundAsst1 = staff.find(s => s.name.toLowerCase() === asst1Name.toLowerCase());
      if (!foundAsst1) {
        console.error(`Assistant 1 not found: ${asst1Name}`);
        continue;
      }
    }

    // Match assistant 2
    let foundAsst2 = null;
    if (asst2Name) {
      foundAsst2 = staff.find(s => s.name.toLowerCase() === asst2Name.toLowerCase());
      if (!foundAsst2) {
        console.error(`Assistant 2 not found: ${asst2Name}`);
        continue;
      }
    }

    // Parse times
    const [start, end] = timeRange.split("-").map(t => t.trim());
    if (!start || !end) {
      console.error(`Invalid time range: ${timeRange}`);
      continue;
    }

    // Determine machine ID
    const assignedMachineId = (machineCode === "-" || !machineCode) ? null : machineCode;

    // Run active schedule conflict detection
    const conflictRes = checkConflict(
      start,
      end,
      "2026-05-24",
      foundMainStaff ? foundMainStaff.id : "",
      foundPatient.id,
      [...appointmentsHistory, ...processedAppointments],
      staff,
      procedures,
      attendanceRecords,
      patients,
      foundProc.id,
      undefined,
      foundAsst1 ? foundAsst1.id : null,
      foundAsst2 ? foundAsst2.id : null,
      { assignedMachineId }
    );

    // Create unique appointment ID
    const apptId = `appt_${Math.random().toString(36).substr(2, 9)}`;

    // Set complete, detailed appointment structure
    const newAppt: any = {
      id: apptId,
      patientId: foundPatient.id,
      staffId: foundMainStaff ? foundMainStaff.id : "",
      assistant1Id: foundAsst1 ? foundAsst1.id : null,
      assistant2Id: foundAsst2 ? foundAsst2.id : null,
      procedureId: foundProc.id,
      deptId: "dept_lao",
      date: "2026-05-24",
      startTime: start,
      endTime: end,
      status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: assignedMachineId,
      machineShiftId: null,
      conflictDetails: conflictRes.conflictDetails,
      mainBusyStart: foundProc.mainBusyStart ?? 0,
      mainBusyEnd: foundProc.mainBusyEnd ?? foundProc.busyMinutes ?? 0,
      asst1BusyStart: foundProc.asst1BusyStart ?? 0,
      asst1BusyEnd: foundProc.asst1BusyEnd ?? foundProc.assistant1BusyMinutes ?? 0,
      asst2BusyStart: foundProc.asst2BusyStart ?? 0,
      asst2BusyEnd: foundProc.asst2BusyEnd ?? foundProc.assistant2BusyMinutes ?? 0,
      restMinutes: foundProc.restMinutes ?? 0
    };

    // Strip undefined as Firebase doesn't accept them
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    // Save to Firestore
    await setDoc(doc(db, "appointments", apptId), newAppt as Appointment);
    processedAppointments.push(newAppt as Appointment);
    successCount++;

    if (successCount % 10 === 0 || successCount === lines.length) {
      console.log(`[Progress] Imported ${successCount}/${lines.length} appointments...`);
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Successfully mapped and saved ${successCount} procedures for May 24, 2026 into the Geriatric Ward (dept_lao).`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical import error:", err);
  process.exit(1);
});
