// Part 1: 01/08 to 10/08
const chunk1 = `
ĐOÀN NGỌC MINH,75,,01/08/2026 16:05:00,01/08/2026 16:30:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐOÀN NGỌC MINH,75,,01/08/2026 16:31:00,01/08/2026 16:56:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐÈO VĂN SINH,61,,01/08/2026 16:12:00,01/08/2026 16:37:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐÈO VĂN SINH,61,,01/08/2026 16:38:00,01/08/2026 17:03:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN NHƯỢNG,62,,01/08/2026 14:41:00,01/08/2026 15:06:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN NHƯỢNG,62,,01/08/2026 15:10:00,01/08/2026 15:35:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
VŨ THỊ BÍCH NHƯỢNG,,73,01/08/2026 15:59:00,01/08/2026 16:24:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
VŨ THỊ BÍCH NHƯỢNG,,73,01/08/2026 16:33:00,01/08/2026 16:58:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐINH THỊ SỰ,,65,01/08/2026 08:26:00,01/08/2026 08:51:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐINH THỊ SỰ,,65,01/08/2026 08:58:00,01/08/2026 09:23:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
NGUYỄN VĂN CHI,78,,01/08/2026 14:33:00,01/08/2026 15:03:00,Vũ Thúy Hà;
NGUYỄN VĂN CHI,78,,01/08/2026 16:06:00,01/08/2026 16:31:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
NGUYỄN VĂN CHI,78,,01/08/2026 16:40:00,01/08/2026 17:05:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
BẠC CẦM NA,79,,01/08/2026 14:02:00,01/08/2026 14:32:00,Vũ Thúy Hà;
BẠC CẦM NA,79,,01/08/2026 14:42:00,01/08/2026 15:07:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
BẠC CẦM NA,79,,01/08/2026 15:51:00,01/08/2026 16:16:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ HIỆN,,62,01/08/2026 07:55:00,01/08/2026 08:20:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ THỊ HIỆN,,62,01/08/2026 08:40:00,01/08/2026 09:05:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
TRẦN THỊ THÀNH,,72,01/08/2026 09:05:00,01/08/2026 09:30:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
TRẦN THỊ THÀNH,,72,01/08/2026 09:36:00,01/08/2026 10:01:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐÀO VĂN PHÚ,67,,01/08/2026 10:15:00,01/08/2026 10:40:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐÀO VĂN PHÚ,67,,01/08/2026 10:46:00,01/08/2026 11:11:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ HIÊN,,62,01/08/2026 07:58:00,01/08/2026 08:28:00,Vũ Thúy Hà;
CÀ THỊ HIÊN,,62,01/08/2026 09:01:00,01/08/2026 09:26:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ VĂN È,64,,01/08/2026 13:52:00,01/08/2026 14:17:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ VĂN È,64,,01/08/2026 14:21:00,01/08/2026 14:46:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ VĂN È,64,,01/08/2026 16:54:00,01/08/2026 17:24:00,Nguyễn Thị Huyền Trang;
LÒ THỊ HUẤN,,66,01/08/2026 07:58:00,01/08/2026 08:23:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ HUẤN,,66,01/08/2026 08:29:00,01/08/2026 08:59:00,Vũ Thúy Hà;
ĐINH THỊ CHAU,,75,01/08/2026 08:47:00,01/08/2026 09:12:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐINH THỊ CHAU,,75,01/08/2026 10:06:00,01/08/2026 10:36:00,Vũ Thúy Hà;
ĐINH THỊ DÀNH,,56,01/08/2026 13:31:00,01/08/2026 13:56:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
ĐINH THỊ DÀNH,,56,01/08/2026 14:00:00,01/08/2026 14:25:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐINH THỊ DÀNH,,56,01/08/2026 16:58:00,01/08/2026 17:28:00,Cà Thị Oanh;
PHẠM VĂN DƯỢC,81,,01/08/2026 13:31:00,01/08/2026 14:01:00,Vũ Thúy Hà;
PHẠM VĂN DƯỢC,81,,01/08/2026 16:13:00,01/08/2026 16:38:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
PHẠM VĂN DƯỢC,81,,01/08/2026 16:47:00,01/08/2026 17:12:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CHU VĂN VƯỜNG,66,,01/08/2026 10:53:00,01/08/2026 11:18:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN TIỂN,55,,01/08/2026 14:35:00,01/08/2026 15:00:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN TIỂN,55,,01/08/2026 15:02:00,01/08/2026 15:27:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN TIỂN,55,,01/08/2026 15:35:00,01/08/2026 16:05:00,Vũ Thúy Hà;
LÒ THỊ NGHĨA,,46,01/08/2026 15:04:00,01/08/2026 15:34:00,Vũ Thúy Hà;
LÒ THỊ NGHĨA,,46,01/08/2026 16:26:00,01/08/2026 16:51:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ NGHĨA,,46,01/08/2026 16:52:00,01/08/2026 17:17:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HOÀNG THỊ LƯU,,67,01/08/2026 08:02:00,01/08/2026 08:27:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HOÀNG THỊ LƯU,,67,01/08/2026 08:54:00,01/08/2026 09:19:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
HOÀNG THỊ LƯU,,67,01/08/2026 10:37:00,01/08/2026 11:07:00,Vũ Thúy Hà;
LÒ VĂN THÂN,63,,01/08/2026 13:38:00,01/08/2026 14:03:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN THÂN,63,,01/08/2026 14:07:00,01/08/2026 14:32:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN THÂN,63,,01/08/2026 16:06:00,01/08/2026 16:36:00,Vũ Thúy Hà;
TÒNG THỊ THƯỞNG,,59,01/08/2026 15:09:00,01/08/2026 15:34:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
TÒNG THỊ THƯỞNG,,59,01/08/2026 15:38:00,01/08/2026 16:03:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
TÒNG THỊ THƯỞNG,,59,01/08/2026 16:37:00,01/08/2026 17:07:00,Vũ Thúy Hà;
BÙI THỊ NHẬT,,73,01/08/2026 08:05:00,01/08/2026 08:30:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
BÙI THỊ NHẬT,,73,01/08/2026 08:37:00,01/08/2026 09:02:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HÀ THỊ THIỀN,,66,01/08/2026 13:53:00,01/08/2026 14:18:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HÀ THỊ THIỀN,,66,01/08/2026 14:27:00,01/08/2026 14:52:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,01/08/2026 09:50:00,01/08/2026 10:15:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,01/08/2026 10:22:00,01/08/2026 10:47:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
VÌ THỊ ẤU,,67,01/08/2026 14:48:00,01/08/2026 15:13:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
VÌ THỊ ẤU,,67,01/08/2026 15:17:00,01/08/2026 15:42:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ VĂN TÍNH,62,,01/08/2026 07:51:00,01/08/2026 08:16:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ VĂN TÍNH,62,,01/08/2026 08:23:00,01/08/2026 08:48:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
QUÀNG THỊ BINH,,60,01/08/2026 07:44:00,01/08/2026 08:09:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
QUÀNG THỊ BINH,,60,01/08/2026 08:16:00,01/08/2026 08:41:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ HIỀN,,51,01/08/2026 08:29:00,01/08/2026 08:54:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ HIỀN,,51,01/08/2026 09:22:00,01/08/2026 09:47:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ CHUYÊN,,51,01/08/2026 14:13:00,01/08/2026 14:38:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ CHUYÊN,,51,01/08/2026 15:31:00,01/08/2026 15:56:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
TÒNG VĂN TỐI,67,,01/08/2026 16:19:00,01/08/2026 16:44:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
TÒNG VĂN TỐI,67,,01/08/2026 16:45:00,01/08/2026 17:10:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐIÊU THỊ PHÁ,,62,01/08/2026 13:46:00,01/08/2026 14:11:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
ĐIÊU THỊ PHÁ,,62,01/08/2026 14:34:00,01/08/2026 14:59:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LƯU THỊ DI,,91,01/08/2026 08:12:00,01/08/2026 08:37:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ SƠN,,61,01/08/2026 09:57:00,01/08/2026 10:22:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ SƠN,,61,01/08/2026 10:43:00,01/08/2026 11:08:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ THỊ ĐOÀN,,48,01/08/2026 09:29:00,01/08/2026 09:54:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ ĐOÀN,,48,01/08/2026 10:57:00,01/08/2026 11:22:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN LOAN,54,,01/08/2026 09:47:00,01/08/2026 10:12:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN LOAN,54,,01/08/2026 10:18:00,01/08/2026 10:43:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
BÀN THỊ XINH,,48,01/08/2026 08:19:00,01/08/2026 08:44:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
BÀN THỊ XINH,,48,01/08/2026 08:51:00,01/08/2026 09:16:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ THỊ CONG,,46,01/08/2026 13:45:00,01/08/2026 14:10:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ CONG,,46,01/08/2026 14:14:00,01/08/2026 14:39:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LƯỜNG THỊ THUẬN,,43,01/08/2026 09:54:00,01/08/2026 10:19:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LƯỜNG THỊ THUẬN,,43,01/08/2026 10:25:00,01/08/2026 10:50:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ THOẠI,,45,01/08/2026 10:01:00,01/08/2026 10:26:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ THOẠI,,45,01/08/2026 10:32:00,01/08/2026 10:57:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN NIÊN,49,,01/08/2026 10:04:00,01/08/2026 10:29:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN NIÊN,49,,01/08/2026 10:36:00,01/08/2026 11:01:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
VÀNG A PÁO,71,,01/08/2026 09:35:00,01/08/2026 10:05:00,Vũ Thúy Hà;
VÀNG A PÁO,71,,01/08/2026 11:04:00,01/08/2026 11:29:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
SỒNG THỊ CHA,,62,01/08/2026 13:32:00,01/08/2026 13:57:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
SỒNG THỊ CHA,,62,01/08/2026 13:59:00,01/08/2026 14:24:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ LIÊU,,46,01/08/2026 15:03:00,01/08/2026 15:28:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ LIÊU,,46,01/08/2026 15:30:00,01/08/2026 15:55:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ TẦM,,72,01/08/2026 13:39:00,01/08/2026 14:04:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
NGUYỄN THỊ TẦM,,72,01/08/2026 14:06:00,01/08/2026 14:31:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
PHẠM THỊ PHỨC,,84,01/08/2026 15:23:00,01/08/2026 15:48:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
PHẠM THỊ PHỨC,,84,01/08/2026 15:52:00,01/08/2026 16:17:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
NGÔ THỊ VẺ,,78,01/08/2026 15:16:00,01/08/2026 15:41:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGÔ THỊ VẺ,,78,01/08/2026 15:45:00,01/08/2026 16:10:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN PÁNH,70,,01/08/2026 14:28:00,01/08/2026 14:53:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN PÁNH,70,,01/08/2026 14:55:00,01/08/2026 15:20:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ TÁM,,84,01/08/2026 14:20:00,01/08/2026 14:45:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ TÁM,,84,01/08/2026 15:24:00,01/08/2026 15:49:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ VĂN PÒ,55,,01/08/2026 09:40:00,01/08/2026 10:05:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
CÀ VĂN PÒ,55,,01/08/2026 10:11:00,01/08/2026 10:36:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
TÒNG THỊ ĐỊNH,,70,01/08/2026 15:58:00,01/08/2026 16:23:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
TÒNG THỊ ĐỊNH,,70,01/08/2026 16:24:00,01/08/2026 16:49:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ MUÔN,,65,01/08/2026 14:49:00,01/08/2026 15:14:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ THỊ MUÔN,,65,01/08/2026 15:44:00,01/08/2026 16:09:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN DÂU,52,,01/08/2026 08:44:00,01/08/2026 09:09:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN DÂU,52,,01/08/2026 09:15:00,01/08/2026 09:40:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
HÀ VĂN PHÁT,68,,01/08/2026 09:33:00,01/08/2026 09:58:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HÀ VĂN PHÁT,68,,01/08/2026 11:00:00,01/08/2026 11:25:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
HÀ VĂN HUẤN,55,,01/08/2026 09:12:00,01/08/2026 09:37:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
HÀ VĂN HUẤN,55,,01/08/2026 09:43:00,01/08/2026 10:08:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN BÓNG,67,,01/08/2026 14:56:00,01/08/2026 15:21:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN BÓNG,67,,01/08/2026 15:37:00,01/08/2026 16:02:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LƯỜNG THỊ LỰA,,71,01/08/2026 09:24:00,01/08/2026 09:49:00,Nguyễn Tùng Lâm;;Lê Hương Giang;Vũ Thúy Hà
LƯỜNG THỊ LỰA,,71,01/08/2026 10:29:00,01/08/2026 10:54:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
QUÀNG THỊ SÁCH,,47,01/08/2026 10:08:00,01/08/2026 10:33:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
QUÀNG THỊ SÁCH,,47,01/08/2026 10:39:00,01/08/2026 11:04:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN KHÁNH,57,,01/08/2026 08:09:00,01/08/2026 08:34:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN KHÁNH,57,,01/08/2026 09:08:00,01/08/2026 09:33:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ THOAI,,41,01/08/2026 08:33:00,01/08/2026 08:58:00,Nguyễn Thị Huyền Trang;;Lê Hương Giang;Nguyễn Quang Huy
CÀ THỊ THOAI,,41,01/08/2026 09:26:00,01/08/2026 09:51:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
,,,,,
ĐOÀN NGỌC MINH,75,,02/08/2026 16:05:00,02/08/2026 16:30:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐOÀN NGỌC MINH,75,,02/08/2026 16:31:00,02/08/2026 16:56:00,Vũ Thị Hương Lan;;Cà Thị Oanh
ĐÈO VĂN SINH,61,,02/08/2026 16:12:00,02/08/2026 16:37:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐÈO VĂN SINH,61,,02/08/2026 16:38:00,02/08/2026 17:03:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN NHƯỢNG,62,,02/08/2026 14:41:00,02/08/2026 15:06:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN NHƯỢNG,62,,02/08/2026 15:10:00,02/08/2026 15:35:00,Vũ Thị Hương Lan;;Cà Thị Oanh
VŨ THỊ BÍCH NHƯỢNG,,73,02/08/2026 15:59:00,02/08/2026 16:24:00,Vũ Thị Hương Lan;;Cà Thị Oanh
VŨ THỊ BÍCH NHƯỢNG,,73,02/08/2026 16:33:00,02/08/2026 16:58:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐINH THỊ SỰ,,65,02/08/2026 08:26:00,02/08/2026 08:51:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐINH THỊ SỰ,,65,02/08/2026 08:58:00,02/08/2026 09:23:00,Vũ Thị Hương Lan;;Cà Thị Oanh
NGUYỄN VĂN CHI,78,,02/08/2026 14:33:00,02/08/2026 15:03:00,Bùi Thị Thu Hà;
NGUYỄN VĂN CHI,78,,02/08/2026 16:06:00,02/08/2026 16:31:00,Vũ Thị Hương Lan;;Cà Thị Oanh
NGUYỄN VĂN CHI,78,,02/08/2026 16:40:00,02/08/2026 17:05:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
BẠC CẦM NA,79,,02/08/2026 14:02:00,02/08/2026 14:32:00,Bùi Thị Thu Hà;
BẠC CẦM NA,79,,02/08/2026 14:42:00,02/08/2026 15:07:00,Vũ Thị Hương Lan;;Cà Thị Oanh
BẠC CẦM NA,79,,02/08/2026 15:51:00,02/08/2026 16:16:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ HIỆN,,62,02/08/2026 07:55:00,02/08/2026 08:20:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ THỊ HIỆN,,62,02/08/2026 08:40:00,02/08/2026 09:05:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
TRẦN THỊ THÀNH,,72,02/08/2026 09:05:00,02/08/2026 09:30:00,Vũ Thị Hương Lan;;Cà Thị Oanh
TRẦN THỊ THÀNH,,72,02/08/2026 09:36:00,02/08/2026 10:01:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐÀO VĂN PHÚ,67,,02/08/2026 10:15:00,02/08/2026 10:40:00,Vũ Thị Hương Lan;;Cà Thị Oanh
ĐÀO VĂN PHÚ,67,,02/08/2026 10:46:00,02/08/2026 11:11:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ HIÊN,,62,02/08/2026 07:58:00,02/08/2026 08:28:00,Bùi Thị Thu Hà;
CÀ THỊ HIÊN,,62,02/08/2026 09:01:00,02/08/2026 09:26:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ VĂN È,64,,02/08/2026 13:52:00,02/08/2026 14:17:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ VĂN È,64,,02/08/2026 14:21:00,02/08/2026 14:46:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ VĂN È,64,,02/08/2026 16:54:00,02/08/2026 17:24:00,Nguyễn Thị Huyền Trang;
LÒ THỊ HUẤN,,66,02/08/2026 07:58:00,02/08/2026 08:23:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ HUẤN,,66,02/08/2026 08:29:00,02/08/2026 08:59:00,Bùi Thị Thu Hà;
ĐINH THỊ CHAU,,75,02/08/2026 08:47:00,02/08/2026 09:12:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐINH THỊ CHAU,,75,02/08/2026 10:06:00,02/08/2026 10:36:00,Bùi Thị Thu Hà;
ĐINH THỊ DÀNH,,56,02/08/2026 13:31:00,02/08/2026 13:56:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
ĐINH THỊ DÀNH,,56,02/08/2026 14:00:00,02/08/2026 14:25:00,Vũ Thị Hương Lan;;Cà Thị Oanh
ĐINH THỊ DÀNH,,56,02/08/2026 16:58:00,02/08/2026 17:28:00,Cà Thị Oanh;
PHẠM VĂN DƯỢC,81,,02/08/2026 13:31:00,02/08/2026 14:01:00,Bùi Thị Thu Hà;
PHẠM VĂN DƯỢC,81,,02/08/2026 16:13:00,02/08/2026 16:38:00,Vũ Thị Hương Lan;;Cà Thị Oanh
PHẠM VĂN DƯỢC,81,,02/08/2026 16:47:00,02/08/2026 17:12:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CHU VĂN VƯỜNG,66,,02/08/2026 10:53:00,02/08/2026 11:18:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN TIỂN,55,,02/08/2026 14:35:00,02/08/2026 15:00:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN TIỂN,55,,02/08/2026 15:02:00,02/08/2026 15:27:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN TIỂN,55,,02/08/2026 15:35:00,02/08/2026 16:05:00,Bùi Thị Thu Hà;
LÒ THỊ NGHĨA,,46,02/08/2026 15:04:00,02/08/2026 15:34:00,Bùi Thị Thu Hà;
LÒ THỊ NGHĨA,,46,02/08/2026 16:26:00,02/08/2026 16:51:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ NGHĨA,,46,02/08/2026 16:52:00,02/08/2026 17:17:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HOÀNG THỊ LƯU,,67,02/08/2026 08:02:00,02/08/2026 08:27:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HOÀNG THỊ LƯU,,67,02/08/2026 08:54:00,02/08/2026 09:19:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
HOÀNG THỊ LƯU,,67,02/08/2026 10:37:00,02/08/2026 11:07:00,Bùi Thị Thu Hà;
LÒ VĂN THÂN,63,,02/08/2026 13:38:00,02/08/2026 14:03:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN THÂN,63,,02/08/2026 14:07:00,02/08/2026 14:32:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN THÂN,63,,02/08/2026 16:06:00,02/08/2026 16:36:00,Bùi Thị Thu Hà;
TÒNG THỊ THƯỞNG,,59,02/08/2026 15:09:00,02/08/2026 15:34:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
TÒNG THỊ THƯỞNG,,59,02/08/2026 15:38:00,02/08/2026 16:03:00,Vũ Thị Hương Lan;;Cà Thị Oanh
TÒNG THỊ THƯỞNG,,59,02/08/2026 16:37:00,02/08/2026 17:07:00,Bùi Thị Thu Hà;
BÙI THỊ NHẬT,,73,02/08/2026 08:05:00,02/08/2026 08:30:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
BÙI THỊ NHẬT,,73,02/08/2026 08:37:00,02/08/2026 09:02:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HÀ THỊ THIỀN,,66,02/08/2026 13:53:00,02/08/2026 14:18:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HÀ THỊ THIỀN,,66,02/08/2026 14:27:00,02/08/2026 14:52:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,02/08/2026 09:50:00,02/08/2026 10:15:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,02/08/2026 10:22:00,02/08/2026 10:47:00,Vũ Thị Hương Lan;;Cà Thị Oanh
VÌ THỊ ẤU,,67,02/08/2026 14:48:00,02/08/2026 15:13:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
VÌ THỊ ẤU,,67,02/08/2026 15:17:00,02/08/2026 15:42:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ VĂN TÍNH,62,,02/08/2026 07:51:00,02/08/2026 08:16:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ VĂN TÍNH,62,,02/08/2026 08:23:00,02/08/2026 08:48:00,Vũ Thị Hương Lan;;Cà Thị Oanh
QUÀNG THỊ BINH,,60,02/08/2026 07:44:00,02/08/2026 08:09:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
QUÀNG THỊ BINH,,60,02/08/2026 08:16:00,02/08/2026 08:41:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ HIỀN,,51,02/08/2026 08:29:00,02/08/2026 08:54:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ HIỀN,,51,02/08/2026 09:22:00,02/08/2026 09:47:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ CHUYÊN,,51,02/08/2026 14:13:00,02/08/2026 14:38:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ CHUYÊN,,51,02/08/2026 15:31:00,02/08/2026 15:56:00,Vũ Thị Hương Lan;;Cà Thị Oanh
TÒNG VĂN TỐI,67,,02/08/2026 16:19:00,02/08/2026 16:44:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
TÒNG VĂN TỐI,67,,02/08/2026 16:45:00,02/08/2026 17:10:00,Vũ Thị Hương Lan;;Cà Thị Oanh
ĐIÊU THỊ PHÁ,,62,02/08/2026 13:46:00,02/08/2026 14:11:00,Vũ Thị Hương Lan;;Cà Thị Oanh
ĐIÊU THỊ PHÁ,,62,02/08/2026 14:34:00,02/08/2026 14:59:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LƯU THỊ DI,,91,02/08/2026 08:12:00,02/08/2026 08:37:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGUYỄN THỊ SƠN,,61,02/08/2026 09:57:00,02/08/2026 10:22:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGUYỄN THỊ SƠN,,61,02/08/2026 10:43:00,02/08/2026 11:08:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ THỊ ĐOÀN,,48,02/08/2026 09:29:00,02/08/2026 09:54:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ ĐOÀN,,48,02/08/2026 10:57:00,02/08/2026 11:22:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN LOAN,54,,02/08/2026 09:47:00,02/08/2026 10:12:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN LOAN,54,,02/08/2026 10:18:00,02/08/2026 10:43:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
BÀN THỊ XINH,,48,02/08/2026 08:19:00,02/08/2026 08:44:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
BÀN THỊ XINH,,48,02/08/2026 08:51:00,02/08/2026 09:16:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ THỊ CONG,,46,02/08/2026 13:45:00,02/08/2026 14:10:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ CONG,,46,02/08/2026 14:14:00,02/08/2026 14:39:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LƯỜNG THỊ THUẬN,,43,02/08/2026 09:54:00,02/08/2026 10:19:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LƯỜNG THỊ THUẬN,,43,02/08/2026 10:25:00,02/08/2026 10:50:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ THOẠI,,45,02/08/2026 10:01:00,02/08/2026 10:26:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ THOẠI,,45,02/08/2026 10:32:00,02/08/2026 10:57:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN NIÊN,49,,02/08/2026 10:04:00,02/08/2026 10:29:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN NIÊN,49,,02/08/2026 10:36:00,02/08/2026 11:01:00,Vũ Thị Hương Lan;;Cà Thị Oanh
VÀNG A PÁO,71,,02/08/2026 09:35:00,02/08/2026 10:05:00,Bùi Thị Thu Hà;
VÀNG A PÁO,71,,02/08/2026 11:04:00,02/08/2026 11:29:00,Vũ Thị Hương Lan;;Cà Thị Oanh
SỒNG THỊ CHA,,62,02/08/2026 13:32:00,02/08/2026 13:57:00,Vũ Thị Hương Lan;;Cà Thị Oanh
SỒNG THỊ CHA,,62,02/08/2026 13:59:00,02/08/2026 14:24:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ THỊ LIÊU,,46,02/08/2026 15:03:00,02/08/2026 15:28:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ LIÊU,,46,02/08/2026 15:30:00,02/08/2026 15:55:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGUYỄN THỊ TẦM,,72,02/08/2026 13:39:00,02/08/2026 14:04:00,Vũ Thị Hương Lan;;Cà Thị Oanh
NGUYỄN THỊ TẦM,,72,02/08/2026 14:06:00,02/08/2026 14:31:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
PHẠM THỊ PHỨC,,84,02/08/2026 15:23:00,02/08/2026 15:48:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
PHẠM THỊ PHỨC,,84,02/08/2026 15:52:00,02/08/2026 16:17:00,Vũ Thị Hương Lan;;Cà Thị Oanh
NGÔ THỊ VẺ,,78,02/08/2026 15:16:00,02/08/2026 15:41:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGÔ THỊ VẺ,,78,02/08/2026 15:45:00,02/08/2026 16:10:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN PÁNH,70,,02/08/2026 14:28:00,02/08/2026 14:53:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN PÁNH,70,,02/08/2026 14:55:00,02/08/2026 15:20:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGUYỄN THỊ TÁM,,84,02/08/2026 14:20:00,02/08/2026 14:45:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
NGUYỄN THỊ TÁM,,84,02/08/2026 15:24:00,02/08/2026 15:49:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ VĂN PÒ,55,,02/08/2026 09:40:00,02/08/2026 10:05:00,Vũ Thị Hương Lan;;Cà Thị Oanh
CÀ VĂN PÒ,55,,02/08/2026 10:11:00,02/08/2026 10:36:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
TÒNG THỊ ĐỊNH,,70,02/08/2026 15:58:00,02/08/2026 16:23:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
TÒNG THỊ ĐỊNH,,70,02/08/2026 16:24:00,02/08/2026 16:49:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ MUÔN,,65,02/08/2026 14:49:00,02/08/2026 15:14:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ THỊ MUÔN,,65,02/08/2026 15:44:00,02/08/2026 16:09:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN DÂU,52,,02/08/2026 08:44:00,02/08/2026 09:09:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN DÂU,52,,02/08/2026 09:15:00,02/08/2026 09:40:00,Nguyễn Thị Huyền Trang;;Nguyễn Quang Huy
HÀ VĂN PHÁT,68,,02/08/2026 09:33:00,02/08/2026 09:58:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HÀ VĂN PHÁT,68,,02/08/2026 11:00:00,02/08/2026 11:25:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
HÀ VĂN HUẤN,55,,02/08/2026 09:12:00,02/08/2026 09:37:00,Vũ Thị Hương Lan;;Cà Thị Oanh
HÀ VĂN HUẤN,55,,02/08/2026 09:43:00,02/08/2026 10:08:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN BÓNG,67,,02/08/2026 14:27:00,02/08/2026 14:52:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ VĂN BÓNG,67,,02/08/2026 15:37:00,02/08/2026 16:02:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LƯỜNG THỊ LỰA,,71,02/08/2026 09:24:00,02/08/2026 09:49:00,Vũ Thị Hương Lan;;Lò Hồng Hạnh;Bùi Thị Thu Hà
LƯỜNG THỊ LỰA,,71,02/08/2026 10:29:00,02/08/2026 10:54:00,Vũ Thị Hương Lan;;Cà Thị Oanh
QUÀNG THỊ SÁCH,,47,02/08/2026 10:08:00,02/08/2026 10:33:00,Vũ Thị Hương Lan;;Cà Thị Oanh
QUÀNG THỊ SÁCH,,47,02/08/2026 10:39:00,02/08/2026 11:04:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
LÒ VĂN KHÁNH,57,,02/08/2026 08:09:00,02/08/2026 08:34:00,Vũ Thị Hương Lan;;Cà Thị Oanh
LÒ VĂN KHÁNH,57,,02/08/2026 09:08:00,02/08/2026 09:33:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ THOAI,,41,02/08/2026 08:33:00,02/08/2026 08:58:00,Nguyễn Thị Huyền Trang;;Lò Hồng Hạnh;Nguyễn Quang Huy
CÀ THỊ THOAI,,41,02/08/2026 09:26:00,02/08/2026 09:51:00,Vũ Thị Hương Lan;;Cà Thị Oanh
,,,,,
ĐOÀN NGỌC MINH,75,,03/08/2026 13:38:00,03/08/2026 14:03:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐOÀN NGỌC MINH,75,,03/08/2026 15:08:00,03/08/2026 15:38:00,Vũ Thúy Hà;
ĐOÀN NGỌC MINH,75,,03/08/2026 15:51:00,03/08/2026 16:16:00,Cầm Thị Uyên;;Hoàng Thu Hương
ĐÈO VĂN SINH,61,,03/08/2026 16:26:00,03/08/2026 16:51:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐÈO VĂN SINH,61,,03/08/2026 17:01:00,03/08/2026 17:26:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN NHƯỢNG,62,,03/08/2026 14:55:00,03/08/2026 15:20:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN NHƯỢNG,62,,03/08/2026 15:23:00,03/08/2026 15:48:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
VŨ THỊ BÍCH NHƯỢNG,,73,03/08/2026 13:45:00,03/08/2026 14:10:00,Nguyễn Thị Huyền Trang;;Nguyễn Quang Huy;Hoàng Thu Hương
VŨ THỊ BÍCH NHƯỢNG,,73,03/08/2026 14:11:00,03/08/2026 14:36:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy
TÒNG VĂN NẾN,78,,03/08/2026 13:44:00,03/08/2026 14:09:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Lê Hương Giang
TÒNG VĂN NẾN,78,,03/08/2026 14:11:00,03/08/2026 14:36:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
ĐINH THỊ SỰ,,65,03/08/2026 10:15:00,03/08/2026 10:40:00,Cầm Thị Uyên;;Nguyễn Quang Huy
ĐINH THỊ SỰ,,65,03/08/2026 10:43:00,03/08/2026 11:08:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN VĂN CHI,78,,03/08/2026 09:31:00,03/08/2026 09:56:00,Vũ Thị Hương Lan;;Cà Thị Oanh
NGUYỄN VĂN CHI,78,,03/08/2026 14:41:00,03/08/2026 15:06:00,Nguyễn Thị Huyền Trang;;Nguyễn Quang Huy;Quàng Văn Hình
NGUYỄN VĂN CHI,78,,03/08/2026 15:50:00,03/08/2026 16:20:00,Vũ Thị Hương Lan;
VÌ VĂN MAY,65,,03/08/2026 10:06:00,03/08/2026 10:31:00,Vũ Thị Hương Lan;;Lò Thị Thanh;Quàng Văn Hình
VÌ VĂN MAY,65,,03/08/2026 14:32:00,03/08/2026 14:57:00,Nguyễn Tùng Lâm;;Lê Hương Giang
LÒ THỊ HÒA,,42,03/08/2026 15:36:00,03/08/2026 16:01:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Nguyễn Quang Huy
LÒ THỊ HÒA,,42,03/08/2026 16:02:00,03/08/2026 16:27:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
CÀ THỊ BIÊNG,,52,03/08/2026 13:57:00,03/08/2026 14:22:00,Cầm Thị Uyên;;Quàng Văn Hình;Nguyễn Quang Huy
CÀ THỊ BIÊNG,,52,03/08/2026 14:46:00,03/08/2026 15:11:00,Nguyễn Tùng Lâm;;Vũ Thúy Hà
QUÀNG THỊ BIÊNG,,70,03/08/2026 10:28:00,03/08/2026 10:53:00,Vũ Thị Hương Lan;;Hoàng Thu Hương;Lê Hương Giang
QUÀNG THỊ BIÊNG,,70,03/08/2026 14:25:00,03/08/2026 14:50:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LÒ VĂN LÓN,72,,03/08/2026 15:16:00,03/08/2026 15:41:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN LÓN,72,,03/08/2026 15:42:00,03/08/2026 16:07:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
BẠC CẦM NA,79,,03/08/2026 14:35:00,03/08/2026 15:05:00,Lò Thị Thanh;
BẠC CẦM NA,79,,03/08/2026 16:19:00,03/08/2026 16:44:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
BẠC CẦM NA,79,,03/08/2026 16:47:00,03/08/2026 17:12:00,Cầm Thị Uyên;;Hoàng Thu Hương
CÀ THỊ HIỆN,,62,03/08/2026 08:16:00,03/08/2026 08:41:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ THỊ HIỆN,,62,03/08/2026 09:15:00,03/08/2026 09:45:00,Lò Thị Thanh;
CÀ THỊ HIỆN,,62,03/08/2026 09:54:00,03/08/2026 10:19:00,Vũ Thị Hương Lan;;Cà Thị Oanh
QUÀNG THỊ ĐẠI,,67,03/08/2026 13:52:00,03/08/2026 14:17:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
QUÀNG THỊ ĐẠI,,67,03/08/2026 14:48:00,03/08/2026 15:13:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN THỊ GÁI,,76,03/08/2026 13:38:00,03/08/2026 14:03:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
NGUYỄN THỊ GÁI,,76,03/08/2026 14:30:00,03/08/2026 14:55:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Nguyễn Quang Huy
TRẦN THỊ THÀNH,,72,03/08/2026 08:44:00,03/08/2026 09:14:00,Lò Thị Thanh;
TRẦN THỊ THÀNH,,72,03/08/2026 09:19:00,03/08/2026 09:44:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
TRẦN THỊ THÀNH,,72,03/08/2026 10:42:00,03/08/2026 11:07:00,Vũ Thị Hương Lan;;Hoàng Thu Hương
ĐÀO VĂN PHÚ,67,,03/08/2026 09:54:00,03/08/2026 10:24:00,Vũ Thúy Hà;
ĐÀO VĂN PHÚ,67,,03/08/2026 10:29:00,03/08/2026 10:54:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
ĐÀO VĂN PHÚ,67,,03/08/2026 11:01:00,03/08/2026 11:26:00,Vũ Thị Hương Lan;;Hoàng Thu Hương;Nguyễn Quang Huy
CÀ THỊ HIÊN,,62,03/08/2026 10:36:00,03/08/2026 11:01:00,Cầm Thị Uyên;;Nguyễn Quang Huy
CÀ THỊ HIÊN,,62,03/08/2026 11:04:00,03/08/2026 11:29:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ VĂN È,64,,03/08/2026 15:08:00,03/08/2026 15:38:00,Cà Thị Oanh;
CÀ VĂN È,64,,03/08/2026 15:44:00,03/08/2026 16:09:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ VĂN È,64,,03/08/2026 16:40:00,03/08/2026 17:05:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ THỊ HUẤN,,66,03/08/2026 08:50:00,03/08/2026 09:20:00,Vũ Thúy Hà;
LÒ THỊ HUẤN,,66,03/08/2026 10:08:00,03/08/2026 10:33:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ HUẤN,,66,03/08/2026 10:36:00,03/08/2026 11:01:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
ĐINH THỊ CHAU,,75,03/08/2026 10:22:00,03/08/2026 10:47:00,Cầm Thị Uyên;;Nguyễn Quang Huy
ĐINH THỊ CHAU,,75,03/08/2026 10:50:00,03/08/2026 11:15:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐINH THỊ DÀNH,,56,03/08/2026 14:03:00,03/08/2026 14:33:00,Lò Thị Thanh;
ĐINH THỊ DÀNH,,56,03/08/2026 14:48:00,03/08/2026 15:13:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐINH THỊ DÀNH,,56,03/08/2026 15:16:00,03/08/2026 15:41:00,Cầm Thị Uyên;;Hoàng Thu Hương
PHẠM VĂN DƯỢC,81,,03/08/2026 13:31:00,03/08/2026 13:56:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
PHẠM VĂN DƯỢC,81,,03/08/2026 14:27:00,03/08/2026 14:52:00,Nguyễn Thị Huyền Trang;;Nguyễn Quang Huy;Quàng Văn Hình
PHẠM VĂN DƯỢC,81,,03/08/2026 15:38:00,03/08/2026 16:08:00,Lò Thị Thanh;
CHU VĂN VƯỜNG,66,,03/08/2026 08:23:00,03/08/2026 08:48:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CHU VĂN VƯỜNG,66,,03/08/2026 09:45:00,03/08/2026 10:10:00,Vũ Thị Hương Lan;;Hoàng Thu Hương
LÒ VĂN TIỂN,55,,03/08/2026 16:12:00,03/08/2026 16:37:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN TIỂN,55,,03/08/2026 16:40:00,03/08/2026 17:05:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ NGHĨA,,46,03/08/2026 13:31:00,03/08/2026 13:56:00,Nguyễn Thị Huyền Trang;;Hoàng Thu Hương;Nguyễn Quang Huy
LÒ THỊ NGHĨA,,46,03/08/2026 14:00:00,03/08/2026 14:25:00,Vũ Thị Hương Lan;;Hoàng Thu Hương
HOÀNG THỊ LƯU,,67,03/08/2026 09:21:00,03/08/2026 09:51:00,Vũ Thúy Hà;
HOÀNG THỊ LƯU,,67,03/08/2026 10:22:00,03/08/2026 10:47:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
HOÀNG THỊ LƯU,,67,03/08/2026 10:57:00,03/08/2026 11:22:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ VĂN THÂN,63,,03/08/2026 15:51:00,03/08/2026 16:16:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ VĂN THÂN,63,,03/08/2026 16:19:00,03/08/2026 16:44:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN THÂN,63,,03/08/2026 16:45:00,03/08/2026 17:15:00,Lò Thị Thanh;
TÒNG THỊ THƯỞNG,,59,03/08/2026 14:36:00,03/08/2026 15:06:00,Cà Thị Oanh;
TÒNG THỊ THƯỞNG,,59,03/08/2026 15:09:00,03/08/2026 15:34:00,Cầm Thị Uyên;;Hoàng Thu Hương
TÒNG THỊ THƯỞNG,,59,03/08/2026 15:37:00,03/08/2026 16:02:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
BÙI THỊ NHẬT,,73,03/08/2026 08:50:00,03/08/2026 09:20:00,Bùi Thị Thu Hà;
BÙI THỊ NHẬT,,73,03/08/2026 09:47:00,03/08/2026 10:12:00,Cầm Thị Uyên;;Nguyễn Quang Huy
BÙI THỊ NHẬT,,73,03/08/2026 10:15:00,03/08/2026 10:40:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
HÀ THỊ THIỀN,,66,03/08/2026 14:48:00,03/08/2026 15:13:00,Cầm Thị Uyên;;Hoàng Thu Hương
HÀ THỊ THIỀN,,66,03/08/2026 15:16:00,03/08/2026 15:41:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
HÀ THỊ THIỀN,,66,03/08/2026 16:12:00,03/08/2026 16:42:00,Cà Thị Oanh;
VÌ THỊ PHỨC,,69,03/08/2026 08:30:00,03/08/2026 08:55:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,03/08/2026 08:58:00,03/08/2026 09:23:00,Cầm Thị Uyên;;Lê Hương Giang;Nguyễn Quang Huy
VÌ THỊ PHỨC,,69,03/08/2026 10:25:00,03/08/2026 10:55:00,Bùi Thị Thu Hà;
VÌ THỊ ẤU,,67,03/08/2026 15:02:00,03/08/2026 15:27:00,Cầm Thị Uyên;;Hoàng Thu Hương
VÌ THỊ ẤU,,67,03/08/2026 15:30:00,03/08/2026 15:55:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
VÌ THỊ ẤU,,67,03/08/2026 16:45:00,03/08/2026 17:15:00,Cà Thị Oanh;
CÀ VĂN TÍNH,62,,03/08/2026 07:48:00,03/08/2026 08:18:00,Bùi Thị Thu Hà;
CÀ VĂN TÍNH,62,,03/08/2026 10:21:00,03/08/2026 10:46:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Lê Hương Giang
CÀ VĂN TÍNH,62,,03/08/2026 10:51:00,03/08/2026 11:16:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
QUÀNG THỊ BINH,,60,03/08/2026 07:47:00,03/08/2026 08:17:00,Vũ Thúy Hà;
QUÀNG THỊ BINH,,60,03/08/2026 08:18:00,03/08/2026 08:43:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Hoàng Thu Hương
QUÀNG THỊ BINH,,60,03/08/2026 10:29:00,03/08/2026 10:54:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ THỊ HIỀN,,51,03/08/2026 08:12:00,03/08/2026 08:42:00,Lò Thị Thanh;
LÒ THỊ HIỀN,,51,03/08/2026 09:12:00,03/08/2026 09:37:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ HIỀN,,51,03/08/2026 10:01:00,03/08/2026 10:26:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ THỊ CHUYÊN,,51,03/08/2026 16:05:00,03/08/2026 16:30:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ CHUYÊN,,51,03/08/2026 16:54:00,03/08/2026 17:19:00,Cầm Thị Uyên;;Nguyễn Quang Huy
TÒNG VĂN TỐI,67,,03/08/2026 14:13:00,03/08/2026 14:38:00,Cầm Thị Uyên;;Hoàng Thu Hương
TÒNG VĂN TỐI,67,,03/08/2026 16:33:00,03/08/2026 16:58:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
ĐIÊU THỊ PHÁ,,62,03/08/2026 15:44:00,03/08/2026 16:09:00,Cầm Thị Uyên;;Hoàng Thu Hương
ĐIÊU THỊ PHÁ,,62,03/08/2026 16:12:00,03/08/2026 16:37:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LƯU THỊ DI,,91,03/08/2026 08:19:00,03/08/2026 08:49:00,Bùi Thị Thu Hà;
LƯU THỊ DI,,91,03/08/2026 08:50:00,03/08/2026 09:15:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Lê Hương Giang
LƯU THỊ DI,,91,03/08/2026 09:40:00,03/08/2026 10:05:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
NGUYỄN THỊ SƠN,,61,03/08/2026 08:51:00,03/08/2026 09:16:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
NGUYỄN THỊ SƠN,,61,03/08/2026 09:26:00,03/08/2026 09:51:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN THỊ SƠN,,61,03/08/2026 10:04:00,03/08/2026 10:34:00,Cà Thị Oanh;
CÀ THỊ ĐOÀN,,48,03/08/2026 08:44:00,03/08/2026 09:09:00,Cầm Thị Uyên;;Lê Hương Giang;Quàng Văn Hình
CÀ THỊ ĐOÀN,,48,03/08/2026 10:43:00,03/08/2026 11:08:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ VĂN LOAN,54,,03/08/2026 08:44:00,03/08/2026 09:09:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
LÒ VĂN LOAN,54,,03/08/2026 09:12:00,03/08/2026 09:37:00,Cầm Thị Uyên;;Lê Hương Giang;Nguyễn Quang Huy
LÒ VĂN LOAN,54,,03/08/2026 10:58:00,03/08/2026 11:28:00,Vũ Thúy Hà;
BÀN THỊ XINH,,48,03/08/2026 10:08:00,03/08/2026 10:33:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
BÀN THỊ XINH,,48,03/08/2026 10:36:00,03/08/2026 11:01:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ THỊ CONG,,46,03/08/2026 14:04:00,03/08/2026 14:34:00,Vũ Thúy Hà;
CÀ THỊ CONG,,46,03/08/2026 14:55:00,03/08/2026 15:20:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
CÀ THỊ CONG,,46,03/08/2026 15:23:00,03/08/2026 15:48:00,Cầm Thị Uyên;;Hoàng Thu Hương
LƯỜNG THỊ THUẬN,,43,03/08/2026 08:27:00,03/08/2026 08:57:00,Cà Thị Oanh;
LƯỜNG THỊ THUẬN,,43,03/08/2026 09:07:00,03/08/2026 09:32:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Hoàng Thu Hương
LƯỜNG THỊ THUẬN,,43,03/08/2026 10:15:00,03/08/2026 10:40:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ THỊ THOẠI,,45,03/08/2026 08:31:00,03/08/2026 08:56:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ THỊ THOẠI,,45,03/08/2026 09:14:00,03/08/2026 09:39:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Hoàng Thu Hương
LÒ THỊ THOẠI,,45,03/08/2026 10:26:00,03/08/2026 10:56:00,Vũ Thúy Hà;
LÒ VĂN NIÊN,49,,03/08/2026 08:16:00,03/08/2026 08:41:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ VĂN NIÊN,49,,03/08/2026 09:33:00,03/08/2026 09:58:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ VĂN NIÊN,49,,03/08/2026 10:46:00,03/08/2026 11:16:00,Lò Thị Thanh;
VÀNG A PÁO,71,,03/08/2026 09:26:00,03/08/2026 09:51:00,Cầm Thị Uyên;;Hoàng Thu Hương;Nguyễn Quang Huy
VÀNG A PÁO,71,,03/08/2026 09:54:00,03/08/2026 10:19:00,Cầm Thị Uyên;;Nguyễn Quang Huy
SỒNG THỊ CHA,,62,03/08/2026 13:38:00,03/08/2026 14:03:00,Cầm Thị Uyên;;Hoàng Thu Hương
SỒNG THỊ CHA,,62,03/08/2026 15:58:00,03/08/2026 16:23:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
SỒNG THỊ CHA,,62,03/08/2026 16:24:00,03/08/2026 16:54:00,Vũ Thị Hương Lan;
LÒ THỊ LIÊU,,46,03/08/2026 13:52:00,03/08/2026 14:17:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ LIÊU,,46,03/08/2026 14:20:00,03/08/2026 14:45:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ THỊ LIÊU,,46,03/08/2026 16:12:00,03/08/2026 16:42:00,Vũ Thúy Hà;
NGUYỄN THỊ TẦM,,72,03/08/2026 13:32:00,03/08/2026 14:02:00,Cà Thị Oanh;
NGUYỄN THỊ TẦM,,72,03/08/2026 15:02:00,03/08/2026 15:27:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN THỊ TẦM,,72,03/08/2026 15:30:00,03/08/2026 15:55:00,Cầm Thị Uyên;;Hoàng Thu Hương
PHẠM THỊ PHỨC,,84,03/08/2026 14:06:00,03/08/2026 14:31:00,Cầm Thị Uyên;;Hoàng Thu Hương
PHẠM THỊ PHỨC,,84,03/08/2026 14:34:00,03/08/2026 14:59:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
PHẠM THỊ PHỨC,,84,03/08/2026 16:12:00,03/08/2026 16:42:00,Lò Thị Thanh;
NGÔ THỊ VẺ,,78,03/08/2026 13:31:00,03/08/2026 13:56:00,Cầm Thị Uyên;;Hoàng Thu Hương
NGÔ THỊ VẺ,,78,03/08/2026 14:20:00,03/08/2026 14:45:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGÔ THỊ VẺ,,78,03/08/2026 15:39:00,03/08/2026 16:09:00,Cà Thị Oanh;
LÒ VĂN PÁNH,70,,03/08/2026 14:34:00,03/08/2026 14:59:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN PÁNH,70,,03/08/2026 17:01:00,03/08/2026 17:26:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN THỊ TÁM,,84,03/08/2026 14:04:00,03/08/2026 14:34:00,Cà Thị Oanh;
NGUYỄN THỊ TÁM,,84,03/08/2026 15:09:00,03/08/2026 15:34:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
NGUYỄN THỊ TÁM,,84,03/08/2026 15:37:00,03/08/2026 16:02:00,Cầm Thị Uyên;;Hoàng Thu Hương
CÀ VĂN PÒ,55,,03/08/2026 09:05:00,03/08/2026 09:30:00,Cầm Thị Uyên;;Hoàng Thu Hương;Nguyễn Quang Huy
CÀ VĂN PÒ,55,,03/08/2026 10:08:00,03/08/2026 10:33:00,Cầm Thị Uyên;;Nguyễn Quang Huy
CÀ VĂN PÒ,55,,03/08/2026 10:37:00,03/08/2026 11:07:00,Cà Thị Oanh;
TÒNG THỊ ĐỊNH,,70,03/08/2026 13:32:00,03/08/2026 14:02:00,Lò Thị Thanh;
TÒNG THỊ ĐỊNH,,70,03/08/2026 14:13:00,03/08/2026 14:38:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
TÒNG THỊ ĐỊNH,,70,03/08/2026 14:41:00,03/08/2026 15:06:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ THỊ MUÔN,,65,03/08/2026 14:06:00,03/08/2026 14:31:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ MUÔN,,65,03/08/2026 15:07:00,03/08/2026 15:37:00,Lò Thị Thanh;
LÒ THỊ MUÔN,,65,03/08/2026 15:58:00,03/08/2026 16:23:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
LÒ VĂN DÂU,52,,03/08/2026 08:37:00,03/08/2026 09:02:00,Cầm Thị Uyên;;Hoàng Thu Hương;Quàng Văn Hình
LÒ VĂN DÂU,52,,03/08/2026 09:47:00,03/08/2026 10:17:00,Lò Thị Thanh;
LÒ VĂN DÂU,52,,03/08/2026 11:04:00,03/08/2026 11:29:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
HÀ VĂN PHÁT,68,,03/08/2026 08:42:00,03/08/2026 09:07:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Lê Hương Giang
HÀ VĂN PHÁT,68,,03/08/2026 09:33:00,03/08/2026 09:58:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
HÀ VĂN PHÁT,68,,03/08/2026 10:57:00,03/08/2026 11:27:00,Bùi Thị Thu Hà;
HÀ VĂN HUẤN,55,,03/08/2026 08:24:00,03/08/2026 08:49:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
HÀ VĂN HUẤN,55,,03/08/2026 08:51:00,03/08/2026 09:16:00,Cầm Thị Uyên;;Lê Hương Giang;Nguyễn Quang Huy
HÀ VĂN HUẤN,55,,03/08/2026 09:22:00,03/08/2026 09:52:00,Bùi Thị Thu Hà;
LÒ VĂN BÓNG,67,,03/08/2026 13:59:00,03/08/2026 14:24:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ VĂN BÓNG,67,,03/08/2026 14:27:00,03/08/2026 14:52:00,Cầm Thị Uyên;;Hoàng Thu Hương
LÒ VĂN BÓNG,67,,03/08/2026 16:45:00,03/08/2026 17:15:00,Vũ Thúy Hà;
LƯỜNG THỊ LỰA,,71,03/08/2026 09:00:00,03/08/2026 09:25:00,Vũ Thị Hương Lan;;Hoàng Thu Hương;Cà Thị Oanh
LƯỜNG THỊ LỰA,,71,03/08/2026 10:01:00,03/08/2026 10:26:00,Cầm Thị Uyên;;Nguyễn Quang Huy
QUÀNG THỊ SÁCH,,47,03/08/2026 08:19:00,03/08/2026 08:49:00,Vũ Thúy Hà;
QUÀNG THỊ SÁCH,,47,03/08/2026 09:19:00,03/08/2026 09:44:00,Cầm Thị Uyên;;Hoàng Thu Hương;Nguyễn Quang Huy
QUÀNG THỊ SÁCH,,47,03/08/2026 10:49:00,03/08/2026 11:14:00,Cầm Thị Uyên;;Nguyễn Quang Huy
LÒ VĂN KHÁNH,57,,03/08/2026 08:30:00,03/08/2026 08:55:00,Cầm Thị Uyên;;Nguyễn Quang Huy;Quàng Văn Hình
LÒ VĂN KHÁNH,57,,03/08/2026 08:58:00,03/08/2026 09:23:00,Nguyễn Tùng Lâm;;Cà Thị Oanh
LÒ VĂN KHÁNH,57,,03/08/2026 09:53:00,03/08/2026 10:23:00,Bùi Thị Thu Hà;
CÀ THỊ THOAI,,41,03/08/2026 13:45:00,03/08/2026 14:10:00,Cầm Thị Uyên;;Nguyễn Quang Huy
CÀ THỊ THOAI,,41,03/08/2026 16:48:00,03/08/2026 17:13:00,Nguyễn Thị Huyền Trang;;Quàng Văn Hình;Lê Hương Giang
LÒ THỊ MAY,,71,03/08/2026 15:09:00,03/08/2026 15:34:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
LÒ THỊ MAY,,71,03/08/2026 15:35:00,03/08/2026 16:00:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LÙ THỊ HỰT,,52,03/08/2026 14:53:00,03/08/2026 15:18:00,Nguyễn Tùng Lâm;;Vũ Thúy Hà
LÙ THỊ HỰT,,52,03/08/2026 15:43:00,03/08/2026 16:08:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Vũ Thúy Hà
NGUYỄN THỊ TÂM,,72,03/08/2026 09:43:00,03/08/2026 10:08:00,Cầm Thị Uyên;;Lê Hương Giang;Cà Thị Oanh
NGUYỄN THỊ TÂM,,72,03/08/2026 16:37:00,03/08/2026 17:02:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
CAO THỊ NHÂM,,84,03/08/2026 15:02:00,03/08/2026 15:27:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
CAO THỊ NHÂM,,84,03/08/2026 16:53:00,03/08/2026 17:18:00,Nguyễn Tùng Lâm;;Hoàng Thu Hương
QUÀNG THỊ PIÊNG,,72,03/08/2026 14:18:00,03/08/2026 14:43:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
QUÀNG THỊ PIÊNG,,72,03/08/2026 14:55:00,03/08/2026 15:20:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
QUÀNG THỊ XƯƠNG,,62,03/08/2026 13:31:00,03/08/2026 13:56:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Lê Hương Giang
QUÀNG THỊ XƯƠNG,,62,03/08/2026 16:23:00,03/08/2026 16:48:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
QUÀNG THỊ ĐỊNH,,57,03/08/2026 09:43:00,03/08/2026 10:08:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Lê Hương Giang
QUÀNG THỊ ĐỊNH,,57,03/08/2026 16:30:00,03/08/2026 16:55:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
ĐÀM ĐĂNG TỰ,92,,03/08/2026 10:35:00,03/08/2026 11:00:00,Vũ Thị Hương Lan;;Nguyễn Quang Huy;Lò Thị Thanh
ĐÀM ĐĂNG TỰ,92,,03/08/2026 16:16:00,03/08/2026 16:41:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
ĐÀM VĂN THIỆN,61,,03/08/2026 10:13:00,03/08/2026 10:38:00,Vũ Thị Hương Lan;;Lò Thị Thanh;Quàng Văn Hình
ĐÀM VĂN THIỆN,61,,03/08/2026 14:39:00,03/08/2026 15:04:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LÒ THỊ HẶC,,64,03/08/2026 13:45:00,03/08/2026 14:10:00,Nguyễn Tùng Lâm;;Quàng Văn Hình
LÒ THỊ HẶC,,64,03/08/2026 14:37:00,03/08/2026 15:02:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Nguyễn Quang Huy
NGUYỄN VĂN HIỀN,67,,03/08/2026 14:23:00,03/08/2026 14:48:00,Vũ Thị Hương Lan;;Lê Hương Giang;Nguyễn Quang Huy
NGUYỄN VĂN HIỀN,67,,03/08/2026 16:09:00,03/08/2026 16:34:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
LÒ VĂN BINH,47,,03/08/2026 15:27:00,03/08/2026 15:52:00,Vũ Thị Hương Lan;;Quàng Văn Hình;Nguyễn Quang Huy
LÒ VĂN BINH,47,,03/08/2026 15:53:00,03/08/2026 16:18:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
TÒNG THỊ HIÊNG,,67,03/08/2026 16:45:00,03/08/2026 17:10:00,Nguyễn Tùng Lâm;;Nguyễn Quang Huy
`;

module.exports = chunk1;
