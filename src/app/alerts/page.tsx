import Sidebar from '@/components/sidebar';
import AlertsPage from './alerts-page';

export default function Alerts() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AlertsPage />
      </main>
    </div>
  );
}
