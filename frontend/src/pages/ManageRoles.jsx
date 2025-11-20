import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RoleForm from '../components/RoleForm';
import RoleList from '../components/RoleList';
import InviteCandidate from '../components/InviteCandidate';
import QuestionManager from '../components/QuestionManager';
import './ManageRoles.css';

const ManageRoles = () => {
    const navigate = useNavigate();
    const [interviewerId, setInterviewerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedRoleForQuestions, setSelectedRoleForQuestions] = useState(null);
    const [selectedRoleForInvite, setSelectedRoleForInvite] = useState(null);
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
        setShowCreateForm(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="manage-roles-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <h1>Manage Roles</h1>
                    <p>Create roles and invite candidates.</p>
                </div>
                <div className="header-actions">
                    <button className="header-btn" onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </button>
                    <button className="header-btn logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="roles-layout">
                <div className="controls-bar">
                     <button 
                        className="create-role-btn"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        {showCreateForm ? 'Cancel' : '+ Create New Role'}
                    </button>
                </div>

                {showCreateForm && (
                    <div className="create-form-wrapper">
                        <RoleForm 
                            interviewerId={interviewerId} 
                            onRoleAdded={handleRoleAdded} 
                        />
                    </div>
                )}

                <div className="list-section">
                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : (
                        <RoleList 
                            interviewerId={interviewerId}
                            refreshTrigger={refreshTrigger}
                            onManageQuestions={setSelectedRoleForQuestions}
                            onInvite={setSelectedRoleForInvite}
                            preview={false}
                        />
                    )}
                </div>
            </div>

            {/* Side Drawer for Questions */}
            {selectedRoleForQuestions && (
                <div className="side-drawer-overlay" onClick={() => setSelectedRoleForQuestions(null)}>
                    <div className="side-drawer" onClick={e => e.stopPropagation()}>
                        <QuestionManager
                            roleId={selectedRoleForQuestions.id}
                            roleTitle={selectedRoleForQuestions.title}
                            onClose={() => setSelectedRoleForQuestions(null)}
                        />
                    </div>
                </div>
            )}

            {/* Modal for Invite */}
            {selectedRoleForInvite && (
                <div className="modal-overlay" onClick={() => setSelectedRoleForInvite(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <InviteCandidate 
                            roleId={selectedRoleForInvite.id}
                            roleTitle={selectedRoleForInvite.title}
                            onClose={() => setSelectedRoleForInvite(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageRoles;