export interface HomeSlideItem {
  id: string;
  subtitle: string;   // Tiêu đề nhỏ (Badge/Subtitle, ví dụ: "KHÁM PHÁ PHỐ PHƯỜNG")
  heading1: string;   // Tiêu đề lớn dòng 1 (Heading line 1, ví dụ: "Đi chậm lại")
  heading2: string;   // Tiêu đề lớn dòng 2 màu cam (Heading line 2, ví dụ: "Cảm nhận nhiều hơn")
  description: string;// Mô tả ngắn (Description)
  tags: string[];     // Tag nổi bật (ví dụ: ["Xe bảo dưỡng định kỳ", "Hỗ trợ 24/7"])
  imageUrl: string;   // Link ảnh URL hoặc chuỗi Base64
  // Backward-compat aliases
  eyebrow?: string;
  title?: string;
  accent?: string;
  text?: string;
  image?: string;
}

export interface HomeAboutContent {
  title: string;       // Tiêu đề phần giới thiệu
  introText: string;   // Đoạn văn bản giới thiệu về Vi Vu Bike
}

export interface HomePolicyItem {
  id: string;
  title: string;       // Tiêu đề chính sách (ví dụ: "Thủ tục nhanh")
  description: string; // Nội dung chi tiết chính sách
}

export interface HomePoliciesContent {
  heading: string;     // Tiêu đề phần chính sách (ví dụ: "Rõ ràng trước khi bạn bắt đầu chuyến đi")
  subheading: string;  // Mô tả phần chính sách
  items: HomePolicyItem[]; // Danh sách các thẻ chính sách hỗ trợ
}

export interface HomeContactContent {
  hotline: string;      // Hotline hỗ trợ
  email: string;        // Email hỗ trợ
  address: string;      // Địa chỉ cơ sở chính
  workingHours: string; // Giờ làm việc / mở cửa
  socialLinks: {
    facebook: string;
    zalo: string;
  };
}

export interface HomeContentData {
  slides: HomeSlideItem[];
  about: HomeAboutContent;
  policies: HomePoliciesContent;
  contact: HomeContactContent;
}

export const DEFAULT_HOME_CONTENT: HomeContentData = {
  slides: [
    {
      id: "slide-1",
      subtitle: "THUÊ XE MÁY TẠI HÀ NỘI",
      heading1: "Chọn xe tốt",
      heading2: "Đi thật xa",
      description: "Dàn xe mới, giao nhận linh hoạt tận nơi tại Hà Nội và thủ tục đơn giản cho hành trình của bạn.",
      tags: ["Xe bảo dưỡng định kỳ", "Giao xe tận nơi", "Hỗ trợ 24/7"],
      imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2200&q=90",
    },
    {
      id: "slide-2",
      subtitle: "KHÁM PHÁ PHỐ PHƯỜNG",
      heading1: "Đi chậm lại",
      heading2: "Cảm nhận nhiều hơn",
      description: "Tự do vi vu qua từng ngõ ngách, khám phá trọn vẹn nét đẹp văn hóa và ẩm thực Hà Nội theo cách của riêng bạn.",
      tags: ["02 mũ bảo hiểm đạt chuẩn", "01 áo mưa tiện dụng", "Tư vấn lộ trình"],
      imageUrl: "https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=2200&q=90",
    },
    {
      id: "slide-3",
      subtitle: "SẴN SÀNG LÊN ĐƯỜNG",
      heading1: "Vững tay lái",
      heading2: "An tâm hành trình",
      description: "Xe số, xe tay ga và xe côn tay được bảo dưỡng định kỳ kỹ lưỡng trước mỗi lần bàn giao.",
      tags: ["Kiểm định an toàn 100%", "Cứu hộ tận nơi", "Đổi xe khi gặp sự cố"],
      imageUrl: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=2200&q=90",
    },
    {
      id: "slide-4",
      subtitle: "DỊCH VỤ CHUYÊN NGHIỆP",
      heading1: "Giá cả minh bạch",
      heading2: "Tiết kiệm tối đa",
      description: "Bảng giá công khai theo ngày, tuần và tháng. Thuê càng lâu càng nhiều ưu đãi, không phát sinh phụ phí ẩn.",
      tags: ["Bảng giá niêm yết", "Hợp đồng rõ ràng", "Hỗ trợ 24/7"],
      imageUrl: "https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&w=2200&q=90",
    },
  ],
  about: {
    title: "Thuê xe chủ động cho mọi chuyến đi",
    introText: "Vi Vu Bike mang đến dịch vụ thuê xe máy rõ ràng, giá công khai và xe được chăm sóc kỹ trước mỗi hành trình. Bạn chỉ cần chọn lịch phù hợp, hoàn tất xác minh và nhận xe.",
  },
  policies: {
    heading: "Rõ ràng trước khi bạn bắt đầu chuyến đi",
    subheading: "Hỗ trợ 24/7 qua hotline, tư vấn lịch trình miễn phí và đổi xe khi gặp lỗi kỹ thuật trong phạm vi hỗ trợ.",
    items: [
      {
        id: "p-1",
        title: "Thủ tục nhanh",
        description: "Đăng ký, gửi giấy tờ và chờ xác minh hồ sơ nhanh chóng qua hệ thống.",
      },
      {
        id: "p-2",
        title: "Phụ kiện đi kèm",
        description: "Trang bị sẵn 02 mũ bảo hiểm đạt chuẩn và 01 áo mưa tiện dụng trong mỗi lượt thuê.",
      },
      {
        id: "p-3",
        title: "Hỗ trợ sự cố",
        description: "Liên hệ ngay hotline hỗ trợ cứu hộ & kỹ thuật 24/7 nếu xe có bất kỳ dấu hiệu bất thường nào.",
      },
      {
        id: "p-4",
        title: "Giao nhận minh bạch",
        description: "Biên bản bàn giao ghi nhận chi tiết tình trạng xe, phụ kiện và mốc thời gian nhận - trả xe.",
      },
    ],
  },
  contact: {
    hotline: "0900 123 456",
    email: "support@vivubike.vn",
    address: "96A Trần Phú, Hà Đông, Hà Nội",
    workingHours: "07:00 - 21:00 hàng ngày",
    socialLinks: {
      facebook: "https://facebook.com/vivubike",
      zalo: "https://zalo.me/0900123456",
    },
  },
};

/**
 * Chuẩn hóa dữ liệu từ Firestore, kết hợp dữ liệu mặc định nếu thiếu hoặc chưa có
 */
export function normalizeHomeContent(data: any): HomeContentData {
  if (!data) return DEFAULT_HOME_CONTENT;

  // 1. Slides: Phục hồi và chuẩn hóa
  let slides: HomeSlideItem[] = DEFAULT_HOME_CONTENT.slides;
  if (Array.isArray(data.slides) && data.slides.length > 0) {
    const parsedSlides = data.slides.map((s: any, idx: number) => {
      const tags = Array.isArray(s.tags)
        ? s.tags
        : typeof s.tags === "string"
        ? s.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : ["Xe bảo dưỡng định kỳ", "Hỗ trợ 24/7"];

      return {
        id: s.id || `slide-${idx + 1}`,
        subtitle: s.subtitle || s.eyebrow || "KHÁM PHÁ PHỐ PHƯỜNG",
        heading1: s.heading1 || s.title || "Đi chậm lại",
        heading2: s.heading2 || s.accent || "Cảm nhận nhiều hơn",
        description: s.description || s.text || "",
        tags: tags.length > 0 ? tags : ["Xe bảo dưỡng định kỳ", "Hỗ trợ 24/7"],
        imageUrl: s.imageUrl || s.image || DEFAULT_HOME_CONTENT.slides[idx % DEFAULT_HOME_CONTENT.slides.length]?.imageUrl || DEFAULT_HOME_CONTENT.slides[0].imageUrl,
      };
    });

    // Nếu Firestore chỉ có 1 slide hoặc < 3 slide (do bị ghi đè trước đó), tự động bù các slide mặc định còn lại
    if (parsedSlides.length < 3) {
      const fallbackRemaining = DEFAULT_HOME_CONTENT.slides.slice(parsedSlides.length);
      slides = [...parsedSlides, ...fallbackRemaining];
    } else {
      slides = parsedSlides;
    }
  }

  // 2. About
  const about: HomeAboutContent = {
    title: data.about?.title || DEFAULT_HOME_CONTENT.about.title,
    introText: data.about?.introText || data.about?.intro || DEFAULT_HOME_CONTENT.about.introText,
  };

  // 3. Policies
  let policyItems: HomePolicyItem[] = DEFAULT_HOME_CONTENT.policies.items;
  if (Array.isArray(data.policies?.items) && data.policies.items.length > 0) {
    policyItems = data.policies.items.map((p: any, idx: number) => ({
      id: p.id || `p-${idx + 1}`,
      title: p.title || `Chính sách ${idx + 1}`,
      description: p.description || p.content || "",
    }));
  } else if (Array.isArray(data.policies) && data.policies.length > 0) {
    policyItems = data.policies.map((p: any, idx: number) => ({
      id: p.id || `p-${idx + 1}`,
      title: typeof p === "string" ? p : p.title || `Chính sách ${idx + 1}`,
      description: typeof p === "string" ? "" : p.description || "",
    }));
  } else if (Array.isArray(data.about?.policies) && data.about.policies.length > 0) {
    policyItems = data.about.policies.map((p: any, idx: number) => ({
      id: `p-${idx + 1}`,
      title: typeof p === "string" ? p : p.title || `Chính sách ${idx + 1}`,
      description: typeof p === "string" ? "" : p.description || "",
    }));
  }

  const policies: HomePoliciesContent = {
    heading: data.policies?.heading || DEFAULT_HOME_CONTENT.policies.heading,
    subheading: data.policies?.subheading || DEFAULT_HOME_CONTENT.policies.subheading,
    items: policyItems,
  };

  // 4. Contact
  const contact: HomeContactContent = {
    hotline: data.contact?.hotline || DEFAULT_HOME_CONTENT.contact.hotline,
    email: data.contact?.email || DEFAULT_HOME_CONTENT.contact.email,
    address: data.contact?.address || DEFAULT_HOME_CONTENT.contact.address,
    workingHours: data.contact?.workingHours || DEFAULT_HOME_CONTENT.contact.workingHours,
    socialLinks: {
      facebook: data.contact?.socialLinks?.facebook ?? DEFAULT_HOME_CONTENT.contact.socialLinks.facebook,
      zalo: data.contact?.socialLinks?.zalo ?? DEFAULT_HOME_CONTENT.contact.socialLinks.zalo,
    },
  };

  return { slides, about, policies, contact };
}

/**
 * Hỗ trợ nén ảnh & chuyển đổi sang Base64 chuỗi nhỏ gọn (max width 1600px, JPEG quality 0.82)
 * giúp tránh vượt quá giới hạn 1MB của Firestore document
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Nếu không phải ảnh, đọc FileReader bình thường
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Nén JPEG 0.82
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
        resolve(compressedBase64);
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
