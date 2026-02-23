import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="md:pl-64">
        <AdminHeader />
        <main className="p-4 md:p-6 pt-16 md:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};