import SectionContainer from './shared/SectionContainer';
import ContactForm from './ContactForm';

export default function ContactSection() {
  return (
    <SectionContainer id="contact" bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-4">
        お気軽にご相談ください
      </h2>
      <p className="text-center text-slate-500 mb-12 max-w-lg mx-auto">
        デモのご依頼、機能のご質問、導入のご相談など、何でもお気軽にお問い合わせください。担当者より2営業日以内にご連絡いたします。
      </p>
      <ContactForm />
    </SectionContainer>
  );
}
