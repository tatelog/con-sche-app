import { useState, type FormEvent } from 'react';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'decision_maker', label: '意思決定者（発注権限あり）' },
  { value: 'proposer_planned', label: '提案する側（社内稟議予定）' },
  { value: 'proposer_undecided', label: '提案する側（稟議は未定）' },
  { value: 'other', label: 'その他' },
] as const;

const OTHER_PURPOSE_OPTIONS = [
  { value: 'research', label: '情報収集' },
  { value: 'reseller', label: '販路・販売代理店' },
  { value: 'media', label: 'メディア・取材' },
  { value: 'other', label: 'その他' },
] as const;

const INQUIRY_OPTIONS = [
  { value: 'demo', label: 'デモ依頼' },
  { value: 'feature_detail', label: '機能の詳細説明' },
  { value: 'adoption', label: '導入相談' },
] as const;

const TIME_OPTIONS = [
  { value: 'morning', label: '午前（9:00〜12:00）' },
  { value: 'afternoon', label: '午後（13:00〜17:00）' },
  { value: 'evening', label: '夕方以降（17:00〜）' },
  { value: 'any', label: '指定なし' },
] as const;

function formatPhone(value: string): string {
  // 全角→半角
  let v = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  v = v.replace(/[ー−‐―]/g, '-');
  // 数字とハイフン以外を除去
  v = v.replace(/[^\d-]/g, '');
  // ハイフンを除去して数字だけにしてから自動ハイフン
  const digits = v.replace(/-/g, '');
  if (digits.startsWith('0120') || digits.startsWith('0800')) {
    // フリーダイヤル: 0120-XXX-XXX / 0800-XXX-XXXX
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.startsWith('090') || digits.startsWith('080') || digits.startsWith('070') || digits.startsWith('050')) {
    // 携帯/IP: 0X0-XXXX-XXXX
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.startsWith('03') || digits.startsWith('06')) {
    // 東京/大阪: 0X-XXXX-XXXX
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  // その他の固定電話: 0XXX-XX-XXXX
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 10)}`;
}

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'メール' },
  { value: 'phone', label: '電話' },
] as const;

interface FormData {
  companyName: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  role: string;
  otherPurpose: string;
  inquiryTypes: string[];
  contactMethod: string;
  preferredTime: string;
  message: string;
}

const initialFormData: FormData = {
  companyName: '',
  name: '',
  email: '',
  phone: '',
  jobTitle: '',
  department: '',
  role: '',
  otherPurpose: '',
  inquiryTypes: [],
  contactMethod: 'email',
  preferredTime: 'any',
  message: '',
};

export default function ContactForm() {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleCheckbox = (value: string) => {
    setForm((prev) => ({
      ...prev,
      inquiryTypes: prev.inquiryTypes.includes(value)
        ? prev.inquiryTypes.filter((v) => v !== value)
        : [...prev.inquiryTypes, value],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('送信に失敗しました');
      setStatus('sent');
      setForm(initialFormData);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">お問い合わせありがとうございます</h3>
        <p className="text-slate-600">
          内容を確認の上、担当者より2営業日以内にご連絡いたします。
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-primary-600 hover:underline text-sm"
        >
          別のお問い合わせを送る
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {status === 'error' && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} />
          送信に失敗しました。時間をおいて再度お試しください。
        </div>
      )}

      {/* 会社名・お名前 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="会社名" required>
          <input
            type="text"
            required
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="株式会社〇〇建設"
            className="form-input"
          />
        </Field>
        <Field label="お名前" required>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="山田 太郎"
            className="form-input"
          />
        </Field>
      </div>

      {/* メール・電話 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="メールアドレス" required>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="yamada@example.co.jp"
            className="form-input"
          />
        </Field>
        <Field label="電話番号">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            placeholder="03-1234-5678"
            className="form-input"
          />
        </Field>
      </div>

      {/* 役職・所属 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="役職">
          <input
            type="text"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            placeholder="工事部長"
            className="form-input"
          />
        </Field>
        <Field label="所属（部門）">
          <input
            type="text"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="東京支店 工事部"
            className="form-input"
          />
        </Field>
      </div>
      <p className="text-xs text-slate-400 -mt-4">
        ※ 役員の方は所属の入力は不要です
      </p>

      {/* 立場 */}
      <Field label="お立場" required>
        <select
          required
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value, otherPurpose: '' })}
          className="form-input"
        >
          <option value="">選択してください</option>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </Field>

      {/* その他の場合：目的 */}
      {form.role === 'other' && (
        <Field label="ご利用目的" required>
          <select
            required
            value={form.otherPurpose}
            onChange={(e) => setForm({ ...form, otherPurpose: e.target.value })}
            className="form-input"
          >
            <option value="">選択してください</option>
            {OTHER_PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>
      )}

      {/* ご相談内容（複数選択） */}
      <Field label="ご相談内容（複数選択可）" required>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INQUIRY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-colors text-sm ${
                form.inquiryTypes.includes(opt.value)
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={form.inquiryTypes.includes(opt.value)}
                onChange={() => handleCheckbox(opt.value)}
                className="accent-primary-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>

      {/* ご希望の連絡方法 */}
      <Field label="ご希望の連絡方法">
        <div className="flex flex-wrap gap-3">
          {CONTACT_METHOD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`px-4 py-2 rounded-full border cursor-pointer transition-colors text-sm ${
                form.contactMethod === opt.value
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="contactMethod"
                value={opt.value}
                checked={form.contactMethod === opt.value}
                onChange={(e) => setForm({ ...form, contactMethod: e.target.value })}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>

      {/* 都合の良い時間帯（電話の場合のみ） */}
      {form.contactMethod === 'phone' && (
        <Field label="ご都合の良い時間帯">
          <div className="flex flex-wrap gap-3">
            {TIME_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`px-4 py-2 rounded-full border cursor-pointer transition-colors text-sm ${
                  form.preferredTime === opt.value
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="preferredTime"
                  value={opt.value}
                  checked={form.preferredTime === opt.value}
                  onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* 自由記述 */}
      <Field label="お問い合わせ内容">
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          placeholder="具体的なご質問やご要望がありましたらご記入ください"
          className="form-input resize-none"
        />
      </Field>

      {/* 送信ボタン */}
      <div className="text-center pt-2">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <Send size={18} />
          {status === 'sending' ? '送信中...' : '送信する'}
        </button>
        <p className="text-xs text-slate-400 mt-3">
          送信いただいた情報は
          <a href="/privacy" className="underline hover:text-slate-600">プライバシーポリシー</a>
          に基づき適切に取り扱います。
        </p>
        <p className="text-xs text-slate-400 mt-1">
          ※ 同業他社（工程管理ソフトウェアの開発・販売を行う企業）からのお問い合わせ、
          または情報収集のみを目的としたお問い合わせについては、お断りさせていただく場合がございます。
        </p>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
