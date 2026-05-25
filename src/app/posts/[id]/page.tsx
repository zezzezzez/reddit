import Sidebar from '@/components/sidebar';
import PostDetailPage from './detail-page';

export default function PostDetail() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PostDetailPage />
      </main>
    </div>
  );
}
