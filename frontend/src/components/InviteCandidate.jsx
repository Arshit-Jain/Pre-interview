import { useState } from 'react';
import axios from 'axios';
import './InviteCandidate.css';

const InviteCandidate = ({ roleId, roleTitle }) => {
    const [candidateEmail, setCandidateEmail] = useState('');
    const [expiresInDays, setExpiresInDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [generatedLink, setGeneratedLink] = useState(null);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        setGeneratedLink(null);

        if (!candidateEmail.trim()) {
            setError('Candidate email is required');
            setLoading(false);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail)) {
            setError('Please enter a valid email address');
            setLoading(false);
            return;
        }

        if (expiresInDays < 1 || expiresInDays > 30) {
            setError('Expiration days must be between 1 and 30');
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${backendUrl}/api/interviews/invite`,
                {
                    role_id: roleId,
                    candidate_email: candidateEmail.trim(),
                    expires_in_days: expiresInDays
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setSuccess('Invitation sent successfully!');
            setGeneratedLink(response.data.link);
            setCandidateEmail('');
            
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to send invitation');
            } else if (err.request) {
                setError('No response from server. Please try again later.');
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!roleId) {
        return null;
    }

    return (
        <div className="invite-candidate-container">
            <h2>Send Interview Invitation</h2>
            <p className="role-info">Role: <strong>{roleTitle || 'Selected Role'}</strong></p>
            
            <form onSubmit={handleSubmit} className="invite-form">
                <div className="form-group">
                    <label htmlFor="candidateEmail">Candidate Email</label>
                    <input
                        type="email"
                        id="candidateEmail"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="candidate@example.com"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="expiresInDays">Link Expires In (Days)</label>
                    <input
                        type="number"
                        id="expiresInDays"
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(Number(e.target.value))}
                        min="1"
                        max="30"
                        required
                        disabled={loading}
                    />
                    <small>Link will expire after {expiresInDays} day(s)</small>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                {generatedLink && (
                    <div className="link-info">
                        <h3>Interview Link Generated</h3>
                        <div className="link-details">
                            <p><strong>Link:</strong> <a href={generatedLink.interview_url} target="_blank" rel="noopener noreferrer">{generatedLink.interview_url}</a></p>
                            <p><strong>Expires:</strong> {formatDate(generatedLink.expires_at)}</p>
                            <p><strong>Candidate:</strong> {generatedLink.candidate_email}</p>
                        </div>
                    </div>
                )}

                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={loading || !candidateEmail.trim()}
                >
                    {loading ? 'Sending...' : 'Send Invitation'}
                </button>
            </form>
        </div>
    );
};

export default InviteCandidate;

