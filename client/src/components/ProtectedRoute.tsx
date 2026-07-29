import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from './UI';

type ProtectedRouteProps = {
  access?: 'authenticated' | 'mentor' | 'admin';
};

export function ProtectedRoute({ access = 'authenticated' }: ProtectedRouteProps) {
  const {
    user,
    loading,
    profileLoading,
    canAccessAdmin,
    canAccessMentor
  } = useAuth();

  if (loading || (user && profileLoading)) {
    return <div className="page-center"><Loader /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (access === 'admin' && !canAccessAdmin) return <Navigate to="/dashboard" replace />;
  if (access === 'mentor' && !canAccessMentor) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
