/**
 * Predefined and custom industry options for QuizVibe AI campaigns.
 */

export const PREDEFINED_INDUSTRIES = [
  'Mỹ phẩm & Chăm sóc da',
  'Thời trang & Phụ kiện',
  'Công nghệ & Phụ kiện',
  'Ẩm thực & Đồ uống (F&B)',
  'Giáo dục & Đào tạo',
  'Du lịch & Khách sạn',
  'Sức khỏe & Thể thao',
  'Giải trí & Game',
  'Nhà cửa & Đời sống',
  'Thú cưng',
  'Sách & Văn phòng phẩm',
  'Bất động sản',
  'Dịch vụ & Làm đẹp',
] as const;

export type PredefinedIndustry = typeof PREDEFINED_INDUSTRIES[number];

export const CUSTOM_INDUSTRY_OPTION = 'Khác / Tự nhập';

export const ALL_INDUSTRY_OPTIONS = [
  ...PREDEFINED_INDUSTRIES,
  CUSTOM_INDUSTRY_OPTION,
] as const;

export const INDUSTRY_PLACEHOLDER =
  'Nhập ngành hàng của bạn, ví dụ: Đồ chơi trẻ em, Nội thất, Nông sản...';

export const INDUSTRY_MAX_LENGTH = 100;

export function isPredefinedIndustry(val: string): boolean {
  if (!val) return false;
  return (PREDEFINED_INDUSTRIES as readonly string[]).includes(val.trim());
}

