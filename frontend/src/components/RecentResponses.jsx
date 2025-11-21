import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RecentResponses.css';

const RecentResponses = ({ limit = 5 }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const backendUrl = import.meta.env.BACKEND_URL;

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
                
                // Assuming the backend returns a list of responses
                // We might need to flatten or process if the structure is nested
                const allResponses = response.data.responses || [];
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
        if (!dateString) return '';
    
        // Convert input date to MDT (UTC-6)
        const date = new Date(dateString);
        const dateInMDT = new Date(date.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    
        // Current time in MDT
        const now = new Date();
        const nowInMDT = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    
        // Diff in days (rounded up)
        const diffTime = Math.abs(nowInMDT - dateInMDT);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 86,400,000 ms per day
    
        if (diffDays < 1) return 'Today';
        if (diffDays === 1) return 'Yesterday';
    
        return dateInMDT.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };
    

    if (loading) return <div className="loading-placeholder">Loading activity...</div>;

    return (
        <div className="recent-responses-widget">
            <div className="widget-header">
                <h2>Recent Activity</h2>
                <button onClick={() => navigate('/responses')} className="view-all-btn">
                    View All &rarr;
                </button>
            </div>

            {responses.length === 0 ? (
                <div className="empty-state">
                    <p>No recent activity.</p>
                </div>
            ) : (
                <div className="activity-list">
                    {responses.map((resp) => (
                        <div 
                            key={resp.interview_token} 
                            className="activity-item"
                            onClick={() => navigate(`/responses/${resp.interview_token}`)}
                        >
                            <div className="activity-icon">
                                {resp.candidate_email.charAt(0).toUpperCase()}
                            </div>
                            <div className="activity-content">
                                <div className="activity-main">
                                    <span className="candidate-name">{resp.candidate_email}</span>
                                    <span className="activity-action">completed an interview for</span>
                                    <span className="role-name">{resp.role_title}</span>
                                </div>
                                <div className="activity-meta">
                                    <span className="response-count">
                                        {resp.answer_count} {resp.answer_count === 1 ? 'answer' : 'answers'}
                                    </span>
                                    <span className="dot">•</span>
                                    <span className="activity-date">
                                        {formatDate(resp.last_response_at)}
                                    </span>
                                </div>
                            </div>
                            <div className="activity-arrow">&rsaquo;</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecentResponses;