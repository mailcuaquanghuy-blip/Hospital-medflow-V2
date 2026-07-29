# Hospital MedFlow - Hệ Thống Quản Lý Chỉ Định & Lịch Trình Y Tế

Hospital MedFlow là hệ thống quản lý lịch làm việc, ca thực hiện thủ thuật y tế, điểm danh nhân viên và theo dõi tiến độ thủ thuật cho các khoa phòng bệnh viện.

## 🚀 Tính năng chính

- **Quản lý Lịch hẹn & Thủ thuật**: Đặt lịch, theo dõi trạng thái ca thủ thuật, phân công bác sĩ/kỹ thuật viên.
- **Quản lý Nhân sự & Điểm danh**: Theo dõi ca làm việc, điểm danh hàng ngày của đội ngũ y tế.
- **Mẫu Thủ thuật (Templates)**: Quản lý danh mục bài tập, thủ thuật y tế.
- **Đồng bộ Dữ liệu Cloud**: Hỗ trợ kết nối Supabase và Firebase Firestore.

## 🛠️ Công nghệ sử dụng

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Motion.
- **Backend API**: Node.js / Express.
- **Database**: Supabase / Firestore.

## 💻 Hướng dẫn chạy cục bộ (Local Development)

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình biến môi trường
Tạo file `.env` từ file `.env.example`:
```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Chạy ứng dụng
```bash
npm run dev
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`
