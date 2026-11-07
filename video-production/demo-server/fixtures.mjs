/**
 * QuizVibe AI — Local Demo Fixtures
 * High-fidelity, deterministic demo dataset for VIBE-CODING 2026 Challenge 3.
 * All data is synthetic and resides strictly in memory.
 */

import crypto from 'node:crypto';

export const DEMO_CAMPAIGN_ID = 'c0000000-0000-0000-0000-000000000001';
export const DEMO_CAMPAIGN_SLUG = 'quiz-ai-kham-pha-am-thuc-ha-noi';
export const DEMO_VOUCHER_ID = 'v0000000-0000-0000-0000-000000000001';
export const DEMO_ADMIN_PASSWORD = 'demo_admin_password_2026';
export const DEMO_ADMIN_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export function createDemoFixtures() {
  const now = new Date().toISOString();

  // 1. Primary Challenge 3 Published Campaign
  const campaign = {
    id: DEMO_CAMPAIGN_ID,
    slug: DEMO_CAMPAIGN_SLUG,
    legacy_id: null,
    title: 'Quiz AI: Khám phá Ẩm thực Hà Nội',
    description: 'Thử thách trắc nghiệm ẩm thực phố cổ dành riêng cho khách hàng Fanpage để nhận Voucher ưu đãi đặc quyền!',
    industry: 'Ẩm thực & Nhà hàng',
    status: 'published',
    is_ai_generated: true,
    is_mock: false,
    mock_label: null,
    published_at: now,
    created_at: now,
    updated_at: now,
  };

  // 2. Extra background campaigns for Admin Studio overview metrics
  const backgroundCampaigns = [
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      slug: 'quiz-ai-gen-z-hieu-viet-nam-den-dau',
      legacy_id: null,
      title: 'Quiz AI: Gen Z hiểu Việt Nam đến đâu?',
      description: 'Khám phá văn hóa, xu hướng và lối sống giới trẻ Việt Nam.',
      industry: 'Giáo dục & Đào tạo',
      status: 'draft',
      is_ai_generated: true,
      is_mock: false,
      mock_label: null,
      published_at: null,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      slug: 'quiz-skincare-cham-soc-da-mua-hanh-kho',
      legacy_id: null,
      title: 'Quiz Skincare: Chăm sóc da mùa hanh khô',
      description: 'Bí kíp dưỡng da ẩm mượt và chọn mỹ phẩm phù hợp mùa thu đông.',
      industry: 'Mỹ phẩm & Làm đẹp',
      status: 'published',
      is_ai_generated: false,
      is_mock: false,
      mock_label: null,
      published_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      slug: 'quiz-deal-cong-nghe-mua-le-hoi',
      legacy_id: null,
      title: 'Quiz Công nghệ: Săn sale mùa lễ hội',
      description: 'Cẩm nang chọn thiết bị thông minh và phụ kiện công nghệ.',
      industry: 'Công nghệ & Điện tử',
      status: 'archived',
      is_ai_generated: true,
      is_mock: false,
      mock_label: null,
      published_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 16).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ];

  // 3. Exactly 5 Questions for the primary campaign
  const questions = [
    {
      id: 'q0000000-0000-0000-0000-000000000001',
      campaign_id: DEMO_CAMPAIGN_ID,
      question_order: 0,
      question_text: 'Phở Hà Nội truyền thống thường dùng loại bánh phở nào?',
      options: ['Bánh phở tươi sợi mềm', 'Bánh phở khô bản lớn', 'Bánh phở chiên giòn', 'Bánh đa đỏ'],
      correct_index: 0,
      explanation: 'Phở truyền thống Hà Nội luôn sử dụng bánh phở tươi tráng mỏng, mềm dai tự nhiên, ngấm đều nước dùng ninh từ xương bò.',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'q0000000-0000-0000-0000-000000000002',
      campaign_id: DEMO_CAMPAIGN_ID,
      question_order: 1,
      question_text: 'Món Chả cá Lã Vọng nức tiếng Hà Thành thường ăn kèm với loại rau thơm đặc trưng nào?',
      options: ['Thì là và hành hoa', 'Húng quế và ngò gai', 'Rau răm và diếp cá', 'Kinh giới và tía tô'],
      correct_index: 0,
      explanation: 'Chả cá Lã Vọng được chiên nóng trên chảo cùng thì là và hành hoa cắt khúc, chấm mắm tôm pha chanh ớt sủi bọt.',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'q0000000-0000-0000-0000-000000000003',
      campaign_id: DEMO_CAMPAIGN_ID,
      question_order: 2,
      question_text: 'Cốm làng Vòng - thức quà mùa thu Hà Nội ngon nhất khi được gói trong lá gì?',
      options: ['Lá sen tươi', 'Lá chuối ngự', 'Lá dong xanh', 'Lá bàng đỏ'],
      correct_index: 0,
      explanation: 'Cốm Vòng được bọc trong hai lớp lá: lá ráy bên trong giữ ẩm và lá sen bên ngoài ướp hương thơm thanh tao mùa thu.',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'q0000000-0000-0000-0000-000000000004',
      campaign_id: DEMO_CAMPAIGN_ID,
      question_order: 3,
      question_text: 'Thức uống sáng tạo nổi tiếng bắt nguồn từ phố Giảng Hà Nội là gì?',
      options: ['Cà phê trứng', 'Cà phê muối', 'Cà phê cốt dừa', 'Trà sen Tây Hồ'],
      correct_index: 0,
      explanation: 'Cà phê trứng được cụ Giảng sáng tạo vào những năm 1940 tại Hà Nội, dùng lòng đỏ trứng đánh bông thay thế sữa tươi.',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'q0000000-0000-0000-0000-000000000005',
      campaign_id: DEMO_CAMPAIGN_ID,
      question_order: 4,
      question_text: 'Bún chả Hà Nội chuẩn vị chấm cùng nước mắm chua ngọt và ăn kèm với nguyên liệu nào sau đây?',
      options: ['Chả băm, chả miếng nướng than hoa', 'Chả lụa và giò thủ', 'Nem chua rán', 'Thịt bò tái chần'],
      correct_index: 0,
      explanation: 'Bún chả Hà Nội đặc trưng bởi chả băm và chả miếng được kẹp que tre nướng vàng ruộm trên than hoa đượm lửa.',
      created_at: now,
      updated_at: now,
    },
  ];

  // 4. Voucher for the campaign
  const voucher = {
    id: DEMO_VOUCHER_ID,
    campaign_id: DEMO_CAMPAIGN_ID,
    code: 'AMTHUC50K',
    discount: 'Giảm 50.000đ cho đơn từ 200.000đ',
    description: 'Áp dụng khi dùng bữa hoặc đặt bàn tại chuỗi nhà hàng ẩm thực đối tác trên Fanpage.',
    expiry_date: '7 ngày sau khi nhận mã',
    terms: 'Mỗi khách hàng áp dụng 01 lần. Hạn dùng 7 ngày kể từ khi mở khóa mã ưu đãi.',
    created_at: now,
    updated_at: now,
  };

  // 5. Pre-populated Top 10 Leaderboard & Verified Leads
  const playerSeeds = [
    { name: 'Nguyễn Minh Tuấn', phone: '0981112233', score: 500, time: 12 },
    { name: 'Trần Thị Thu Trang', phone: '0912223344', score: 490, time: 14 },
    { name: 'Lê Hoàng Nam', phone: '0973334455', score: 485, time: 15 },
    { name: 'Phạm Minh Đức', phone: '0904445566', score: 470, time: 16 },
    { name: 'Vũ Thảo Linh', phone: '0985556677', score: 460, time: 18 },
    { name: 'Đỗ Quốc Bảo', phone: '0916667788', score: 450, time: 20 },
    { name: 'Hoàng Lan Anh', phone: '0977778899', score: 440, time: 22 },
    { name: 'Bùi Hải Yến', phone: '0908889900', score: 430, time: 24 },
    { name: 'Dương Thành Long', phone: '0989990011', score: 420, time: 25 },
    { name: 'Ngô Phương Thảo', phone: '0910001122', score: 410, time: 28 },
  ];

  const leads = [];
  const campaignPhoneRegistrations = [];

  for (let i = 0; i < playerSeeds.length; i++) {
    const p = playerSeeds[i];
    const leadId = `l0000000-0000-0000-0000-0000000000${(i + 1).toString().padStart(2, '0')}`;
    const phoneHash = crypto.createHash('sha256').update(p.phone).digest('hex');
    const maskedPhone = `${p.phone.slice(0, 3)}***${p.phone.slice(-4)}`;
    const submittedAt = new Date(Date.now() - (10 - i) * 3600000).toISOString();

    leads.push({
      id: leadId,
      campaign_id: DEMO_CAMPAIGN_ID,
      quiz_session_id: `s0000000-0000-0000-0000-0000000000${(i + 1).toString().padStart(2, '0')}`,
      full_name: p.name,
      phone_number: p.phone,
      phone_hash: phoneHash,
      masked_phone: maskedPhone,
      score: p.score,
      time_taken_seconds: p.time,
      voucher_code: 'AMTHUC50K',
      submitted_at: submittedAt,
      created_at: submittedAt,
    });

    campaignPhoneRegistrations.push({
      id: `r0000000-0000-0000-0000-0000000000${(i + 1).toString().padStart(2, '0')}`,
      campaign_id: DEMO_CAMPAIGN_ID,
      phone_hash: phoneHash,
      first_lead_id: leadId,
      created_at: submittedAt,
    });
  }

  return {
    campaigns: [campaign, ...backgroundCampaigns],
    campaign_questions: questions,
    vouchers: [voucher],
    leads,
    campaign_phone_registrations: campaignPhoneRegistrations,
    quiz_sessions: [],
    admin_sessions: [],
  };
}

