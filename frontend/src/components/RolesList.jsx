import { useState, useEffect } from 'react';
import axios from 'axios';
import QuestionManager from './QuestionManager';
import InterviewResponses from './InterviewResponses';
import './RoleList.css';

const RoleList = ({ interviewerId, refreshTrigger, onRoleSelect }) => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [selectedForInvite, setSelectedForInvite] = useState(null);
    const [selectedForResponses, setSelectedForResponses] = useState(null);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    const fetchRoles = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const endpoint = interviewerId 
                ? `${backendUrl}/api/roles/interviewer/${interviewerId}`
                : `${backendUrl}/api/roles`;
            
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setRoles(response.data.roles || []);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to load roles');
            } else if (err.request) {
                setError('No response from server. Please try again later.');
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, [interviewerId, refreshTrigger]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="role-list-container">
                <h2>Roles</h2>
                <div className="loading">Loading roles...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="role-list-container">
                <h2>Roles</h2>
                <div className="error-message">{error}</div>
            </div>
        );
    }

    return (
        <div className="role-list-container">
            <h2>Roles ({roles.length})</h2>
            {roles.length === 0 ? (
                <div className="empty-state">
                    <p>No roles found. Create your first role above!</p>
                </div>
            ) : (
                <div className="roles-grid">
                    {roles.map((role) => (
                        <div 
                            key={role.id} 
                            className={`role-card ${selectedForInvite === role.id ? 'selected' : ''}`}
                        >
                            <div className="role-header">
                                <h3 className="role-title">{role.title}</h3>
                                {role.interviewer_name && (
                                    <span className="role-interviewer">
                                        {role.interviewer_name}
                                    </span>
                                )}
                            </div>
                            <div className="role-footer">
                                <span className="role-date">
                                    Created: {formatDate(role.created_at)}
                                </span>
                            </div>
                            <div className="role-actions">
                                <button
                                    className="action-btn manage-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRoleId(role.id);
                                    }}
                                >
                                    Manage Questions
                                </button>
                                <button
                                    className="action-btn invite-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedForInvite(role.id);
                                        if (onRoleSelect) {
                                            onRoleSelect(role);
                                        }
                                    }}
                                >
                                    Send Invitation
                                </button>
                                <button
                                    className="action-btn responses-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedForResponses(role);
                                    }}
                                >
                                    View Responses
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedRoleId && (
                <QuestionManager
                    roleId={selectedRoleId}
                    onClose={() => setSelectedRoleId(null)}
                />
            )}

            {selectedForResponses && (
                <InterviewResponses
                    roleId={selectedForResponses.id}
                    roleTitle={selectedForResponses.title}
                    onClose={() => setSelectedForResponses(null)}
                />
            )}
        </div>
    );
};

export default RoleList;