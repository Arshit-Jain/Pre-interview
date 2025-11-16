import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Interview from './pages/Interview.jsx';
import AllResponses from './pages/AllResponses.jsx';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" state={{ from: { pathname: window.location.pathname } }} replace />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/interview/:token" element={<Interview />} />
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/responses" 
                    element={
                        <ProtectedRoute>
                            <AllResponses />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/responses/:token" 
                    element={
                        <ProtectedRoute>
                            <AllResponses />
                        </ProtectedRoute>
                    } 
                />
                <Route path="/dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
