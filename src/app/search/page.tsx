import Sidebar from '@/components/sidebar';
import SearchPage from './search-page';

export default function Page() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <SearchPage />
      </main>
    </div>
  );
}
