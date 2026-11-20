import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { LandingPage } from '@/pages/LandingPage';
import { NavigationPage } from '@/pages/NavigationPage';
import { ReportPage } from '@/pages/ReportPage';
import { AdminPage } from '@/pages/AdminPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <RootLayout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/navigate" element={<NavigationPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RootLayout>
    </BrowserRouter>
  );
};

export default App;
