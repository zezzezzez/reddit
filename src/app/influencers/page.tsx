import Sidebar from '@/components/sidebar';
import InfluencersPage from './influencers-page';

export default function Influencers() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <InfluencersPage />
      </main>
    </div>
  );
}
