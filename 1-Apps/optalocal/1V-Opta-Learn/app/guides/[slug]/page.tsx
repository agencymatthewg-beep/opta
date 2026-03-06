import { notFound } from 'next/navigation';
import { GuideViewer } from '@/components/GuideViewer';
import { GUGuideViewer } from '@/components/GUGuideViewer';
import { getGuide, getPublishedGuides } from '@/content/guides';

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getPublishedGuides().map((guide) => ({ slug: guide.slug }));
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  if (guide.format === 'gu' && guide.guFile) {
    return <GUGuideViewer guide={guide} />;
  }

  return <GuideViewer guide={guide} />;
}
