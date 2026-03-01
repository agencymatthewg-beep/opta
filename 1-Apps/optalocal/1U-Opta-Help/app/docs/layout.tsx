import { Nav } from "@/components/layout/Nav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 pt-20">
        <div className="flex gap-8 min-h-[calc(100vh-5rem)]">
          <Sidebar />
          <main className="flex-1 min-w-0 py-8">
            {children}
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}
