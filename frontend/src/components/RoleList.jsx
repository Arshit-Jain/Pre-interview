import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QuestionManager from './QuestionManager';
import './RoleList.css';

const RoleList = ({ interviewerId, refreshTrigger, onRoleSelect, preview = false }) => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [selectedForInvite, setSelectedForInvite] = useState(null);
    const navigate = useNavigate();

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    const fetchRoles = async () => {
        if (!interviewerId) return;
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const endpoint = `${backendUrl}/api/roles/interviewer/${interviewerId}`;
            
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let fetchedRoles = response.data.roles || [];
            // Sort by newest first
            fetchedRoles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            setRoles(fetchedRoles);
        } catch (err) {
            console.error(err);
            setError('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, [interviewerId, refreshTrigger]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    // Filter for preview mode
    const displayRoles = preview ? roles.slice(0, 3) : roles;

    if (loading) return <div className="loading-pulse">Loading roles...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className={`role-list-container ${preview ? 'preview-mode' : ''}`}>
            <div className="list-header">
                <h2>{preview ? 'Recent Roles' : `All Roles (${roles.length})`}</h2>
                {preview && (
                    <button className="view-all-link" onClick={() => navigate('/roles')}>
                        View All &rarr;
                    </button>
                )}
            </div>

            {roles.length === 0 ? (
                <div className="empty-state">
                    <p>No roles found.</p>
                </div>
            ) : (
                <div className="roles-grid">
                    {displayRoles.map((role) => (
                        <div 
                            key={role.id} 
                            className={`role-card ${selectedForInvite === role.id ? 'selected' : ''}`}
                            onClick={() => {
                                if (preview) {
                                    navigate('/roles');
                                }
                            }}
                        >
                            <div className="role-header">
                                <h3 className="role-title">{role.title}</h3>
                                <span className="role-date">{formatDate(role.created_at)}</span>
                            </div>
                            
                            {!preview && (
                                <div className="role-actions">
                                    <button
                                        className="action-btn manage-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedRoleId(role.id);
                                        }}
                                    >
                                        Questions
                                    </button>
                                    <button
                                        className="action-btn invite-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedForInvite(role.id);
                                            if (onRoleSelect) onRoleSelect(role);
                                        }}
                                    >
                                        Invite
                                    </button>
                                </div>
                            )}
                            {preview && <p className="click-hint">Manage &rarr;</p>}
                        </div>
                    ))}
                </div>
            )}

            {!preview && selectedRoleId && (
                <QuestionManager
                    roleId={selectedRoleId}
                    onClose={() => setSelectedRoleId(null)}
                />
            )}
        </div>
    );
};

export default RoleList;