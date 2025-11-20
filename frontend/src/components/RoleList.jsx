import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RoleList.css';

const RoleList = ({ interviewerId, refreshTrigger, onManageQuestions, onInvite, preview = false }) => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
                            className="role-card"
                        >
                            <div className="role-card-top">
                                <h3 className="role-title">{role.title}</h3>
                                <span className="role-date-badge">{formatDate(role.created_at)}</span>
                            </div>
                            
                            {!preview ? (
                                <div className="role-card-actions">
                                    <button
                                        className="card-btn btn-questions"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onManageQuestions) onManageQuestions(role);
                                        }}
                                    >
                                        Questions
                                    </button>
                                    <button
                                        className="card-btn btn-invite"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onInvite) onInvite(role);
                                        }}
                                    >
                                        Invite
                                    </button>
                                </div>
                            ) : (
                                <div className="role-card-actions">
                                    <button 
                                        className="card-btn btn-view"
                                        onClick={() => navigate('/roles')}
                                    >
                                        Manage
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RoleList;