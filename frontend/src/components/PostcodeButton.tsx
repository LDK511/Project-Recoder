import React, { useState } from 'react';

/**
 * 카카오(다음) 우편번호 서비스 — 국내 쇼핑몰 대부분이 쓰는 무료 주소 검색.
 * https://postcode.map.daum.net/guide  (API 키 불필요)
 * 스크립트를 불러오지 못하면(오프라인·차단) 직접 입력하도록 안내합니다.
 */
const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

declare global {
  interface Window {
    daum?: any;
  }
}

let loader: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loader = null;
        reject(new Error('postcode script failed'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export interface PostcodeResult {
  postal_code: string;
  address1: string;
}

const PostcodeButton: React.FC<{ onComplete: (r: PostcodeResult) => void; onUnavailable?: () => void }> = ({
  onComplete,
  onUnavailable,
}) => {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      await loadScript();
      new window.daum.Postcode({
        oncomplete: (data: any) => {
          let addr = data.roadAddress || data.jibunAddress;
          const extra = [data.bname && /[동로가]$/.test(data.bname) ? data.bname : '', data.buildingName && data.apartment === 'Y' ? data.buildingName : '']
            .filter(Boolean)
            .join(', ');
          if (data.roadAddress && extra) addr += ` (${extra})`;
          onComplete({ postal_code: data.zonecode, address1: addr });
        },
      }).open();
    } catch {
      onUnavailable?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="btn-outline shrink-0" onClick={open} disabled={loading}>
      {loading ? '여는 중…' : '주소 검색'}
    </button>
  );
};

export default PostcodeButton;
