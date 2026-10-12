import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useStoreConfig } from '../context/ConfigContext';
import { ShippingPolicy } from './ProductDetailPage';
import NotFoundPage from './NotFoundPage';

/**
 * 약관·개인정보처리방침·배송/반품 안내.
 * 공정거래위원회 전자상거래 표준약관과 개인정보보호위원회 처리방침 작성지침의 항목 구성을 따른 기본 문안입니다.
 * 운영 전 실제 사업 내용(위탁 업체, 보관 기간 등)에 맞게 반드시 검토·수정하세요.
 */
const Terms: React.FC = () => {
  const { store } = useStoreConfig();
  return (
    <>
      <h2>제1조 (목적)</h2>
      <p>
        이 약관은 {store.companyName}(이하 "회사")가 운영하는 온라인 쇼핑몰 {store.name}(이하 "몰")에서 제공하는 전자상거래 관련 서비스를
        이용할 때 회사와 이용자의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.
      </p>
      <h2>제2조 (구매신청 및 계약의 성립)</h2>
      <p>
        이용자는 몰에서 상품을 선택하고 배송지와 결제 정보를 입력한 뒤, 주문 내용을 확인하고 결제에 동의하는 방법으로 구매를 신청합니다. 회사가 결제
        완료를 확인한 때에 계약이 성립합니다.
      </p>
      <h2>제3조 (청약철회 등)</h2>
      <p>
        이용자는 상품을 받은 날부터 7일 이내에 청약을 철회할 수 있습니다. 다만 이용자의 책임으로 상품이 멸실·훼손되었거나, 사용으로 상품 가치가 현저히
        감소한 경우 등 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 해당하면 청약철회가 제한될 수 있습니다.
      </p>
      <h2>제4조 (환급)</h2>
      <p>회사는 청약철회로 상품을 반환받은 날부터 3영업일 이내에 결제 대금을 환급합니다.</p>
      <h2>제5조 (분쟁해결)</h2>
      <p>
        이용자의 불만은 고객센터({store.phone}, {store.email})로 접수하며, 회사는 신속히 처리합니다. 분쟁이 해결되지 않으면 공정거래위원회 또는
        시·도지사가 의뢰하는 분쟁조정기관의 조정에 따를 수 있습니다.
      </p>
    </>
  );
};

const Privacy: React.FC = () => {
  const { store } = useStoreConfig();
  return (
    <>
      <h2>1. 수집하는 개인정보 항목과 목적</h2>
      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>항목</th>
            <th>목적</th>
            <th>보유 기간</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>회원가입</td>
            <td>이메일, 이름, 비밀번호(암호화)</td>
            <td>회원 식별, 로그인</td>
            <td>회원 탈퇴 시까지</td>
          </tr>
          <tr>
            <td>주문·배송</td>
            <td>받는 분 이름, 휴대폰 번호, 주소, 배송 메모</td>
            <td>상품 배송, 배송 관련 연락</td>
            <td>5년 (전자상거래법)</td>
          </tr>
          <tr>
            <td>결제</td>
            <td>결제 승인번호 (카드번호는 PG사가 처리하며 회사는 저장하지 않음)</td>
            <td>결제 확인, 환불</td>
            <td>5년 (전자상거래법)</td>
          </tr>
        </tbody>
      </table>
      <h2>2. 개인정보의 제3자 제공 및 처리위탁</h2>
      <p>회사는 배송과 결제를 위해 택배사, 결제대행사(PG)에 필요한 최소한의 정보를 위탁합니다. 위탁 업체 목록은 운영 시작 전 이 곳에 기재합니다.</p>
      <h2>3. 개인정보의 파기</h2>
      <p>보유 기간이 끝난 개인정보는 지체 없이 복구할 수 없는 방법으로 파기합니다.</p>
      <h2>4. 이용자의 권리</h2>
      <p>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있으며, 고객센터로 요청하면 지체 없이 조치합니다.</p>
      <h2>5. 개인정보 보호책임자</h2>
      <p>
        성명: {store.privacyOfficer} · 연락처: {store.phone} · 이메일: {store.email}
      </p>
    </>
  );
};

const PAGES: Record<string, { title: string; body: React.FC }> = {
  terms: { title: '이용약관', body: Terms },
  privacy: { title: '개인정보처리방침', body: Privacy },
  shipping: { title: '배송·교환·반품 안내', body: ShippingPolicy },
};

const PolicyPage: React.FC = () => {
  const { kind = '' } = useParams<{ kind: string }>();
  const page = PAGES[kind];
  if (!page) return <NotFoundPage />;
  const Body = page.body;
  return (
    <div className="shell max-w-3xl pt-8">
      <nav className="flex gap-1 border-b border-line text-[15px]">
        {Object.entries(PAGES).map(([k, p]) => (
          <NavLink
            key={k}
            to={`/policy/${k}`}
            className={({ isActive }) => `-mb-px border-b-2 px-3 py-3 ${isActive ? 'border-ink font-bold' : 'border-transparent text-ink-mute hover:text-ink'}`}
          >
            {p.title}
          </NavLink>
        ))}
      </nav>
      <h1 className="page-title mt-8">{page.title}</h1>
      <article className="policy mt-6 text-[15px] leading-[1.8] text-ink-soft [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-ink [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-well [&_th]:p-2 [&_th]:text-left">
        <Body />
      </article>
    </div>
  );
};

export default PolicyPage;
