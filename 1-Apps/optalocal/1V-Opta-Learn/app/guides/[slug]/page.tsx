import { notFound } from 'next/navigation';
import { GuideViewer } from '@/components/GuideViewer';
import { allGuides, getGuide } from '@/content/guides';

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return allGuides.map((guide) => ({ slug: guide.slug }));
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  return <GuideViewer guide={guide} />;
}
