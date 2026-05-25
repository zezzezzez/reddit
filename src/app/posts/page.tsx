import Sidebar from '@/components/sidebar';
import PostsPage from './posts-page';

export default function Posts() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PostsPage />
      </main>
    </div>
  );
}
