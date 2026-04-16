import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../ui/ToastContainer';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-app-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-5 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
