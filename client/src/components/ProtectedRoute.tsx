import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from './UI';

export function ProtectedRoute({requireStaff=false,permission}:{requireStaff?:boolean;permission?:string}) {
  const { user, loading, accessLoading, isStaff, hasPermission } = useAuth();
  if (loading || (user && accessLoading)) return <div className="page-center"><Loader/></div>;
  if(!user)return <Navigate to="/login" replace/>;
  if(requireStaff&&!isStaff)return <Navigate to="/unauthorized" replace/>;
  if(permission&&!hasPermission(permission))return <Navigate to="/unauthorized" replace/>;
  return <Outlet/>;
}
