import React from 'react';
import { Link } from 'react-router-dom';
import { useStoreConfig } from '../context/ConfigContext';

/**
 * 하단 사업자 정보 — 전자상거래법 제10조(사이버몰 운영자의 표시의무)에 따른 필수 표시 항목.
 * 값은 백엔드 환경변수(STORE_*)에서 내려옵니다.
 */
const Footer: React.FC = () => {
  const { store } = useStoreConfig();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-line bg-well/60 text-[13px] text-ink-soft">
      <div className="shell grid gap-8 py-10 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink" aria-label="정책">
            <Link to="/policy/terms">이용약관</Link>
            <Link to="/policy/privacy" className="text-felt">
              개인정보처리방침
            </Link>
            <Link to="/policy/shipping">배송·교환·반품 안내</Link>
          </nav>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-mute">상호</dt>
            <dd>
              {store.companyName} <span className="text-ink-mute">| 대표</span> {store.ceo}
            </dd>
            <dt className="text-ink-mute">사업자등록번호</dt>
            <dd>
              {store.businessNumber}{' '}
              <a
                className="underline underline-offset-2"
                href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${store.businessNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                사업자정보 확인
              </a>
            </dd>
            <dt className="text-ink-mute">통신판매업신고</dt>
            <dd>{store.mailOrderNumber}</dd>
            <dt className="text-ink-mute">주소</dt>
            <dd>{store.address}</dd>
            <dt className="text-ink-mute">개인정보보호책임자</dt>
            <dd>{store.privacyOfficer}</dd>
            <dt className="text-ink-mute">호스팅 서비스</dt>
            <dd>{store.hostingProvider}</dd>
          </dl>
        </div>
        <div className="space-y-1 md:text-right">
          <p className="font-semibold text-ink">고객센터</p>
          <p className="num text-xl font-bold text-ink">{store.phone}</p>
          <p>{store.csHours}</p>
          <p>
            <a href={`mailto:${store.email}`} className="underline underline-offset-2">
              {store.email}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="shell py-4 text-ink-mute">
          © {year} {store.companyName}. 안전한 거래를 위해 결제 정보는 결제대행사(PG)를 통해서만 처리되며 쇼핑몰은 카드 정보를 저장하지 않습니다.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
