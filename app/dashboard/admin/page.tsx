'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminProtection from '@/components/AdminProtection';
import { useAuth } from '@/app/provider';
import { isAdmin } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { UsersSection } from '@/components/admin/UsersSection';
import { AdminServersSection } from '@/components/admin/AdminServersSection';

type TabKey = 'servers' | 'users';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'servers', label: 'Servers' },
  { key: 'users', label: 'Users' },
];

export default function AdminPage() {
  const searchParams = useSearchParams();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const userIsAdmin = isAdmin(authUser);

  const [activeTab, setActiveTab] = useState<TabKey>('servers');

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabKey | null;
    if (tabParam && (tabParam === 'servers' || tabParam === 'users')) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const getAccessToken = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  return (
    <AdminProtection>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/60 mt-2">Manage users and system settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-white border-b-2 border-[#60A5FA]'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'servers' && (
          <AdminServersSection getAccessToken={getAccessToken} />
        )}

        {activeTab === 'users' && (
          <UsersSection
            isAdmin={userIsAdmin}
            currentUserId={currentUserId}
            getAccessToken={getAccessToken}
          />
        )}
      </div>
    </AdminProtection>
  );
}
