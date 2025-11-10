'use client';

import { useAuth } from '@/app/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isAdmin } from '@/lib/utils';
import { FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AdminProtectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AdminProtection({ children, fallback }: AdminProtectionProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin(user)) {
    return fallback || (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Card className="max-w-md bg-white/5 border-white/10 text-center text-white/80">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-4">
              <FaShieldAlt className="h-6 w-6 text-amber-400" />
            </div>
            <CardTitle className="text-white">Admin Access Required</CardTitle>
            <CardDescription className="text-white/70">
              You need administrator permissions to access this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-white/50 space-y-1">
              <div>User: {user.email}</div>
              <div>User ID: {user.id}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}