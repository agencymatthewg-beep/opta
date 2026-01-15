import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import './Layout.css';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
