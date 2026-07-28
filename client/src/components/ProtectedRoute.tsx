import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from './UI';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center"><Loader/></div>;
  return user ? <Outlet/> : <Navigate to="/login" replace/>;
}
