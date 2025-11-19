import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RoleForm from '../components/RoleForm';
import RoleList from '../components/RoleList';
import InviteCandidate from '../components/InviteCandidate';
import './ManageRoles.css';

const ManageRoles = () => {
    const navigate = useNavigate();
    const [interviewerId, setInterviewerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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

    const handleRoleAdded = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="manage-roles-page">
            <div className="page-header">
                <div className="header-content">
                    <h1>Manage Roles</h1>
                    <p>Create roles, manage questions, and invite candidates.</p>
                </div>
                <div className="header-actions">
                    <button className="nav-btn" onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </button>
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            <div className="roles-layout">
                {loading ? (
                    <div className="loading-state">Loading...</div>
                ) : (
                    <>
                        <div className="creation-section">
                            <RoleForm 
                                interviewerId={interviewerId} 
                                onRoleAdded={handleRoleAdded} 
                            />
                            
                            {selectedRole && (
                                <div className="invite-section">
                                    <InviteCandidate 
                                        roleId={selectedRole.id}
                                        roleTitle={selectedRole.title}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="list-section">
                            <RoleList 
                                interviewerId={interviewerId}
                                refreshTrigger={refreshTrigger}
                                onRoleSelect={setSelectedRole}
                                preview={false} // Full list mode
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ManageRoles;