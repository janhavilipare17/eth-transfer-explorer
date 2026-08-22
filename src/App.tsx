import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TransferDashboard from './pages/TransferDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TransferDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;