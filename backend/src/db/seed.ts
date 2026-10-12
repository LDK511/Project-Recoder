import bcryptjs from 'bcryptjs';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * 데모 데이터. SEED_DEMO=true 일 때 상품 테이블이 비어 있으면 한 번만 들어갑니다.
 * 이미지는 frontend/public/products/*.svg 에 들어 있어 외부 네트워크 없이도 보입니다.
 */
const DEMO_PRODUCTS = [
  {
    name: '노이즈캔슬링 무선 헤드폰 H1',
    category: '오디오',
    description:
      '하이브리드 ANC로 주변 소음을 최대 35dB 줄여 줍니다.\n\n· 최대 30시간 재생 (ANC 켬 기준)\n· 10분 충전으로 5시간 사용\n· 멀티포인트 블루투스 5.3\n· 접이식 구조, 하드 케이스 포함',
    price_cents: 249000,
    compare_at_price_cents: 299000,
    stock: 50,
    image_url: '/products/headphones.svg',
  },
  {
    name: '오픈형 무선 이어버드 E2',
    category: '오디오',
    description: '귀를 막지 않는 오픈형 설계로 장시간 착용해도 편안합니다.\n\n· IPX5 생활방수\n· 케이스 포함 최대 28시간\n· 통화용 듀얼 마이크',
    price_cents: 89000,
    compare_at_price_cents: null,
    stock: 120,
    image_url: '/products/earbuds.svg',
  },
  {
    name: '저소음 기계식 키보드 K87',
    category: '키보드·마우스',
    description:
      '사무실에서도 부담 없는 저소음 리니어 스위치를 사용한 텐키리스 키보드입니다.\n\n· 핫스왑 소켓 (3/5핀)\n· 알루미늄 상판, 가스켓 마운트\n· 유선/블루투스/2.4GHz 3모드\n· 한글 각인 PBT 키캡',
    price_cents: 159000,
    compare_at_price_cents: 179000,
    stock: 30,
    image_url: '/products/keyboard.svg',
  },
  {
    name: '버티컬 무선 마우스 M3',
    category: '키보드·마우스',
    description: '손목 비틀림을 줄여 주는 57° 버티컬 디자인.\n\n· 무소음 클릭\n· 최대 4,000 DPI\n· USB-C 충전, 1회 충전 70일 사용',
    price_cents: 49900,
    compare_at_price_cents: 59900,
    stock: 75,
    image_url: '/products/mouse.svg',
  },
  {
    name: '4K 오토포커스 웹캠 C4',
    category: '데스크 액세서리',
    description: '화상회의와 스트리밍을 위한 4K 30fps 웹캠입니다.\n\n· 소니 센서, HDR 지원\n· 듀얼 노이즈 리덕션 마이크\n· 프라이버시 셔터 내장',
    price_cents: 129000,
    compare_at_price_cents: null,
    stock: 25,
    image_url: '/products/webcam.svg',
  },
  {
    name: '모니터 라이트바 L1',
    category: '조명',
    description: '화면 반사 없이 책상만 비추는 비대칭 광학 설계.\n\n· 색온도 2,700K~6,500K\n· 자동 밝기 조절 센서\n· 무선 다이얼 컨트롤러',
    price_cents: 69000,
    compare_at_price_cents: 79000,
    stock: 40,
    image_url: '/products/lightbar.svg',
  },
  {
    name: '20,000mAh 고속충전 보조배터리',
    category: '충전·케이블',
    description: '노트북까지 충전 가능한 65W PD 보조배터리.\n\n· USB-C 2포트 + USB-A 1포트\n· 잔량 디스플레이\n· 기내 반입 가능 용량',
    price_cents: 45900,
    compare_at_price_cents: null,
    stock: 100,
    image_url: '/products/powerbank.svg',
  },
  {
    name: '7-in-1 USB-C 멀티 허브',
    category: '충전·케이블',
    description: '노트북 하나로 모든 주변기기를 연결하세요.\n\n· 4K HDMI, SD/microSD\n· USB-A 3.0 ×2, 100W PD 패스스루\n· 알루미늄 바디',
    price_cents: 39900,
    compare_at_price_cents: 49900,
    stock: 60,
    image_url: '/products/hub.svg',
  },
  {
    name: '3-in-1 무선 충전 스탠드',
    category: '충전·케이블',
    description: '스마트폰, 이어버드, 스마트워치를 한 번에 충전합니다.\n\n· 최대 15W 고속 무선충전\n· 수면 모드 LED',
    price_cents: 59000,
    compare_at_price_cents: null,
    stock: 4,
    image_url: '/products/charger.svg',
  },
  {
    name: '알루미늄 노트북 스탠드',
    category: '데스크 액세서리',
    description: '6단계 높이 조절로 거북목을 예방하는 접이식 스탠드.\n\n· 10~17인치 노트북 호환\n· 실리콘 미끄럼 방지 패드',
    price_cents: 32900,
    compare_at_price_cents: 39000,
    stock: 80,
    image_url: '/products/stand.svg',
  },
  {
    name: '펠트 데스크 매트 (900×400)',
    category: '데스크 액세서리',
    description: '울 펠트와 PU 레더 양면 사용 데스크 매트.\n\n· 미끄럼 방지 바닥면\n· 생활 방수 코팅',
    price_cents: 24900,
    compare_at_price_cents: null,
    stock: 0,
    image_url: '/products/deskmat.svg',
  },
  {
    name: '무드 데스크 램프 D2',
    category: '조명',
    description: '눈이 편안한 무플리커 LED 스탠드.\n\n· 터치 밝기 5단계\n· USB-C 충전 포트 내장',
    price_cents: 54000,
    compare_at_price_cents: null,
    stock: 35,
    image_url: '/products/lamp.svg',
  },
];

const DEMO_USERS = [
  { email: 'admin@example.com', password: 'Admin@123456', name: '관리자', role: 'admin' },
  { email: 'customer@example.com', password: 'Customer@123456', name: '김고객', role: 'customer' },
] as const;

export async function seedDatabase(): Promise<void> {
  for (const u of DEMO_USERS) {
    const exists = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [u.email]);
    if (exists.rows.length === 0) {
      const hash = await bcryptjs.hash(u.password, 12);
      await query('INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)', [
        u.email,
        hash,
        u.name,
        u.role,
      ]);
      logger.info('Demo user created', { email: u.email, role: u.role });
    }
  }

  const productCheck = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM products');
  if (productCheck.rows[0].count > 0) {
    logger.info('Products already exist, skipping product seed');
    return;
  }

  // 오래된 것부터 넣어 '최신순' 정렬 시 목록 앞쪽 상품이 자연스럽게 보이도록 created_at 을 조금씩 다르게 둡니다.
  const total = DEMO_PRODUCTS.length;
  for (let i = 0; i < total; i++) {
    const p = DEMO_PRODUCTS[total - 1 - i];
    await query(
      `INSERT INTO products (name, category, description, price_cents, compare_at_price_cents, stock, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - ($8 || ' minutes')::interval, NOW())`,
      [p.name, p.category, p.description, p.price_cents, p.compare_at_price_cents, p.stock, p.image_url, String(total - i)]
    );
  }
  logger.info('Demo products seeded', { count: total });
}
