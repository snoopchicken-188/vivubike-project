## Phân tích Nghiệp vụ (BA) - Phân hệ Quản lý (Business Manager / Admin)

 Chi tiết luồng nghiệp vụ (Use Case Specifications)

#### Use Case 1: Quản lý danh sách xe (CRUD Xe)
**Mô tả:** Quản lý xem toàn bộ trạng thái xe (giống Staff) và thực hiện các thao tác Thêm mới, Chỉnh sửa thông tin hoặc Xóa/Ẩn xe khỏi hệ thống.

**Luồng sự kiện chính:**
1. Quản lý truy cập vào trang "Quản lý danh mục xe".
2. Hệ thống hiển thị danh sách toàn bộ xe cùng trạng thái hiện tại (Đang đặt, Đã giao, Trống, Đang bảo dưỡng).
3. Tùy theo nhu cầu, Quản lý thực hiện các thao tác:
   * **Thêm xe mới:** Bấm "Thêm xe", điền thông tin (Tên xe, Biển số, Hãng, Loại xe, Giá thuê thực tế, Ảnh xe) và lưu lại.
   * **Sửa thông tin xe:** Chọn 1 xe có sẵn, cập nhật lại thông tin (VD: đổi ảnh, cập nhật tình trạng bảo dưỡng) và bấm lưu.
   * **Xóa/Ẩn xe:** Chọn 1 xe không còn khai thác, bấm "Xóa" hoặc "Ngừng hoạt động". Hệ thống sẽ ẩn xe này khỏi giao diện của khách hàng.
4. Hệ thống cập nhật dữ liệu mới nhất vào Database.

#### Use Case 2: Xem Báo cáo Thống kê (Dashboard Manager)
**Mô tả:** Quản lý theo dõi các chỉ số hiệu suất kinh doanh (KPI) và phân tích tệp khách hàng.

**Luồng sự kiện chính:**
1. Quản lý truy cập vào mục "Báo cáo Thống kê".
2. Quản lý chọn bộ lọc thời gian (Hôm nay, Tuần này, Tháng này, hoặc Tùy chọn).
3. Hệ thống truy xuất dữ liệu và hiển thị 3 khối thông tin chính:
   * **Thống kê Doanh thu:** Tổng số tiền thu được từ các phiếu thuê đã hoàn tất (Đã trả xe) trong khoảng thời gian đã chọn, hiển thị dưới dạng con số tổng và biểu đồ đường/cột.
   * **Thống kê Đơn hàng:** Tổng số đơn đặt xe thành công, số đơn bị hủy.
   * **Thống kê Khách hàng (Pie Chart):** Biểu đồ tròn thể hiện tỷ trọng: X% là Khách vãng lai, Y% là Khách đã đăng ký (Thành viên).
4. Quản lý có thể di chuột vào các biểu đồ để xem chi tiết số liệu từng ngày/từng nhóm.

#### Use Case 3: Chỉnh sửa giá tham khảo trên trang chủ
**Mô tả:** Cập nhật các nội dung liên quan đến mức giá quảng cáo hiển thị ở trang Landing Page (Trang chủ) mà khách hàng nhìn thấy đầu tiên.

**Luồng sự kiện chính:**
1. Quản lý truy cập vào mục "Cấu hình Giao diện / Quản lý Trang chủ".
2. Hệ thống hiển thị form chứa các trường dữ liệu text đang hiện trên trang chủ (Ví dụ: "Giá thuê xe số từ: 100k/ngày", "Giá thuê xe ga từ: 150k/ngày").
3. Quản lý nhập lại mức giá mới vào các ô text này.
4. Quản lý bấm "Cập nhật".
5. Hệ thống lưu cấu hình. Giao diện trang chủ của khách hàng (cả khách vãng lai và thành viên) lập tức hiển thị mức giá mới cập nhật.

#### Use Case 4: Quản lý Voucher (Mã khuyến mãi)
**Mô tả:** Tạo và quản lý các mã giảm giá áp dụng cho khách thuê xe.

**Luồng sự kiện chính:**
1. Quản lý truy cập vào mục "Quản lý Voucher".
2. Hệ thống hiển thị danh sách các Voucher đang có (Tên mã, Mức giảm, Hạn sử dụng, Trạng thái).
3. Thao tác của Quản lý:
   * **Thêm Voucher:** Bấm "Tạo mới", nhập các thông tin: Mã code (VD: SUMMER2026), Loại giảm (Theo % hoặc Số tiền cố định), Giá trị giảm, Số lượng mã, Ngày bắt đầu và Ngày hết hạn.
   * **Sửa Voucher:** Chọn mã chưa hết hạn để thay đổi số lượng hoặc kéo dài thời gian áp dụng.
   * **Xóa/Hủy Voucher:** Chọn mã và bấm "Vô hiệu hóa" để khách hàng không thể nhập mã đó được nữa.
4. Hệ thống lưu lại thay đổi. Các mã hợp lệ sẽ được áp dụng khi khách hàng nhập ở bước thanh toán/tạo phiếu thuê.
