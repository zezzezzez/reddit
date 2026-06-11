'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Users,
  Hash,
  BarChart3,
  Tv,
} from 'lucide-react';

const navItems = [
  { href: '/', label: '监控面板', icon: LayoutDashboard },
  { href: '/posts', label: '帖子管理', icon: FileText },
  { href: '/alerts', label: '预警事件', icon: Bell },
  { href: '/influencers', label: '恶意评论追踪', icon: Users },
  { href: '/keywords', label: '关键词热度', icon: Hash },
  { href: '/compare', label: '板块对比', icon: BarChart3 },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } h-screen bg-card border-r border-border flex flex-col transition-all duration-300 sticky top-0`}
    >
      {/* Logo with Hisense Icon */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30">
            <Tv className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-foreground leading-tight">Hisense</h1>
              <p className="text-xs text-cyan-600 font-medium leading-tight">海信舆情监控</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 px-1 py-1.5 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-100">
            <Bell className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-xs text-cyan-700 font-medium">评论监控预警</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted hover:bg-card-hover hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-card-hover hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-sm">收起</span>}
        </button>
      </div>
    </aside>
  );
}
