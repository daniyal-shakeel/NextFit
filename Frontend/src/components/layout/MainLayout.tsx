import { Outlet } from 'react-router-dom';
import { FeatureConfigProvider } from '@/lib/featureConfig';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function MainLayout() {
  return (
    <FeatureConfigProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-16">
          <Outlet />
        </main>
        <Footer />
      </div>
    </FeatureConfigProvider>
  );
}
