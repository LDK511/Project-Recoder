import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useStoreConfig } from '../context/ConfigContext';
import ErrorAlert from '../components/ErrorAlert';
import { Field } from '../components/ui';

/** 외부 주소로의 리다이렉트를 막기 위해 같은 사이트 경로만 허용 */
export function safeRedirect(raw: string | null, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

export const AuthShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="shell flex justify-center pt-10 sm:pt-16">
    <div className="w-full max-w-[400px]">
      <h1 className="text-center text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  </div>
);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const cfg = useStoreConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = safeRedirect(params.get('redirect'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(redirect === '/' && user.role === 'admin' ? '/admin' : redirect, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, '로그인하지 못했습니다.'));
      setBusy(false);
    }
  };

  const fillDemo = (who: 'customer' | 'admin') => {
    setEmail(who === 'admin' ? 'admin@example.com' : 'customer@example.com');
    setPassword(who === 'admin' ? 'Admin@123456' : 'Customer@123456');
  };

  return (
    <AuthShell title="로그인">
      {params.get('expired') && <ErrorAlert tone="info" message="로그인 시간이 만료되었어요. 다시 로그인해 주세요." className="mb-4" />}
      {error && <ErrorAlert message={error} className="mb-4" />}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="email" label="이메일">
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            disabled={busy}
            autoFocus
          />
        </Field>
        <Field id="password" label="비밀번호">
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
        </Field>
        <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? '로그인하는 중…' : '로그인'}
        </button>
      </form>
      <p className="mt-6 text-center text-[15px] text-ink-soft">
        아직 회원이 아니신가요?{' '}
        <Link to={`/register${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-felt underline underline-offset-4">
          회원가입
        </Link>
      </p>

      {cfg.test_payment_mode && (
        <div className="mt-10 rounded-lg border border-dashed border-line p-4 text-sm">
          <p className="font-semibold">데모 계정</p>
          <p className="mt-1 text-ink-mute">테스트 모드에서만 보이는 안내입니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => fillDemo('customer')}>
              고객으로 입력
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => fillDemo('admin')}>
              관리자로 입력
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
};

export default LoginPage;
