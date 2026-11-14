import { getLanguage } from '../../shared/i18n';
import { sourceText, sourceFormat } from "./shopI18n";
import { formatPrice } from '../../shared/lib/membershipPresentation';
import type { FulfillmentMethod, OrderPaymentMethod, OrderStatus, ProductForm, ProductGoal } from './shopTypes';

const SEEDED_SHOP_TEXT_EN: Readonly<Record<string, string>> = {
  // Categories
  'Trước tập': 'Pre-workout',
  'Điện giải': 'Electrolytes',
  'Vitamin & khoáng chất': 'Vitamins & minerals',
  'Thanh protein': 'Protein bars',
  // Nutrients & serving sizes
  'Năng lượng': 'Calories',
  'Đạm': 'Protein',
  'BCAA tự nhiên': 'Naturally occurring BCAAs',
  'Chất béo': 'Total fat',
  'Natri': 'Sodium',
  'Caffeine tự nhiên': 'Natural caffeine',
  'Kali': 'Potassium',
  'Magie': 'Magnesium',
  'Dầu cá tinh khiết': 'Purified fish oil',
  'Chất xơ': 'Dietary fiber',
  'Đường': 'Sugars',
  '1 muỗng (33 g)': '1 scoop (33 g)',
  '1 muỗng (5 g)': '1 scoop (5 g)',
  '1 muỗng (14 g)': '1 scoop (14 g)',
  '1 gói (6 g)': '1 stick (6 g)',
  '2 viên nang mềm': '2 softgels',
  '1 thanh (60 g)': '1 bar (60 g)',
  // Variant labels
  'Vị Sô-cô-la · 908 g': 'Chocolate · 908 g',
  'Vị Sô-cô-la · 2,27 kg': 'Chocolate · 2.27 kg',
  'Vị Vani tự nhiên · 2,27 kg': 'Natural Vanilla · 2.27 kg',
  'Không vị · 300 g': 'Unflavored · 300 g',
  'Không vị · 500 g': 'Unflavored · 500 g',
  'Vị Cam Yuzu · 420 g': 'Yuzu Citrus · 420 g',
  'Vị Dâu rừng · 420 g': 'Wild Berry · 420 g',
  'Vị Chanh muối · Hộp 30 gói': 'Salted Lemon · Box of 30 sticks',
  'Vị Đào trắng · Hộp 30 gói': 'White Peach · Box of 30 sticks',
  'Lọ 90 viên (45 lần dùng)': '90 softgels (45 servings)',
  'Hạnh nhân Cacao · Hộp 12 thanh': 'Almond Cocoa · Box of 12 bars',
  'Bơ đậu phộng muối biển · Hộp 12 thanh': 'Sea Salt Peanut Butter · Box of 12 bars',
  // Seeded product copy
  'Đạm whey tách béo lọc lạnh, dễ tiêu hóa sau buổi tập nặng.':
    'Cold-filtered whey protein isolate for fast, easy digestion after heavy training.',
  'Đạm whey isolate tinh khiết từ sữa bò ăn cỏ, hàm lượng lactose thấp, hỗ trợ bổ sung đạm nhanh sau buổi tập.':
    'Pure grass-fed whey protein isolate with low lactose to support rapid post-workout recovery.',
  'Pha 1 muỗng với 250–300 ml nước lạnh hoặc sữa hạt, lắc đều 20 giây.':
    'Mix 1 scoop with 250–300 ml of cold water or plant milk and shake well for 20 seconds.',
  'Chứa thành phần từ sữa. Bảo quản nơi khô thoáng, đậy kín nắp sau khi mở.':
    'Contains milk ingredients. Store in a cool, dry place and seal tightly after opening.',
  'Creatine monohydrate hạt siêu mịn không mùi vị, dễ pha cùng nước hoặc whey.':
    'Unflavored micronized creatine monohydrate that mixes effortlessly with water or whey.',
  '100% Creatine Monohydrate độ mịn 200 mesh, không chất độn, không hương liệu nhân tạo.':
    '100% 200-mesh micronized creatine monohydrate with zero fillers or artificial flavors.',
  'Dùng 1 muỗng (5 g) mỗi ngày cùng 250 ml nước lọc hoặc nước trái cây.':
    'Take 1 scoop (5 g) daily with 250 ml of water or fruit juice.',
  'Uống đủ tối thiểu 2 lít nước mỗi ngày khi sử dụng sản phẩm.':
    'Drink at least 2 liters of water daily while using this supplement.',
  'Công thức tỉnh táo trước buổi tập với L-Citrulline, Beta-Alanine và Caffeine tự nhiên.':
    'Clean pre-workout focus formula with L-Citrulline, Beta-Alanine, and natural caffeine.',
  'Kết hợp axit amin và chiết xuất hạt cà phê xanh với liều lượng minh bạch trên từng thành phần.':
    'Combines amino acids and green coffee bean extract with transparent clinical dosing.',
  'Pha 1 muỗng với 300 ml nước lạnh, dùng trước buổi tập 20–30 phút.':
    'Mix 1 scoop with 300 ml of cold water and consume 20–30 minutes before training.',
  'Mỗi khẩu phần chứa 175 mg caffeine. Không dùng trong vòng 5 giờ trước khi ngủ.':
    'Contains 175 mg of caffeine per serving. Avoid taking within 5 hours of bedtime.',
  'Muối điện giải không đường bù khoáng nhanh cho các buổi HIIT, chạy bộ và đánh sân.':
    'Sugar-free electrolyte salts for rapid mineral replenishment during HIIT, runs, and court play.',
  'Tỷ lệ Natri – Kali – Magie cân đối, vị thanh nhẹ từ chanh muối tự nhiên, không phẩm màu.':
    'Balanced sodium, potassium, and magnesium ratio with light natural citrus flavor and no dyes.',
  'Hòa 1 gói vào bình 500–600 ml nước mát, uống từng ngụm trong và sau khi tập.':
    'Dissolve 1 stick in 500–600 ml of cool water and sip during and after workouts.',
  'Bảo quản nơi khô mát, tránh ánh nắng trực tiếp.':
    'Store in a cool, dry place away from direct sunlight.',
  'Viên nang dầu cá biển sâu chuẩn rTG kết hợp Vitamin D3 và K2 MK-7.':
    'rTG deep-sea fish oil softgels paired with Vitamin D3 and K2 MK-7.',
  'Chiết xuất từ cá cơm vùng biển lạnh được chưng cất phân tử, viên mềm không tanh.':
    'Molecularly distilled cold-water anchovy oil in odorless easy-swallow softgels.',
  'Uống 2 viên mỗi ngày ngay sau bữa ăn chính có chất béo.':
    'Take 2 softgels daily right after a main meal containing healthy fats.',
  'Tham khảo ý kiến chuyên gia y tế nếu đang dùng thuốc chống đông máu.':
    'Consult a healthcare professional if you are taking blood-thinning medication.',
  'Thanh protein nướng giòn 20 g đạm, ít đường, tiện mang theo trong túi tập.':
    'Crisp baked protein bar with 20 g protein and low sugar, ready for your gym bag.',
  'Kết hợp whey isolate và hạt hạnh nhân rang, giàu chất xơ prebiotic, không phủ siro đường.':
    'Crafted with whey isolate, roasted almonds, and prebiotic fiber without sugar syrups.',
  'Dùng trực tiếp như bữa phụ trước hoặc sau giờ tập.':
    'Enjoy directly as a convenient snack before or after training.',
  'Chứa sữa và hạt cây (hạnh nhân).':
    'Contains milk and tree nuts (almonds).',
};

export function localizeSeededShopText(
  value: string | null | undefined,
  lang: 'vi' | 'en' = getLanguage(),
): string {
  if (!value) return '';
  if (lang !== 'en') return value;
  return SEEDED_SHOP_TEXT_EN[value.trim()] ?? value;
}

export const formatVnd = (amount: number): string => formatPrice(amount);

export function pricePerServingLabel(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '';
  return sourceFormat('{0} / lần dùng', formatPrice(amount));
}

export const GOAL_LABELS: Record<ProductGoal, string> = {
  get muscle_gain() { return sourceText('Tăng cơ'); },
  get recovery() { return sourceText('Phục hồi'); },
  get energy() { return sourceText('Năng lượng'); },
  get weight_management() { return sourceText('Kiểm soát cân nặng'); },
  get wellness() { return sourceText('Sức khỏe tổng quát'); },
};

export const FORM_LABELS: Record<ProductForm, string> = {
  get powder() { return sourceText('Bột'); },
  get capsule() { return sourceText('Viên nang'); },
  get tablet() { return sourceText('Viên nén'); },
  get liquid() { return sourceText('Nước'); },
  get bar() { return sourceText('Thanh'); },
  get other() { return sourceText('Khác'); },
};

export function orderStatusLabel(
  status: OrderStatus,
  fulfillment?: FulfillmentMethod | string | null,
  paymentMethod?: OrderPaymentMethod | string | null,
): string {
  switch (status) {
    case 'pending_payment':
      return paymentMethod === 'counter' ? sourceText('Chờ trả tại quầy') : sourceText('Chờ thanh toán');
    case 'paid':
      return sourceText('Đã thanh toán');
    case 'processing':
      return sourceText('Đang chuẩn bị');
    case 'shipping':
      return sourceText('Đang giao');
    case 'ready_for_pickup':
      return sourceText('Chờ nhận tại quầy');
    case 'completed':
      return fulfillment === 'pickup' ? sourceText('Đã nhận tại quầy') : sourceText('Đã giao');
    case 'cancelled':
      return sourceText('Đã hủy');
    default:
      return status;
  }
}
