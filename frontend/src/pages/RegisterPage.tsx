import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage, getFieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ErrorAlert from '../components/ErrorAlert';
import { Field } from '../components/ui';
import { AuthShell, safeRedirect } from './LoginPage';

type Form = { email: string; name: string; password: string; confirm: string };

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<Form>({ email: '', name: '', password: '', confirm: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const pwChecks = [
    { ok: form.password.length >= 8, label: '8자 이상' },
    { ok: /[A-Za-z]/.test(form.password), label: '영문 포함' },
    { ok: /\d/.test(form.password), label: '숫자 포함' },
  ];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = '이메일 주소를 정확히 입력해 주세요.';
    if (!form.name.trim()) e.name = '이름을 입력해 주세요.';
    if (!pwChecks.every((c) => c.ok)) e.password = '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 해요.';
    if (form.confirm !== form.password) e.confirm = '비밀번호가 서로 달라요.';
    if (!agreeTerms || !agreePrivacy) e.agree = '필수 약관에 동의해 주세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await register(form.email.trim(), form.password, form.name.trim());
      toast.show(`${form.name.trim()}님, 가입을 환영해요.`);
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err, '가입하지 못했습니다.'));
      setBusy(false);
    }
  };

  const allAgree = agreeTerms && agreePrivacy;

  return (
    <AuthShell title="회원가입">
      {error && <ErrorAlert message={error} className="mb-4" />}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="이메일" required error={errors.email}>
          <input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" disabled={busy} />
        </Field>
        <Field id="name" label="이름" required error={errors.name}>
          <input id="name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" maxLength={50} disabled={busy} />
        </Field>
        <Field id="password" label="비밀번호" required error={errors.password}>
          <input id="password" type="password" className={`input ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" disabled={busy} />
          <ul className="mt-2 flex gap-3 text-[13px]" aria-label="비밀번호 조건">
            {pwChecks.map((c) => (
              <li key={c.label} className={c.ok ? 'text-felt' : 'text-ink-mute'}>
                {c.ok ? '✓' : '·'} {c.label}
              </li>
            ))}
          </ul>
        </Field>
        <Field id="confirm" label="비밀번호 확인" required error={errors.confirm}>
          <input id="confirm" type="password" className={`input ${errors.confirm ? 'input-error' : ''}`} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" disabled={busy} />
        </Field>

        <fieldset className="space-y-2.5 rounded-lg border border-line p-4 text-[15px]">
          <legend className="sr-only">약관 동의</legend>
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-line pb-3 font-semibold">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] accent-felt"
              checked={allAgree}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                setAgreePrivacy(e.target.checked);
              }}
            />
            전체 동의
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" className="h-[18px] w-[18px] accent-felt" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
            <span className="flex-1">[필수] 이용약관 동의</span>
            <Link to="/policy/terms" target="_blank" className="text-sm text-ink-mute underline">
              보기
            </Link>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" className="h-[18px] w-[18px] accent-felt" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
            <span className="flex-1">[필수] 개인정보 수집·이용 동의</span>
            <Link to="/policy/privacy" target="_blank" className="text-sm text-ink-mute underline">
              보기
            </Link>
          </label>
          {errors.agree && <p className="field-error">{errors.agree}</p>}
        </fieldset>

        <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? '가입하는 중…' : '가입하기'}
        </button>
      </form>
      <p className="mt-6 text-center text-[15px] text-ink-soft">
        이미 회원이신가요?{' '}
        <Link to="/login" className="font-semibold text-felt underline underline-offset-4">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
};

export default RegisterPage;
