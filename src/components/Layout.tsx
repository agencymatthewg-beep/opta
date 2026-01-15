import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <ScrollArea className="flex-1 h-screen">
        <main className="p-8 max-w-7xl">
          {children}
        </main>
      </ScrollArea>
    </div>
  );
}

export default Layout;
