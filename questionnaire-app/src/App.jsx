import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './App.css'; // Keep the main App CSS for general styling

// Lazy loading pages
const QuestionnaireFlow = lazy(() => import('./QuestionnaireFlow'));
const Demo = lazy(() => import('./components/Demo'));
const Stats = lazy(() => import('./components/Stats'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
    Loading Component...
  </div>
);

// Layout component to include Navbar on all routes
const Layout = () => {
  return (
    <>
      <Navbar />
      <div className="main-content" style={{ paddingTop: 60 }}>
        <Outlet />
      </div>
      <Footer />
    </>
  );
};

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<QuestionnaireFlow />} />
            <Route path="demo" element={<Demo />} />
            <Route path="stats" element={<Stats />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
