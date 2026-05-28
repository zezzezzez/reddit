import Sidebar from '@/components/sidebar';
import CompetitorPage from './competitor-page';

export default function Competitor() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <CompetitorPage />
      </main>
    </div>
  );
}
