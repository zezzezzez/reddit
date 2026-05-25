import Sidebar from '@/components/sidebar';
import ComparePage from './compare-page';

export default function Compare() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <ComparePage />
      </main>
    </div>
  );
}
