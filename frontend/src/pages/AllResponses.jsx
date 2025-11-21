import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './AllResponses.css';

const AllResponses = () => {
    const navigate = useNavigate();
    const { token } = useParams();
    const [responses, setResponses] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Detail view state
    const [selectedResponse, setSelectedResponse] = useState(null);
    const [videoAnswers, setVideoAnswers] = useState([]);
    const [loadingAnswers, setLoadingAnswers] = useState(false);
    
    // Stitched video state
    const [stitchedVideoGcsUrl, setStitchedVideoGcsUrl] = useState(null);
    const [stitchedVideoBlobUrl, setStitchedVideoBlobUrl] = useState(null);
    const [loadingStitchedVideo, setLoadingStitchedVideo] = useState(false);
    const [stitching, setStitching] = useState(false);
    const [fromCache, setFromCache] = useState(false);
    
    // Individual video blobs map
    const [videoBlobUrls, setVideoBlobUrls] = useState({});

    const backendUrl = import.meta.env.BACKEND_URL;

    // Initial data load
    useEffect(() => {
        fetchRoles();
        if (token) {
            // Direct navigation to a specific response
            fetchVideoAnswers(token);
        } else {
            // Load list view
            fetchResponses();
        }
    }, [token]); // Re-run if URL token changes

    // Clean up blob URLs on unmount
    useEffect(() => {
        return () => {
            // Cleanup logic
            if (stitchedVideoBlobUrl) URL.revokeObjectURL(stitchedVideoBlobUrl);
            Object.values(videoBlobUrls).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, [stitchedVideoBlobUrl, videoBlobUrls]);

    // Fetch responses when filter changes
    useEffect(() => {
        if (!token) {
            fetchResponses();
        }
    }, [selectedRoleId]);

    // Load stitched video when GCS URL is available
    useEffect(() => {
        if (!stitchedVideoGcsUrl) return;
        fetchStitchedVideoBlob();
    }, [stitchedVideoGcsUrl]);

    // Load individual video blobs when answers are loaded
    useEffect(() => {
        if (videoAnswers.length > 0) {
            fetchIndividualVideoBlobs();
        }
    }, [videoAnswers]);

    const fetchRoles = async () => {
        try {
            const token = localStorage.getItem('token');
            // Get current interviewer ID
            const meResponse = await axios.get(`${backendUrl}/api/roles/my-interviewer`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (meResponse.data.interviewer?.id) {
                const rolesResponse = await axios.get(
                    `${backendUrl}/api/roles/interviewer/${meResponse.data.interviewer.id}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                setRoles(rolesResponse.data.roles || []);
            }
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    };

    const fetchResponses = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const params = selectedRoleId !== 'all' ? { role_id: selectedRoleId } : {};
            
            const response = await axios.get(`${backendUrl}/api/interviews/responses`, {
                params,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            setResponses(response.data.responses || []);
        } catch (err) {
            console.error('Error fetching responses:', err);
            setError(err.response?.data?.message || 'Failed to load responses');
        } finally {
            setLoading(false);
        }
    };

    const fetchVideoAnswers = async (interviewToken) => {
        setLoadingAnswers(true);
        // If we navigated directly here, main loading might be true
        setLoading(false); 
        setError('');
        setStitchedVideoGcsUrl(null);
        setFromCache(false);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses/${interviewToken}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            const { video_answers, interview, stitched_video_url } = response.data;
            
            setVideoAnswers(video_answers || []);
            setSelectedResponse(interview);
            
            if (stitched_video_url) {
                setStitchedVideoGcsUrl(stitched_video_url);
                setFromCache(true);
            } else if (video_answers?.length > 0) {
                // Auto stitch if not exists
                handleStitchVideos(interviewToken);
            }
        } catch (err) {
            console.error('Failed to fetch video answers:', err);
            setError(err.response?.data?.message || 'Failed to load interview details');
        } finally {
            setLoadingAnswers(false);
        }
    };

    const fetchStitchedVideoBlob = async () => {
        if (!stitchedVideoGcsUrl) return;
        setLoadingStitchedVideo(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/interviews/video-proxy?url=${encodeURIComponent(stitchedVideoGcsUrl)}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    responseType: 'blob'
                }
            );
            const blobUrl = URL.createObjectURL(response.data);
            setStitchedVideoBlobUrl(blobUrl);
        } catch (err) {
            console.error('Failed to load stitched video blob', err);
        } finally {
            setLoadingStitchedVideo(false);
        }
    };

    const fetchIndividualVideoBlobs = async () => {
        const token = localStorage.getItem('token');
        const newBlobUrls = {};
        
        // Process sequentially or parallel (parallel better for performance but heavier)
        await Promise.all(videoAnswers.map(async (answer) => {
            if (!answer.video_url) return;
            try {
                const response = await axios.get(
                    `${backendUrl}/api/interviews/video-proxy?url=${encodeURIComponent(answer.video_url)}`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` },
                        responseType: 'blob'
                    }
                );
                newBlobUrls[answer.id] = URL.createObjectURL(response.data);
            } catch (err) {
                console.error(`Failed load video ${answer.id}`, err);
                newBlobUrls[answer.id] = null; // Mark as failed
            }
        }));
        
        setVideoBlobUrls(prev => ({ ...prev, ...newBlobUrls }));
    };

    const handleStitchVideos = async (interviewToken) => {
        if (stitching) return;
        setStitching(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${backendUrl}/api/interviews/stitch-video/${interviewToken}`,
                {},
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (response.data.stitched_url) {
                setStitchedVideoGcsUrl(response.data.stitched_url);
                setFromCache(response.data.from_cache || false);
            }
        } catch (err) {
            console.error('Stitch error:', err);
            // Don't set main error state here to keep UI usable, just log it
        } finally {
            setStitching(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        // If it looks like a UUID/Token (contains dashes, long enough), try direct navigation
        if (searchQuery.trim().length > 20 && searchQuery.includes('-')) {
            navigate(`/responses/${searchQuery.trim()}`);
        }
    };

    // Filter displayed list based on search query
    const filteredResponses = responses.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.candidate_email.toLowerCase().includes(q) || 
            (r.candidate_name && r.candidate_name.toLowerCase().includes(q)) ||
            r.interview_token.toLowerCase().includes(q)
        );
    });

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // --- RENDER HELPERS ---

    // Loading State
    if (loading) {
        return (
            <div className="all-responses-container loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    // Detail View (Video Player)
    if (token || selectedResponse) {
        return (
            <div className="all-responses-container detail-view">
                <header className="responses-header detail-header">
                    <button 
                        className="back-btn" 
                        onClick={() => navigate('/dashboard')}
                    >
                        &larr; Back
                    </button>
                    <div className="header-info">
                        <h1>{selectedResponse?.candidate_email || 'Candidate Response'}</h1>
                        <span className="role-tag">{selectedResponse?.role_title}</span>
                    </div>
                </header>

                {error && <div className="error-banner">{error}</div>}

                <div className="video-layout">
                    {/* Main Player - Stitched Video */}
                    <section className="main-video-section">
                        <h3>Full Interview</h3>
                        <div className="video-wrapper">
                            {loadingStitchedVideo || stitching ? (
                                <div className="video-placeholder">
                                    <div className="spinner"></div>
                                    <p>{stitching ? 'Creating full video...' : 'Loading full video...'}</p>
                                </div>
                            ) : stitchedVideoBlobUrl ? (
                                <video 
                                    controls 
                                    src={stitchedVideoBlobUrl} 
                                    className="main-player" 
                                    controlsList="nodownload"
                                />
                            ) : (
                                <div className="video-placeholder">
                                    <p>Video unavailable</p>
                                </div>
                            )}
                        </div>
                        {/* fromCache && <p className="video-note"><small>✓ Loaded from storage</small></p> */}
                    </section>

                    {/* Sidebar - Individual Clips */}
                    <section className="clips-sidebar">
                        <h3>Individual Answers ({videoAnswers.length})</h3>
                        <div className="clips-list">
                            {loadingAnswers ? (
                                <div className="clips-loading">Loading clips...</div>
                            ) : videoAnswers.length === 0 ? (
                                <div className="clips-empty">No answers recorded</div>
                            ) : (
                                videoAnswers.map((answer, index) => (
                                    <div key={answer.id} className="clip-item">
                                        <div className="clip-header">
                                            <span className="clip-number">Q{index + 1}</span>
                                            <span className="clip-question" title={answer.question_text}>
                                                {answer.question_text}
                                            </span>
                                        </div>
                                        <div className="clip-player-wrapper">
                                            {videoBlobUrls[answer.id] ? (
                                                <video 
                                                    controls 
                                                    src={videoBlobUrls[answer.id]} 
                                                    className="clip-player"
                                                />
                                            ) : (
                                                <div className="clip-placeholder">Loading...</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    // List View (Default)
    return (
        <div className="all-responses-container list-view">
            <header className="responses-header">
                <div className="header-title">
                    <h1>All Responses</h1>
                    <p>Manage candidate submissions</p>
                </div>
                <div className="header-actions">
                    <form onSubmit={handleSearch} className="search-form">
                        <input 
                            type="text" 
                            className="search-input"
                            placeholder="Search by token or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="search-btn">Go</button>
                    </form>

                    <select 
                        className="role-select"
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                    </select>
                    <button className="logout-btn-small" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <main className="responses-grid-container">
                {filteredResponses.length === 0 ? (
                    <div className="empty-state-large">
                        <div className="empty-icon">🔍</div>
                        <h3>No responses found</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className="responses-grid">
                        {filteredResponses.map(resp => (
                            <div 
                                key={resp.interview_token} 
                                className="response-card"
                                onClick={() => navigate(`/responses/${resp.interview_token}`)}
                            >
                                <div className="card-header">
                                    <div className="candidate-avatar">
                                        {resp.candidate_email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="card-title">
                                        <h4>{resp.candidate_email}</h4>
                                        <span className="card-role">{resp.role_title}</span>
                                    </div>
                                </div>
                                <div className="card-stats">
                                    <div className="stat">
                                        <span className="stat-label">Answers</span>
                                        <span className="stat-value">{resp.answer_count}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Date</span>
                                        <span className="stat-value">{formatDate(resp.last_response_at)}</span>
                                    </div>
                                </div>
                                <div className="card-footer">
                                    <span>View Details</span>
                                    <span>&rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AllResponses;