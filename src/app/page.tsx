import Sidebar from '@/components/sidebar';
import DashboardPage from './dashboard-page';

export default function Home() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DashboardPage />
      </main>
    </div>
  );
}
