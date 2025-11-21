import { useState } from 'react';
import axios from 'axios';
import './InviteCandidate.css';

const InviteCandidate = ({ roleId, roleTitle, onClose }) => {
    const [candidateEmail, setCandidateEmail] = useState('');
    const [expiresInDays, setExpiresInDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [generatedLink, setGeneratedLink] = useState(null);

    const backendUrl = import.meta.env.BACKEND_URL;

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

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail)) {
            setError('Please enter a valid email address');
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
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (generatedLink?.interview_url) {
            navigator.clipboard.writeText(generatedLink.interview_url);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <div className="invite-candidate-modal-inner">
            <div className="invite-header">
                <h2>Invite Candidate</h2>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            
            <div className="invite-body">
                <p className="role-badge">Role: {roleTitle}</p>
                
                <form onSubmit={handleSubmit} className="invite-form">
                    <div className="form-group">
                        <label>Candidate Email</label>
                        <input
                            type="email"
                            value={candidateEmail}
                            onChange={(e) => setCandidateEmail(e.target.value)}
                            placeholder="candidate@example.com"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Expires In (Days)</label>
                        <input
                            type="number"
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(Number(e.target.value))}
                            min="1"
                            max="30"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    {generatedLink && (
                        <div className="link-result">
                            <p>Invitation Link Generated:</p>
                            <div className="link-box">
                                <input readOnly value={generatedLink.interview_url} />
                                <button type="button" onClick={handleCopyLink}>Copy</button>
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
        </div>
    );
};

export default InviteCandidate;