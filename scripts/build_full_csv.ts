import fs from "fs";

// We write the complete CSV text from July 1 to July 31
const part1 = `﻿LƯƠNG VĂN ĐẠM,78,,Thủy châm,01/07/2026 13:36:00,01/07/2026 14:01:00,Nguyễn Tùng Lâm;;Lò Thị Thanh
LƯƠNG VĂN ĐẠM,78,,Điện châm,01/07/2026 14:51:00,01/07/2026 15:16:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy;Lò Thị Thanh
TRẦN THỊ HÙY,,76,Thủy châm,01/07/2026 16:02:00,01/07/2026 16:27:00,Vũ Thị Hương Lan;;Lò Thị Thanh
LÒ VĂN TUN,82,,Thủy châm,01/07/2026 15:01:00,01/07/2026 15:26:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ VĂN TUN,82,,Điện châm,01/07/2026 16:09:00,01/07/2026 16:34:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
ĐINH THỊ CHÚC,,96,Điện châm,01/07/2026 08:41:00,01/07/2026 09:06:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
ĐINH THỊ CHÚC,,96,Thủy châm,01/07/2026 09:58:00,01/07/2026 10:23:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐINH THỊ CHÚC,,96,Xoa bóp,01/07/2026 10:55:00,01/07/2026 11:25:00,Lò Thị Thanh;
CẦM HÒA BÌNH,60,,Thủy châm,01/07/2026 16:50:00,01/07/2026 17:15:00,Cầm Thị Uyên;;Lò Thị Thanh
TRẦN THỊ THƯ,,83,Xoa bóp,01/07/2026 08:00:00,01/07/2026 08:30:00,Cà Thị Oanh;
TRẦN THỊ THƯ,,83,Thủy châm,01/07/2026 09:16:00,01/07/2026 09:41:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
TRẦN THỊ THƯ,,83,Điện châm,01/07/2026 09:59:00,01/07/2026 10:24:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
TRƯƠNG VĂN NGÃI,78,,Thủy châm,01/07/2026 14:55:00,01/07/2026 15:20:00,Cầm Thị Uyên;;Nguyễn Quang Huy
TRƯƠNG VĂN NGÃI,78,,Điện châm,01/07/2026 15:43:00,01/07/2026 16:08:00,Nguyễn Tùng Lâm;;Lò Thị Thanh;Quàng Văn Hình
MAO THỊ PHỈNH,,82,Thủy châm,01/07/2026 15:32:00,01/07/2026 15:57:00,Cầm Thị Uyên;;Lò Thị Thanh
NGUYỄN THỊ THANH,,65,Thủy châm,01/07/2026 13:43:00,01/07/2026 14:08:00,Cầm Thị Uyên;;Nguyễn Quang Huy
NGUYỄN THỊ THANH,,65,Điện châm,01/07/2026 14:38:00,01/07/2026 15:08:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Quàng Văn Hình
LÒ THỊ QUYẾT,,60,Thủy châm,01/07/2026 14:19:00,01/07/2026 14:44:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ THỊ QUYẾT,,60,Điện châm,01/07/2026 15:59:00,01/07/2026 16:24:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
QUÀNG VĂN CO,84,,Điện châm,01/07/2026 08:23:00,01/07/2026 08:48:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
QUÀNG VĂN CO,84,,Thủy châm,01/07/2026 09:34:00,01/07/2026 09:59:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
QUÀNG VĂN CO,84,,Xoa bóp,01/07/2026 10:25:00,01/07/2026 10:55:00,Bùi Thị Thu Hà;
VŨ XUÂN TRỌNG,41,,Thủy châm,01/07/2026 14:07:00,01/07/2026 14:32:00,Cầm Thị Uyên;;Nguyễn Quang Huy
VŨ XUÂN TRỌNG,41,,Điện châm,01/07/2026 15:47:00,01/07/2026 16:12:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
VŨ THỊ BẰNG,,65,Điện châm,01/07/2026 13:33:00,01/07/2026 13:58:00,Vũ Thị Hương Lan;;Lò Thị Thanh;Quàng Văn Hình
VŨ THỊ BẰNG,,65,Thủy châm,01/07/2026 13:59:00,01/07/2026 14:24:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
VÌ THỊ PẮN,,78,Thủy châm,01/07/2026 13:31:00,01/07/2026 13:56:00,Cầm Thị Uyên;;Nguyễn Quang Huy
VÌ THỊ PẮN,,78,Điện châm,01/07/2026 16:21:00,01/07/2026 16:46:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
VÌ VĂN PẮN,83,,Thủy châm,01/07/2026 13:37:00,01/07/2026 14:02:00,Cầm Thị Uyên;;Nguyễn Quang Huy
VÌ VĂN PẮN,83,,Điện châm,01/07/2026 16:27:00,01/07/2026 16:52:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
VÌ VĂN NÀN,72,,Thủy châm,01/07/2026 13:49:00,01/07/2026 14:14:00,Cầm Thị Uyên;;Nguyễn Quang Huy
VÌ VĂN NÀN,72,,Điện châm,01/07/2026 16:15:00,01/07/2026 16:40:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
LÒ THỊ BIỂN,,69,Thủy châm,01/07/2026 14:31:00,01/07/2026 14:56:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ THỊ BIỂN,,69,Điện châm,01/07/2026 16:11:00,01/07/2026 16:36:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
LÒ THỊ PÂNG,,66,Thủy châm,01/07/2026 09:10:00,01/07/2026 09:35:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ PÂNG,,66,Điện châm,01/07/2026 09:36:00,01/07/2026 10:01:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ PÂNG,,66,Xoa bóp,01/07/2026 10:04:00,01/07/2026 10:34:00,Cà Thị Oanh;
BÙI THỊ XOAN,,74,Xoa bóp,01/07/2026 08:19:00,01/07/2026 08:49:00,Bùi Thị Thu Hà;
BÙI THỊ XOAN,,74,Điện châm,01/07/2026 08:50:00,01/07/2026 09:15:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
BÙI THỊ XOAN,,74,Thủy châm,01/07/2026 09:53:00,01/07/2026 10:18:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LƯỜNG THỊ BÓ,,53,Thủy châm,01/07/2026 08:58:00,01/07/2026 09:23:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LƯỜNG THỊ BÓ,,53,Điện châm,01/07/2026 09:24:00,01/07/2026 09:49:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LƯỜNG THỊ BÓ,,53,Xoa bóp,01/07/2026 09:53:00,01/07/2026 10:23:00,Bùi Thị Thu Hà;
TÒNG THỊ PHIÊU,,50,Thủy châm,01/07/2026 14:43:00,01/07/2026 15:08:00,Cầm Thị Uyên;;Nguyễn Quang Huy
TÒNG THỊ PHIÊU,,50,Điện châm,01/07/2026 16:45:00,01/07/2026 17:10:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
CẦM THỊ NHỦM,,62,Điện châm,01/07/2026 13:39:00,01/07/2026 14:04:00,Vũ Thị Hương Lan;;Lò Thị Thanh;Quàng Văn Hình
CẦM THỊ NHỦM,,62,Thủy châm,01/07/2026 14:50:00,01/07/2026 15:15:00,Vũ Thị Hương Lan;;Quàng Văn Hình
LÒ THỊ OI,,60,Thủy châm,01/07/2026 14:56:00,01/07/2026 15:21:00,Vũ Thị Hương Lan;;Quàng Văn Hình
LÒ THỊ OI,,60,Điện châm,01/07/2026 16:17:00,01/07/2026 16:42:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
LƯỜNG THỊ NHỌT,,51,Điện châm,01/07/2026 08:51:00,01/07/2026 09:16:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
LƯỜNG THỊ NHỌT,,51,Thủy châm,01/07/2026 09:22:00,01/07/2026 09:47:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LƯỜNG THỊ NHỌT,,51,Xoa bóp,01/07/2026 09:48:00,01/07/2026 10:18:00,Lò Thị Thanh;
LÒ THỊ THOẠI,,44,Điện châm,01/07/2026 13:45:00,01/07/2026 14:10:00,Vũ Thị Hương Lan;;Lò Thị Thanh;Quàng Văn Hình
LÒ THỊ THOẠI,,44,Thủy châm,01/07/2026 15:02:00,01/07/2026 15:27:00,Vũ Thị Hương Lan;;Lò Thị Thanh
LƯỜNG THỊ ƯƠNG,,69,Thủy châm,01/07/2026 14:37:00,01/07/2026 15:02:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LƯỜNG THỊ ƯƠNG,,69,Điện châm,01/07/2026 16:39:00,01/07/2026 17:04:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
CẦM THỊ THÍNH,,61,Thủy châm,01/07/2026 13:46:00,01/07/2026 14:11:00,Vũ Thị Hương Lan;;Lò Thị Thanh
CẦM THỊ THÍNH,,61,Điện châm,01/07/2026 14:12:00,01/07/2026 14:37:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Lò Thị Thanh
LƯỜNG THỊ KIM,,57,Điện châm,01/07/2026 08:29:00,01/07/2026 08:54:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
LƯỜNG THỊ KIM,,57,Thủy châm,01/07/2026 09:46:00,01/07/2026 10:11:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LƯỜNG THỊ KIM,,57,Xoa bóp,01/07/2026 10:59:00,01/07/2026 11:29:00,Cầm Thị Uyên;
LƯỜNG VĂN THU,72,,Điện châm,01/07/2026 08:42:00,01/07/2026 09:12:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LƯỜNG VĂN THU,72,,Xoa bóp,01/07/2026 09:13:00,01/07/2026 09:43:00,Cầm Thị Uyên;
LƯỜNG VĂN THU,72,,Thủy châm,01/07/2026 09:47:00,01/07/2026 10:12:00,Cầm Thị Uyên;;Nguyễn Quang Huy
HÀ THỊ TIẾNG,,66,Thủy châm,01/07/2026 14:13:00,01/07/2026 14:38:00,Cầm Thị Uyên;;Nguyễn Quang Huy
HÀ THỊ TIẾNG,,66,Điện châm,01/07/2026 15:53:00,01/07/2026 16:18:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
LÒ THỊ LIÊN,,70,Xoa bóp,01/07/2026 08:12:00,01/07/2026 08:42:00,Lò Thị Thanh;
LÒ THỊ LIÊN,,70,Điện châm,01/07/2026 08:56:00,01/07/2026 09:21:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ LIÊN,,70,Thủy châm,01/07/2026 09:59:00,01/07/2026 10:24:00,Cầm Thị Uyên;;Nguyễn Quang Huy
TÒNG THỊ SỪA,,65,Thủy châm,01/07/2026 14:25:00,01/07/2026 14:50:00,Cầm Thị Uyên;;Nguyễn Quang Huy
TÒNG THỊ SỪA,,65,Điện châm,01/07/2026 16:05:00,01/07/2026 16:30:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
QUÀNG VĂN HOÀN,63,,Điện châm,01/07/2026 08:30:00,01/07/2026 08:55:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
QUÀNG VĂN HOÀN,63,,Thủy châm,01/07/2026 09:40:00,01/07/2026 10:05:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
QUÀNG VĂN HOÀN,63,,Xoa bóp,01/07/2026 10:57:00,01/07/2026 11:27:00,Bùi Thị Thu Hà;
LÈO THỊ XIÊN,,51,Điện châm,01/07/2026 08:17:00,01/07/2026 08:42:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
LÈO THỊ XIÊN,,51,Thủy châm,01/07/2026 09:28:00,01/07/2026 09:53:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÈO THỊ XIÊN,,51,Xoa bóp,01/07/2026 10:55:00,01/07/2026 11:25:00,Nguyễn Tùng Lâm;
NGUYỄN DANH THẠO,76,,Thủy châm,01/07/2026 13:55:00,01/07/2026 14:20:00,Cầm Thị Uyên;;Nguyễn Quang Huy
NGUYỄN DANH THẠO,76,,Điện châm,01/07/2026 14:45:00,01/07/2026 15:10:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
QUÀNG THỊ SAN,,56,Thủy châm,01/07/2026 08:24:00,01/07/2026 08:49:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
QUÀNG THỊ SAN,,56,Xoa bóp,01/07/2026 09:15:00,01/07/2026 09:45:00,Lò Thị Thanh;
QUÀNG THỊ SAN,,56,Điện châm,01/07/2026 10:06:00,01/07/2026 10:31:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN NGỌC THẠCH,44,,Thủy châm,01/07/2026 13:52:00,01/07/2026 14:17:00,Vũ Thị Hương Lan;;Lò Thị Thanh
NGUYỄN NGỌC THẠCH,44,,Điện châm,01/07/2026 16:33:00,01/07/2026 16:58:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy;Nguyễn Tùng Lâm
CÀ THỊ MUÔN,,61,Xoa bóp,01/07/2026 07:48:00,01/07/2026 08:18:00,Bùi Thị Thu Hà;
CÀ THỊ MUÔN,,61,Điện châm,01/07/2026 09:52:00,01/07/2026 10:17:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ THỊ MUÔN,,61,Thủy châm,01/07/2026 10:18:00,01/07/2026 10:43:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LÒ VĂN THỢI,60,,Thủy châm,01/07/2026 14:49:00,01/07/2026 15:14:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ VĂN THỢI,60,,Điện châm,01/07/2026 15:17:00,01/07/2026 15:42:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy;Quàng Văn Hình
VÌ VĂN DÂM,63,,Thủy châm,01/07/2026 14:01:00,01/07/2026 14:26:00,Cầm Thị Uyên;;Nguyễn Quang Huy
VÌ VĂN DÂM,63,,Điện châm,01/07/2026 15:25:00,01/07/2026 15:50:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy;Quàng Văn Hình
VÌ VĂN ÍNH,86,,Xoa bóp,01/07/2026 08:50:00,01/07/2026 09:20:00,Bùi Thị Thu Hà;
VÌ VĂN ÍNH,86,,Điện châm,01/07/2026 09:46:00,01/07/2026 10:11:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
VÌ VĂN ÍNH,86,,Thủy châm,01/07/2026 10:47:00,01/07/2026 11:12:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ THỊ E,,87,Thủy châm,01/07/2026 15:08:00,01/07/2026 15:33:00,Vũ Thị Hương Lan;;Lò Thị Thanh
LÒ THỊ E,,87,Điện châm,01/07/2026 15:38:00,01/07/2026 16:03:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Nguyễn Quang Huy
PHƯƠNG TẤT THẮNG,71,,Thủy châm,01/07/2026 14:13:00,01/07/2026 14:38:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
PHƯƠNG TẤT THẮNG,71,,Điện châm,01/07/2026 15:51:00,01/07/2026 16:16:00,Nguyễn Tùng Lâm;;Quàng Văn Hình;Lò Thị Thanh
ĐẶNG THỊ TÌNH,,69,Thủy châm,01/07/2026 14:44:00,01/07/2026 15:09:00,Vũ Thị Hương Lan;;Lò Thị Thanh
ĐẶNG THỊ TÌNH,,69,Điện châm,01/07/2026 16:39:00,01/07/2026 17:04:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy;Lò Thị Thanh
LÒ THỊ HÓI,,73,Điện châm,01/07/2026 08:35:00,01/07/2026 09:00:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
LÒ THỊ HÓI,,73,Thủy châm,01/07/2026 09:52:00,01/07/2026 10:17:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ HÓI,,73,Xoa bóp,01/07/2026 10:20:00,01/07/2026 10:50:00,Lò Thị Thanh;
TRẦN VĂN HOÀ,68,,Thủy châm,01/07/2026 08:30:00,01/07/2026 08:55:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
TRẦN VĂN HOÀ,68,,Xoa bóp,01/07/2026 08:56:00,01/07/2026 09:26:00,Vũ Thị Hương Lan;
TRẦN VĂN HOÀ,68,,Điện châm,01/07/2026 10:12:00,01/07/2026 10:37:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LƯỜNG VĂN CƯỚI,68,,Thủy châm,01/07/2026 08:36:00,01/07/2026 09:01:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
LƯỜNG VĂN CƯỚI,68,,Xoa bóp,01/07/2026 09:22:00,01/07/2026 09:52:00,Bùi Thị Thu Hà;
LƯỜNG VĂN CƯỚI,68,,Điện châm,01/07/2026 10:18:00,01/07/2026 10:43:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐIÊU THỊ XÔM,,64,Điện châm,01/07/2026 10:46:00,01/07/2026 11:11:00,Vũ Thị Hương Lan;;Lê Hương Giang;Cà Thị Oanh
ĐIÊU THỊ XÔM,,64,Thủy châm,01/07/2026 15:21:00,01/07/2026 15:46:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LA VĂN VIỂN,66,,Điện châm,01/07/2026 10:53:00,01/07/2026 11:18:00,Vũ Thị Hương Lan;;Cà Thị Oanh;Nguyễn Quang Huy
LA VĂN VIỂN,66,,Thủy châm,01/07/2026 14:33:00,01/07/2026 14:58:00,Nguyễn Tùng Lâm;;Lò Thị Thanh
QUÀNG THỊ KÊ,,62,Điện châm,01/07/2026 11:03:00,01/07/2026 11:28:00,Nguyễn Thị Huyền Trang;;Lò Thị Thanh;Nguyễn Quang Huy
QUÀNG THỊ KÊ,,62,Thủy châm,01/07/2026 14:05:00,01/07/2026 14:30:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LỪ VĂN TƯƠI,49,,Thủy châm,01/07/2026 15:15:00,01/07/2026 15:40:00,Cầm Thị Uyên;;Quàng Văn Hình
TRẦN HẢI NGUYÊN,68,,Thủy châm,01/07/2026 16:58:00,01/07/2026 17:23:00,Cầm Thị Uyên;;Quàng Văn Hình
ĐINH THỊ THIỂM,,49,Thủy châm,01/07/2026 16:37:00,01/07/2026 17:02:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy
BẾ THỊ THINH,,45,Thủy châm,01/07/2026 15:50:00,01/07/2026 16:15:00,Vũ Thị Hương Lan;;Lò Thị Thanh
QUÀNG THỊ DƯƠNG,,45,Thủy châm,01/07/2026 15:09:00,01/07/2026 15:34:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ THỊ PHIÊU,,65,Thủy châm,01/07/2026 17:02:00,01/07/2026 17:27:00,Vũ Thị Hương Lan;;Nguyễn Tùng Lâm
CÀ THỊ OAN,,91,Thủy châm,01/07/2026 15:27:00,01/07/2026 15:52:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy
NGUYỄN THỊ HẢI,,53,Thủy châm,01/07/2026 17:04:00,01/07/2026 17:29:00,Cầm Thị Uyên;;Lò Thị Thanh
ĐIÊU THỊ PHÓNG,,60,Thủy châm,01/07/2026 16:56:00,01/07/2026 17:21:00,Vũ Thị Hương Lan;;Lò Thị Thanh
VŨ THỊ CẢNH,,62,Thủy châm,01/07/2026 17:03:00,01/07/2026 17:28:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
`;

fs.writeFileSync('./scripts/full_july_raw.csv', part1);
console.log("Written part 1, length:", part1.length);
