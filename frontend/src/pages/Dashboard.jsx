import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RoleForm from '../components/RoleForm';
import RoleList from '../components/RoleList';
import InviteCandidate from '../components/InviteCandidate';

const Dashboard = () => {
    const navigate = useNavigate();
    const [interviewerId, setInterviewerId] = useState(null);
    const [loadingInterviewer, setLoadingInterviewer] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [selectedRole, setSelectedRole] = useState(null);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        // Check if user is authenticated
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        // Fetch interviewer ID
        const fetchInterviewerId = async () => {
            try {
                const response = await axios.get(
                    `${backendUrl}/api/roles/my-interviewer`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                setInterviewerId(response.data.interviewer.id);
            } catch (err) {
                console.error('Failed to fetch interviewer:', err);
                // If interviewer doesn't exist, we'll still show the form
                // The backend will handle creating the interviewer if needed
            } finally {
                setLoadingInterviewer(false);
            }
        };

        fetchInterviewerId();
    }, [navigate, backendUrl]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleRoleAdded = () => {
        // Trigger refresh of role list
        setRefreshTrigger(prev => prev + 1);
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
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '2rem'
                }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Dashboard</h1>
                        <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)' }}>
                            Welcome, {user.email || 'User'}!
                        </p>
                    </div>
                <button 
                    onClick={handleLogout}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#646cff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '500',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#535bf2';
                            e.target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = '#646cff';
                            e.target.style.transform = 'translateY(0)';
                    }}
                >
                    Logout
                </button>
                </div>

                {loadingInterviewer ? (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '2rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                        Loading...
                    </div>
                ) : (
                    <>
                        {interviewerId ? (
                            <>
                                <RoleForm 
                                    interviewerId={interviewerId} 
                                    onRoleAdded={handleRoleAdded}
                                />
                                {selectedRole && (
                                    <InviteCandidate 
                                        roleId={selectedRole.id}
                                        roleTitle={selectedRole.title}
                                    />
                                )}
                            </>
                        ) : (
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '2rem',
                                marginBottom: '2rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255, 255, 255, 0.7)',
                                textAlign: 'center'
                            }}>
                                <p>Please log in with OAuth to create roles, or contact an administrator to set up your interviewer account.</p>
                            </div>
                        )}
                        <RoleList 
                            interviewerId={interviewerId} 
                            refreshTrigger={refreshTrigger}
                            onRoleSelect={setSelectedRole}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;

