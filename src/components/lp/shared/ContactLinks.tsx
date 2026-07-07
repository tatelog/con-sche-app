import { Mail, Video } from 'lucide-react';
import { CONTACT } from '../../../data/lpContent';

export default function ContactLinks() {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <a
        href={`mailto:${CONTACT.email}`}
        className="flex items-center gap-4 p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border border-slate-100"
      >
        <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
          <Mail size={24} className="text-primary-600" />
        </div>
        <div>
          <div className="font-bold text-slate-800">お問い合わせフォーム</div>
          <div className="text-sm text-slate-500">メールでご相談ください</div>
        </div>
      </a>
      <a
        href={CONTACT.meetingUrl}
        className="flex items-center gap-4 p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border border-slate-100"
      >
        <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
          <Video size={24} className="text-primary-600" />
        </div>
        <div>
          <div className="font-bold text-slate-800">オンラインMTG予約</div>
          <div className="text-sm text-slate-500">デモ・ご説明を承ります</div>
        </div>
      </a>
    </div>
  );
}
