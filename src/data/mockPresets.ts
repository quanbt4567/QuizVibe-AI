import { Campaign, MOCK_MODE_LABEL } from '../types';

/**
 * Verified Industry Mock Presets for QuizVibe AI.
 * Strict conformance to 5 questions, 4 options, 1 correct index.
 * Transparently labeled as demo mock content per competition requirement A3.
 */

export const COSMETICS_DEFAULT_CAMPAIGN: Campaign = {
  id: 'campaign_cosmetics_default',
  title: 'Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty',
  description: 'Chinh phục 5 câu hỏi kiến thức skincare để nhận voucher giảm 20% độc quyền từ Fanpage!',
  industry: 'Cosmetics',
  questions: [
    {
      id: 'q_cosmetics_1',
      question: 'Thứ tự đúng của chu trình làm sạch và dưỡng da ban đêm là gì?',
      options: [
        'Tẩy trang -> Sữa rửa mặt -> Toner -> Serum -> Kem dưỡng khóa ẩm',
        'Sữa rửa mặt -> Tẩy trang -> Kem dưỡng -> Serum',
        'Kem dưỡng -> Tẩy trang -> Sữa rửa mặt -> Toner',
        'Toner -> Sữa rửa mặt -> Tẩy trang -> Serum',
      ],
      correctIndex: 0,
      explanation: 'Làm sạch kép (double cleansing) với dầu/nước tẩy trang rồi đến sữa rửa mặt, sau đó cấp ẩm từ lỏng đến đặc.',
    },
    {
      id: 'q_cosmetics_2',
      question: 'Thành phần nào sau đây đóng vai trò vàng trong việc phục hồi hàng rào bảo vệ da?',
      options: [
        'Vitamin B5 (Panthenol) & Ceramide',
        'Cồn khô nồng độ cao',
        'Hương liệu tổng hợp nồng độ đậm đặc',
        'Chất tẩy rửa xà phòng kiềm mạnh',
      ],
      correctIndex: 0,
      explanation: 'B5 làm dịu và kích thích tái sinh tế bào, trong khi Ceramide củng cố lớp màng lipid sinh học của da.',
    },
    {
      id: 'q_cosmetics_3',
      question: 'Kem chống nắng phổ rộng có chỉ số SPF 50 ngăn chặn được khoảng bao nhiêu phần trăm tia UVB?',
      options: ['Khoảng 98%', 'Chỉ khoảng 50%', 'Đúng 70%', 'Tuyệt đối 100%'],
      correctIndex: 0,
      explanation: 'SPF 50 lọc được khoảng 98% tia UVB khi bôi đủ định lượng chuẩn (2mg/cm² bề mặt da).',
    },
    {
      id: 'q_cosmetics_4',
      question: 'Bạn nên thoa kem chống nắng trước khi bước ra ngoài trời khoảng bao lâu để đạt hiệu quả tối ưu?',
      options: ['15 đến 20 phút', 'Vừa bước ra ngoài cửa mới thoa', 'Khoảng 2 tiếng trước', 'Chỉ cần thoa vào tối hôm trước'],
      correctIndex: 0,
      explanation: 'Màng lọc kem chống nắng cần 15-20 phút để khô ráo và liên kết thành lớp bảo vệ đồng nhất trên da.',
    },
    {
      id: 'q_cosmetics_5',
      question: 'Hoạt chất Retinol (dẫn xuất Vitamin A) được khuyến nghị sử dụng vào thời điểm nào trong ngày?',
      options: ['Buổi tối trước khi đi ngủ', 'Buổi trưa lúc nắng gắt nhất', 'Bất kỳ lúc nào mà không cần kem chống nắng', 'Chỉ dùng vào buổi sáng sớm'],
      correctIndex: 0,
      explanation: 'Retinol dễ bị quang phân hủy dưới ánh nắng mặt trời và khiến da nhạy cảm hơn, do đó nên thoa vào ban đêm.',
    },
  ],
  voucher: {
    code: 'VIBE20',
    discount: 'Giảm 20% cho đơn từ 299.000đ',
    description: 'Áp dụng khi mua các sản phẩm serum và kem dưỡng phục hồi tại Fanpage GlowBeauty',
    terms: 'Hạn dùng 7 ngày kể từ khi nhận mã. Áp dụng cho khách hàng hợp lệ trên Fanpage.',
    expiryDate: '7 ngày sau khi nhận',
  },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  isAiGenerated: false,
  isMock: true,
  mockLabel: MOCK_MODE_LABEL,
};

export const FASHION_PRESET_CAMPAIGN: Campaign = {
  id: 'campaign_fashion_preset',
  title: 'Quiz Phong Cách Thời Trang Cùng VibeStyle',
  description: 'Khám phá gu phối đồ chuẩn trend và rinh ngay voucher 50K sắm đồ mới cho mùa lễ hội!',
  industry: 'Fashion',
  questions: [
    {
      id: 'q_fashion_1',
      question: 'Quy tắc phối màu tương phản (Complementary) trong thời trang thường kết hợp các gam màu nào?',
      options: [
        'Hai gam màu đối xứng nhau trên vòng tròn bánh xe màu sắc (như Xanh navy - Cam đất)',
        'Chỉ phối duy nhất hai tông màu đen và trắng cơ bản',
        'Phối 5 màu rực rỡ ngẫu nhiên trên cùng một bộ trang phục',
        'Chỉ dùng một sắc độ duy nhất từ đầu đến chân không có điểm nhấn',
      ],
      correctIndex: 0,
      explanation: 'Màu tương phản tạo điểm nhấn thị giác mạnh mẽ và cuốn hút khi biết tiết chế sắc độ phù hợp.',
    },
    {
      id: 'q_fashion_2',
      question: 'Chất liệu vải Linen (vải đũi) tự nhiên có ưu điểm nổi bật nhất là gì?',
      options: [
        'Thoáng khí, thấm hút mồ hôi tốt và thân thiện với làn da',
        'Không bao giờ nhăn dù giặt máy sấy nóng nhiều lần',
        'Chống thấm nước tuyệt đối 100% trong mưa lớn',
        'Dày dặn giữ nhiệt chuyên dụng cho mùa đông khắc nghiệt',
      ],
      correctIndex: 0,
      explanation: 'Sợi lanh tự nhiên rỗng thoáng giúp không khí lưu thông tối ưu trong thời tiết nhiệt đới.',
    },
    {
      id: 'q_fashion_3',
      question: 'Để tạo hiệu ứng thị giác giúp vóc dáng trông cao ráo và đôi chân thon dài hơn, bạn nên ưu tiên thiết kế nào?',
      options: [
        'Quần hoặc chân váy cạp cao (High-waisted) kết hợp sơ vin',
        'Áo oversized thùng thình trùm qua gối và quần đáy thụng',
        'Trang phục có họa tiết kẻ sọc ngang to bản toàn thân',
        'Giày bệt mũi tròn với quai dây to bản thắt chặt quanh cổ chân',
      ],
      correctIndex: 0,
      explanation: 'Thiết kế cạp cao dịch chuyển tỉ lệ đường eo lên trên, kéo dài trực quan phần thân dưới.',
    },
    {
      id: 'q_fashion_4',
      question: 'Mẹo bảo quản áo thun cotton 100% không bị dão cổ và giữ form dáng bền lâu là gì?',
      options: [
        'Giặt bằng nước mát, lộn trái áo khi giặt và phơi vắt ngang thân áo',
        'Giặt với nước sôi 100 độ C và sấy khô ở nhiệt độ cao nhất',
        'Dùng móc sắt kéo mạnh từ cổ áo xuống khi phơi nắng',
        'Vắt xoắn thật mạnh bằng tay với lực kéo căng tối đa',
      ],
      correctIndex: 0,
      explanation: 'Phơi ngang thân áo tránh trọng lượng nước làm kéo giãn đường bo viền cổ áo cotton.',
    },
    {
      id: 'q_fashion_5',
      question: 'Phong cách thời trang "Capsule Wardrobe" (Tủ đồ con nhộng) hướng đến triết lý nào?',
      options: [
        'Tủ đồ tối giản gồm các món đồ cơ bản, chất lượng, dễ dàng mix & match linh hoạt',
        'Mua sắm số lượng lớn quần áo theo trend dùng một lần rồi bỏ',
        'Chỉ diện đồ dạ hội lộng lẫy và cầu kỳ trong mọi sinh hoạt hàng ngày',
        'Tập hợp toàn bộ trang phục màu neon sặc sỡ',
      ],
      correctIndex: 0,
      explanation: 'Capsule Wardrobe tôn vinh tính bền vững, tiết kiệm thời gian phối đồ và tối ưu công năng.',
    },
  ],
  voucher: {
    code: 'FASHION50K',
    discount: 'Giảm 50.000đ cho đơn hàng từ 350.000đ',
    description: 'Áp dụng cho toàn bộ bộ sưu tập áo thun và sơ mi mới nhất tại VibeStyle Fanpage',
    terms: 'Hạn dùng 10 ngày. Mỗi khách hàng hợp lệ được áp dụng 01 lần.',
    expiryDate: '10 ngày sau khi nhận',
  },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  isAiGenerated: false,
  isMock: true,
  mockLabel: MOCK_MODE_LABEL,
};

export const TECH_PRESET_CAMPAIGN: Campaign = {
  id: 'campaign_tech_preset',
  title: 'Thử Thách Tín Đồ Công Nghệ Cùng VibeTech',
  description: 'Đố vui công nghệ thông minh, săn ngay voucher 100K nâng cấp phụ kiện điện thoại chính hãng!',
  industry: 'Tech Gadgets',
  questions: [
    {
      id: 'q_tech_1',
      question: 'Công nghệ sạc nhanh chuẩn Power Delivery (USB-PD) hiện đại sử dụng cổng kết nối tiêu chuẩn nào?',
      options: ['Cổng USB Type-C', 'Cổng Micro-USB thế hệ cũ', 'Cổng sạc tròn DC 12V', 'Cổng cáp VGA máy tính'],
      correctIndex: 0,
      explanation: 'USB-PD là giao thức sạc nhanh vạn năng được chuẩn hóa thông qua giao tiếp USB-C.',
    },
    {
      id: 'q_tech_2',
      question: 'Tính năng Chống ồn chủ động (Active Noise Cancellation - ANC) trên tai nghe hoạt động dựa trên nguyên lý nào?',
      options: [
        'Micro thu tiếng ồn môi trường và vi xử lý tạo sóng âm ngược pha để triệt tiêu',
        'Tự động tăng âm lượng nhạc lên mức tối đa để át tiếng ồn bên ngoài',
        'Bịt kín ống tai bằng cao su dày mà không cần xử lý tín hiệu điện tử',
        'Tự động ngắt kết nối Bluetooth ngay khi phát hiện xung quanh có tiếng ồn',
      ],
      correctIndex: 0,
      explanation: 'Sóng âm ngược pha (180 độ) khử trực tiếp dao động sóng âm của tạp âm môi trường.',
    },
    {
      id: 'q_tech_3',
      question: 'Để kéo dài tuổi thọ và độ bền của pin Lithium-ion trên smartphone, thói quen sạc nào sau đây là tốt nhất?',
      options: [
        'Duy trì dung lượng pin trong khoảng 20% đến 80% và tránh để sập nguồn',
        'Luôn dùng cạn kiệt 0% rồi mới cắm sạc liên tục qua đêm nhiều ngày',
        'Vừa chơi game đồ họa nặng vừa cắm sạc nhanh ở môi trường nhiệt độ cao',
        'Đặt máy dưới gối nệm dày trong suốt quá trình cắm sạc',
      ],
      correctIndex: 0,
      explanation: 'Pin Lithium-ion chịu ứng suất cao nhất ở 0% và 100%, vùng 20-80% giúp tối ưu hóa chu kỳ xả nạp.',
    },
    {
      id: 'q_tech_4',
      question: 'Tiêu chuẩn kháng nước và bụi IP68 thường có ý nghĩa gì đối với thiết bị di động?',
      options: [
        'Kháng bụi hoàn toàn và chịu được ngâm nước ở độ sâu trên 1 mét trong điều kiện thử nghiệm của hãng',
        'Có thể lặn biển sâu 100m mà không cần ốp bảo vệ chuyên dụng',
        'Chỉ chống được vài giọt sương nhẹ và không chịu được nước mưa',
        'Không có bất kỳ khả năng chống bụi hay kháng nước nào',
      ],
      correctIndex: 0,
      explanation: 'Số 6 là mức cao nhất về kháng bụi, số 8 là bảo vệ chống ngâm nước liên tục theo điều kiện tiêu chuẩn.',
    },
    {
      id: 'q_tech_5',
      question: 'Chuẩn kết nối Bluetooth 5.3 mang lại cải tiến chính nào so với các phiên bản trước?',
      options: [
        'Kết nối ổn định hơn, giảm độ trễ tín hiệu âm thanh và tiết kiệm điện năng hơn',
        'Tăng độ dày kích thước của thiết bị di động lên gấp đôi',
        'Không còn khả năng tương thích ngược với các thiết bị Bluetooth cũ',
        'Chỉ truyền được tệp văn bản chứ không phát được âm thanh',
      ],
      correctIndex: 0,
      explanation: 'Bluetooth 5.3 tối ưu hóa việc phân kênh kết nối và giảm tiêu thụ năng lượng khi ở chế độ chờ.',
    },
  ],
  voucher: {
    code: 'TECH100K',
    discount: 'Giảm 100.000đ cho đơn từ 500.000đ',
    description: 'Áp dụng cho tai nghe không dây, củ sạc GaN và sạc dự phòng chính hãng tại VibeTech',
    terms: 'Mã có hiệu lực trong vòng 10 ngày kể từ lúc kích hoạt thành công.',
    expiryDate: '10 ngày sau khi nhận',
  },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  isAiGenerated: false,
  isMock: true,
  mockLabel: MOCK_MODE_LABEL,
};

export const FNB_PRESET_CAMPAIGN: Campaign = {
  id: 'campaign_fnb_preset',
  title: 'Vui Cùng Vị Giác & Đồ Uống Cùng VibeBistro',
  description: 'Thử tài am hiểu cà phê & ẩm thực nhận ngay voucher giảm 25% hóa đơn tiệc ngon!',
  industry: 'Food & Beverage',
  questions: [
    {
      id: 'q_fnb_1',
      question: 'Ly cà phê Cappuccino truyền thống của Ý gồm 3 phần với tỷ lệ cân bằng nào?',
      options: [
        '1/3 Espresso, 1/3 Sữa nóng (Steamed Milk), 1/3 Bọt sữa mịn (Milk Foam)',
        'Toàn bộ là sữa đặc pha nước ấm và một giọt cà phê nhỏ',
        '1/2 Cà phê phin và 1/2 rượu vang đỏ lên men',
        'Chỉ gồm bột cà phê hòa tan và đá lạnh không có sữa',
      ],
      correctIndex: 0,
      explanation: 'Tỷ lệ 1:1:1 tạo nên kết cấu bồng bềnh mịn màng đặc trưng của thức uống kinh điển nước Ý.',
    },
    {
      id: 'q_fnb_2',
      question: 'Để pha một ấm trà xanh thơm ngon và không bị chát đắng hay cháy lá trà, nhiệt độ nước lý tưởng là bao nhiêu?',
      options: ['Khoảng 75°C đến 85°C', 'Nước sôi sùng sục 100°C đun sôi lại nhiều lần', 'Nước đá lạnh 0°C', 'Nước ấm nhẹ 30°C'],
      correctIndex: 0,
      explanation: 'Nước quá sôi sẽ làm tan nhanh tannin và polyphenol gây vị đắng chát gắt và mất hương thơm thanh tao của trà.',
    },
    {
      id: 'q_fnb_3',
      question: 'Loại hạt cà phê nào phổ biến nhất tại Việt Nam, nổi tiếng với hàm lượng caffeine cao và vị đắng đậm đà?',
      options: ['Robusta (Cà phê vối)', 'Arabica vùng cao Nam Mỹ', 'Geisha Panama thượng hạng', 'Liberica (Cà phê mít)'],
      correctIndex: 0,
      explanation: 'Việt Nam là quốc gia xuất khẩu hạt cà phê Robusta lớn nhất thế giới với hương vị đậm đà truyền thống.',
    },
    {
      id: 'q_fnb_4',
      question: 'Trong quy trình chế biến món bít tết bò (Beefsteak), kỹ thuật "để thịt nghỉ" (resting meat) sau khi áp chảo nhằm mục đích gì?',
      options: [
        'Để nước thịt ngọt (juice) phân bổ ngược đều lại vào từng thớ thịt, giúp thịt mềm mọng',
        'Để miếng thịt bị nguội lạnh hoàn toàn trước khi thưởng thức',
        'Để lớp vỏ giòn thơm bên ngoài mềm nhũn ra',
        'Để làm bay hơi toàn bộ hương thơm gia vị tẩm ướp',
      ],
      correctIndex: 0,
      explanation: 'Nhiệt độ khiến nước ép dồn vào tâm miếng thịt; resting 5-7 phút giúp nước ngọt thẩm thấu ngược ra toàn thớ thịt.',
    },
    {
      id: 'q_fnb_5',
      question: 'Món tráng miệng Tiramisu nổi tiếng của ẩm thực Ý sử dụng loại phô mai tươi đặc trưng nào?',
      options: [
        'Phô mai Mascarpone',
        'Phô mai Cheddar vàng dạng lát',
        'Phô mai Mozzarella kéo sợi làm bánh pizza',
        'Phô mai Parmesan dạng bột rắc mì Ý',
      ],
      correctIndex: 0,
      explanation: 'Mascarpone béo ngậy kết hợp cùng cà phê Espresso và bánh quy Savoiardi tạo nên hương vị trứ danh của Tiramisu.',
    },
  ],
  voucher: {
    code: 'YUMMY25',
    discount: 'Giảm 25% cho hóa đơn từ 150.000đ',
    description: 'Thưởng thức đồ uống và đồ tráng miệng tại quán hoặc đặt đơn qua Fanpage VibeBistro',
    terms: 'Áp dụng từ thứ 2 đến thứ 6 hàng tuần cho khách hàng tham gia minigame.',
    expiryDate: '14 ngày sau khi nhận',
  },
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  isAiGenerated: false,
  isMock: true,
  mockLabel: MOCK_MODE_LABEL,
};

export const ALL_MOCK_PRESETS: Record<string, Campaign> = {
  cosmetics: COSMETICS_DEFAULT_CAMPAIGN,
  fashion: FASHION_PRESET_CAMPAIGN,
  tech: TECH_PRESET_CAMPAIGN,
  fnb: FNB_PRESET_CAMPAIGN,
};

export const MOCK_PRESET_LIST: Campaign[] = [
  COSMETICS_DEFAULT_CAMPAIGN,
  FASHION_PRESET_CAMPAIGN,
  TECH_PRESET_CAMPAIGN,
  FNB_PRESET_CAMPAIGN,
];

