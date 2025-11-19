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
    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchInterviewer = async () => {
            try {
                const response = await axios.get(
                    `${backendUrl}/api/roles/my-interviewer`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                setInterviewerId(response.data.interviewer.id);
            } catch (err) {
                console.error('Failed to fetch interviewer data', err);
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
            {/* Header Section */}
            <div className="dashboard-header">
                <div className="welcome-section">
                    <h1>Dashboard</h1>
                    <p>Welcome back, {user.email || 'Recruiter'}!</p>
                </div>
                <div className="header-controls">
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="dashboard-loading">Loading your dashboard...</div>
            ) : (
                <div className="dashboard-grid">
                    {/* Quick Actions Card */}
                    <div className="action-card-container">
                        <div className="action-card" onClick={() => navigate('/roles')}>
                            <div className="action-icon">+</div>
                            <div className="action-text">
                                <h3>Add New Role</h3>
                                <p>Create a new job role and invite candidates.</p>
                            </div>
                            <div className="action-arrow">&rarr;</div>
                        </div>
                        <div className="action-card secondary" onClick={() => navigate('/responses')}>
                            <div className="action-icon">≡</div>
                            <div className="action-text">
                                <h3>View All Responses</h3>
                                <p>Browse all candidate submissions.</p>
                            </div>
                            <div className="action-arrow">&rarr;</div>
                        </div>
                    </div>

                    {/* Recent Roles Preview */}
                    <div className="widget-container">
                        <RoleList 
                            interviewerId={interviewerId} 
                            preview={true}
                            onRoleSelect={() => navigate('/roles')} // Redirect on click in preview
                        />
                    </div>

                    {/* Recent Responses Preview */}
                    <div className="widget-container">
                        <RecentResponses limit={4} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;