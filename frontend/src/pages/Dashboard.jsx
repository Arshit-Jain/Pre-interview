// Refactored layout structure for better responsiveness
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RoleList from '../components/RoleList';
import RecentResponses from '../components/RecentResponses';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [interviewerId, setInterviewerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const backendUrl = import.meta.env.BACKEND_URL;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        const fetchInterviewer = async () => {
            try {
                const response = await axios.get(`${backendUrl}/api/roles/my-interviewer`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setInterviewerId(response.data.interviewer.id);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInterviewer();
    }, [navigate, backendUrl]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-text">
                    <h1>Dashboard</h1>
                    <p>Welcome back, <span className="user-highlight">{user.email}</span></p>
                </div>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </header>

            {loading ? (
                <div className="loading-spinner">Loading...</div>
            ) : (
                <main className="dashboard-grid">
                    <section className="quick-actions">
                        <div className="action-card primary" onClick={() => navigate('/roles')}>
                            <span className="icon">+</span>
                            <div>
                                <h3>New Role</h3>
                                <p>Create job & invite</p>
                            </div>
                        </div>
                        <div className="action-card" onClick={() => navigate('/responses')}>
                            <span className="icon">≡</span>
                            <div>
                                <h3>All Responses</h3>
                                <p>View submissions</p>
                            </div>
                        </div>
                    </section>

                    <section className="widget widget-roles">
                        <RoleList 
                            interviewerId={interviewerId} 
                            preview={true}
                            onRoleSelect={() => navigate('/roles')} 
                        />
                    </section>

                    <section className="widget widget-activity">
                        <RecentResponses limit={4} />
                    </section>
                </main>
            )}
        </div>
    );
};

export default Dashboard;