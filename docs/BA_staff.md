## Phân tích Nghiệp vụ (BA) - Phân hệ Nhân viên (Staff)

 Chi tiết luồng nghiệp vụ (Use Case Specifications)

#### Use Case 1: Duyệt hồ sơ khách hàng đăng ký tài khoản
**Mô tả:** Nhân viên kiểm tra tính hợp lệ của giấy tờ tùy thân do khách hàng tải lên khi tạo tài khoản mới.

**Luồng sự kiện chính:**
1. Hệ thống hiển thị danh sách các tài khoản khách hàng mới ở trạng thái "Chờ duyệt hồ sơ".
2. Staff chọn một hồ sơ để xem chi tiết.
3. Hệ thống hiển thị thông tin cá nhân, ảnh Căn cước công dân (CCCD) mặt trước/sau và Bằng lái xe (BLX).
4. Staff đối chiếu thông tin nhập và ảnh chụp.
5. Staff ấn nút "Duyệt hồ sơ" (hoặc "Từ chối" nếu ảnh mờ/sai thông tin).
6. Hệ thống cập nhật trạng thái tài khoản khách hàng thành "Đã xác thực" và cho phép khách hàng đặt xe tự động.

#### Use Case 2: Quản lý vòng đời phiếu thuê - Khách đã đăng ký
**Mô tả:** Xử lý luồng trạng thái từ lúc có yêu cầu đặt xe đến khi hoàn tất chuyến đi đối với khách hàng là thành viên.

**Luồng sự kiện chính:**
1. Hệ thống thông báo có phiếu thuê mới từ khách hàng đã đăng ký.
2. Staff kiểm tra thông tin phiếu thuê và ấn "Duyệt". (Lúc này web của khách hàng lập tức chuyển trạng thái đơn thành "Đã duyệt").
3. Đến ngày giờ hẹn, khách hàng đến cửa hàng nhận xe.
4. Staff tiến hành giao xe và ấn nút "Đã nhận xe" trên hệ thống. (Trạng thái đơn của khách đổi thành "Đang thuê/Đã nhận xe").
5. Khi khách hàng mang xe đến trả, Staff kiểm tra tình trạng xe, thu tiền (nếu có).
6. Staff ấn nút "Đã trả xe".
7. Hệ thống kết thúc vòng đời phiếu thuê và chuyển đơn vào phần "Lịch sử thuê xe".

#### Use Case 3: Quản lý phiếu thuê - Khách vãng lai
**Mô tả:** Xử lý yêu cầu thuê xe của khách không có tài khoản, yêu cầu thao tác kiểm tra giấy tờ thủ công và xác nhận qua điện thoại.

**Luồng sự kiện chính:**
1. Hệ thống thông báo có phiếu thuê mới từ khách vãng lai.
2. Staff mở chi tiết phiếu thuê. Hệ thống hiển thị thông tin đặt xe kèm theo ảnh chụp CCCD và BLX mà khách vãng lai đã upload khi điền form.
3. Staff kiểm tra tính hợp lệ của giấy tờ.
4. Staff ấn "Duyệt" phiếu thuê.
5. Hệ thống hiển thị thông báo nhắc nhở gọi điện và hiển thị nổi bật Số điện thoại của khách hàng.
6. Staff dùng điện thoại gọi trực tiếp cho khách để thông báo: "Cửa hàng đã xác nhận đơn thuê xe, hướng dẫn các thủ tục hoặc tiền cọc cần chuẩn bị khi đến lấy xe".
7. Các bước giao xe/trả xe tiếp theo diễn ra tương tự Use Case 2.

#### Use Case 4: Xem thông tin tổng quan tình trạng xe (Dashboard)
**Mô tả:** Staff theo dõi số lượng và tình trạng hiện tại của toàn bộ xe trong cửa hàng để điều phối.

**Luồng sự kiện chính:**
1. Staff truy cập vào màn hình "Quản lý tình trạng xe" (Dashboard).
2. Hệ thống tổng hợp dữ liệu thời gian thực và hiển thị 3 chỉ số chính:
   * **Số xe đang được đặt:** Các xe thuộc phiếu thuê đã duyệt nhưng khách chưa đến lấy.
   * **Số xe đã bàn giao:** Các xe đang trong thời gian khách sử dụng (phiếu thuê ở trạng thái "Đã nhận xe").
   * **Số xe còn trống:** Các xe hiện đang nằm ở cửa hàng, sẵn sàng cho thuê.
3. Staff có thể bấm vào từng con số để xem danh sách chi tiết các xe thuộc nhóm trạng thái đó.

#### Use Case 5: Xem hồ sơ cá nhân của Staff
**Mô tả:** Nơi nhân viên xem thông tin tài khoản làm việc của chính mình.

**Luồng sự kiện chính:**
1. Staff bấm vào ảnh đại diện hoặc menu "Hồ sơ cá nhân".
2. Hệ thống hiển thị các thông tin: Họ tên, Mã nhân viên, Số điện thoại, Email, Chức vụ/Ca làm việc.
3. (Tùy chọn) Staff có thể đổi mật khẩu đăng nhập tại màn hình này.

#### Use Case 6: Xem đánh giá và trả lời đánh giá
