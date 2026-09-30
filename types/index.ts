/**
 * Các kiểu dữ liệu dùng chung trong toàn bộ dự án Vi Vu Bike.
 */

/** Vai trò người dùng trong hệ thống */
export type UserRole = 'admin' | 'staff' | 'customer';

/** Nhãn hiển thị tiếng Việt tương ứng với từng vai trò */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên vận hành',
  customer: 'Khách hàng',
};

/** Đường dẫn trang dashboard tương ứng với từng vai trò */
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  admin: '/admin',
  staff: '/staff',
  customer: '/customer',
};
