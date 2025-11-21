import { useState } from 'react';
import axios from 'axios';
import QuestionManager from './QuestionManager';
import './RoleForm.css';

const RoleForm = ({ interviewerId, onRoleAdded }) => {
    const [title, setTitle] = useState('');
    const [roleId, setRoleId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [createdRoleId, setCreatedRoleId] = useState(null);

    const backendUrl = import.meta.env.BACKEND_URL;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!title.trim()) {
            setError('Title is required');
            setLoading(false);
            return;
        }

        if (title.length > 150) {
            setError('Title must be 150 characters or less');
            setLoading(false);
            return;
        }

        // Validate ID if provided
        if (roleId.trim() && (isNaN(roleId) || parseInt(roleId) <= 0)) {
            setError('ID must be a positive integer');
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const requestBody = {
                interviewer_id: interviewerId,
                title: title.trim()
            };

            // Only include ID if provided
            if (roleId.trim()) {
                requestBody.id = parseInt(roleId);
            }

            const response = await axios.post(
                `${backendUrl}/api/roles`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setSuccess('Role created successfully!');
            setCreatedRoleId(response.data.role.id);
            setTitle('');
            setRoleId('');
            
            // Notify parent component to refresh the list
            if (onRoleAdded) {
                onRoleAdded();
            }
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to create role');
            } else if (err.request) {
                setError('No response from server. Please try again later.');
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="role-form-container">
            <h2>Add New Role</h2>
            <form onSubmit={handleSubmit} className="role-form">
                <div className="form-group">
                    <label htmlFor="roleId">Role ID (Optional)</label>
                    <input
                        type="number"
                        id="roleId"
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                        placeholder="Leave empty for auto-generated ID"
                        min="1"
                        disabled={loading}
                    />
                    <small>Leave empty to use auto-generated ID</small>
                </div>

                <div className="form-group">
                    <label htmlFor="title">Role Title</label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., SWE internship"
                        maxLength={150}
                        required
                        disabled={loading}
                    />
                    <small>{title.length}/150 characters</small>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={loading || !title.trim()}
                >
                    {loading ? 'Creating...' : 'Create Role'}
                </button>
            </form>

            {createdRoleId && (
                <QuestionManager
                    roleId={createdRoleId}
                    onClose={() => {
                        setCreatedRoleId(null);
                        setSuccess('');
                    }}
                />
            )}
        </div>
    );
};

export default RoleForm;

