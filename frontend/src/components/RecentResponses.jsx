import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RecentResponses.css';

const RecentResponses = ({ limit = 5 }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        const fetchResponses = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(
                    `${backendUrl}/api/interviews/responses`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }
                );
                
                const allResponses = response.data.responses || [];
                // Slice client side since backend might return all
                setResponses(allResponses.slice(0, limit));
            } catch (err) {
                console.error('Failed to fetch recent responses', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResponses();
    }, [limit, backendUrl]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays < 1) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) return <div className="loading-placeholder">Loading activity...</div>;

    return (
        <div className="recent-responses-widget">
            <div className="widget-header">
                <h2>Recent Activity</h2>
                <button onClick={() => navigate('/responses')} className="view-all-btn">
                    View All
                </button>
            </div>

            {responses.length === 0 ? (
                <div className="empty-state">
                    <p>No responses yet.</p>
                </div>
            ) : (
                <div className="responses-list-compact">
                    {responses.map((resp) => (
                        <div 
                            key={resp.interview_token} 
                            className="response-item-compact"
                            onClick={() => navigate(`/responses/${resp.interview_token}`)}
                        >
                            <div className="resp-avatar">
                                {resp.candidate_email.charAt(0).toUpperCase()}
                            </div>
                            <div className="resp-details">
                                <div className="resp-top">
                                    <span className="resp-email">{resp.candidate_email}</span>
                                    <span className="resp-time">{formatDate(resp.last_response_at)}</span>
                                </div>
                                <div className="resp-role">{resp.role_title}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecentResponses;