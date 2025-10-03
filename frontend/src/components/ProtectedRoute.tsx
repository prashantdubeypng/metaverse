'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getUserRole } from '@/utils/auth';
import LoadingScreen from '@/components/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'User' | 'Admin';
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo 
}: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      const userRole = getUserRole();

      // If specific role is required, check it
      if (requiredRole && userRole !== requiredRole) {
        // Redirect based on user's actual role
        if (userRole === 'Admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
        return;
      }

      // If redirectTo is specified and no role requirement, redirect there
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }

      setHasAccess(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router, requiredRole, redirectTo]);

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (!hasAccess) {
    return <LoadingScreen message="Redirecting..." />;
  }

  return <>{children}</>;
}