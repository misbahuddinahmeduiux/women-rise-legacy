import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from './UI';

export function ProtectedRoute({requireStaff=false,permission}:{requireStaff?:boolean;permission?:string}) {
  const { user, loading, access, accessLoading, isStaff, hasPermission } = useAuth();
  const waitingForInitialAccess=Boolean(user&&!access&&accessLoading);
  if(loading||waitingForInitialAccess)return <div className="page-center"><Loader/></div>;
  if(!user)return <Navigate to="/login" replace/>;
  if(requireStaff&&!isStaff)return <Navigate to="/unauthorized" replace/>;
  if(permission&&!hasPermission(permission))return <Navigate to="/unauthorized" replace/>;
  return <Outlet/>;
}
