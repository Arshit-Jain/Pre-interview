import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            padding: '2rem',
            color: '#fff'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <h1>Dashboard</h1>
                <p>Welcome, {user.email || 'User'}!</p>
                <button 
                    onClick={handleLogout}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#646cff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginTop: '1rem'
                    }}
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Dashboard;

