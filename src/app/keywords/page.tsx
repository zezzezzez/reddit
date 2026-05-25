import Sidebar from '@/components/sidebar';
import KeywordsPage from './keywords-page';

export default function Keywords() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <KeywordsPage />
      </main>
    </div>
  );
}
