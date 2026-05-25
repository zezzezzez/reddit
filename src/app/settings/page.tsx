import Sidebar from '@/components/sidebar';
import SettingsPage from './settings-page';

export default function Settings() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <SettingsPage />
      </main>
    </div>
  );
}
