import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { OptaExplainer } from "@/components/OptaExplainer";
import { ActivationFlow } from "@/components/ActivationFlow";
import { BenchmarkStrip } from "@/components/BenchmarkStrip";
import { QuickStart } from "@/components/QuickStart";
import { Ecosystem } from "@/components/Ecosystem";
import { ModelGrid } from "@/components/ModelGrid";
import { HardwareStats } from "@/components/HardwareStats";
import { CliPreview } from "@/components/CliPreview";
import { CtaBlock } from "@/components/CtaBlock";
import { Footer } from "@/components/Footer";
import { MotionRoot } from "@/components/MotionRoot";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Nav />
      <MotionRoot>
        <main id="main-content" tabIndex={-1}>
          <Hero />
          <OptaExplainer />
          <ActivationFlow />
          <BenchmarkStrip />
          <QuickStart />
          <HardwareStats />
          <Ecosystem />
          <ModelGrid />
          <CliPreview />
          <CtaBlock />
        </main>
      </MotionRoot>
      <Footer />
    </div>
  );
}
