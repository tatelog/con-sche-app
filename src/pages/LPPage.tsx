import LPHeader from '../components/lp/LPHeader';
import HeroSection from '../components/lp/HeroSection';
import ProblemsSection from '../components/lp/ProblemsSection';
import PhilosophySection from '../components/lp/PhilosophySection';
import SolutionSection from '../components/lp/SolutionSection';
import FeaturesSection from '../components/lp/FeaturesSection';
import ComparisonSection from '../components/lp/ComparisonSection';
import WorkflowSection from '../components/lp/WorkflowSection';
import PricingSection from '../components/lp/PricingSection';
import FAQSection from '../components/lp/FAQSection';
import CTASection from '../components/lp/CTASection';
import ContactSection from '../components/lp/ContactSection';
import LPFooter from '../components/lp/LPFooter';
import StickyBottomCTA from '../components/lp/StickyBottomCTA';

export default function LPPage() {
  return (
    <div className="min-h-screen">
      <LPHeader />
      <HeroSection />
      <ProblemsSection />
      <PhilosophySection />
      <SolutionSection />
      <FeaturesSection />
      <ComparisonSection />
      <WorkflowSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <ContactSection />
      <LPFooter />
      <StickyBottomCTA />
    </div>
  );
}
