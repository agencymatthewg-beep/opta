import { LearnHomeClient } from '@/components/LearnHomeClient';
import { getPublishedGuideSearchEntries } from '@/content/guides';

export default function HomePage() {
  return <LearnHomeClient guides={getPublishedGuideSearchEntries()} />;
}
