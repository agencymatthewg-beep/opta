"use client";

import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { BenchmarkStrip } from "@/components/BenchmarkStrip";
import { QuickStart } from "@/components/QuickStart";
import { Ecosystem } from "@/components/Ecosystem";
import { DataSync } from "@/components/DataSync";
import { ArchDiagram } from "@/components/ArchDiagram";
import { ModelGrid } from "@/components/ModelGrid";
import { HardwareStats } from "@/components/HardwareStats";
import { CliPreview } from "@/components/CliPreview";
import { FeatureTrio } from "@/components/FeatureTrio";
import { CtaBlock } from "@/components/CtaBlock";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Hero />
        <BenchmarkStrip />
        <QuickStart />
        <HardwareStats />
        <Ecosystem />
        <DataSync />
        <ArchDiagram />
        <ModelGrid />
        <CliPreview />
        <FeatureTrio />
        <CtaBlock />
      </main>
      <Footer />
    </div>
  );
}
