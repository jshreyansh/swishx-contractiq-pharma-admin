import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/OrdersList';
import OrderDetail from './pages/OrderDetail';
import CFAQueue from './pages/CFAQueue';
import DivisionWorkspace from './pages/DivisionWorkspace';
import FinalApproval from './pages/FinalApproval';
import RateContracts from './pages/RateContracts';
import RateContractDetail from './pages/RateContractDetail';
import Reports from './pages/Reports';
import Config from './pages/Config';
import Catalogue from './pages/Catalogue';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
             <Route path="/orders" element={<OrdersList />} />
             <Route path="/orders/:id" element={<OrderDetail />} />
             <Route path="/rate-contracts" element={<RateContracts />} />
             <Route path="/rate-contracts/:id" element={<RateContractDetail />} />
            <Route path="/cfa-queue" element={<CFAQueue />} />
            <Route path="/division" element={<DivisionWorkspace />} />
            <Route path="/final-approval" element={<FinalApproval />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/config" element={<Config />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
