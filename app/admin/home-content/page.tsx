"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminHomeContentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?view=content");
  }, [router]);

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "sans-serif", color: "#666" }}>
      Đang chuyển tiếp tới trang Quản lý Nội dung trang chủ...
    </div>
  );
}
