import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './login.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Get backend URL from environment variable (Vite uses import.meta.env)
    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    // Redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        }
    }, [navigate, location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(
                `${backendUrl}/api/auth/login`,
                { email, password },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const data = response.data;

            // Store token and user info
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            console.log('Login successful:', data);
            
            // Navigate to dashboard or the page user was trying to access
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        } catch (err) {
            if (err.response) {
                // Backend returned an error
                setError(err.response.data.message || 'Login failed');
            } else if (err.request) {
                // No response received
                setError('No response from server. Please try again later.');
            } else {
                // Other errors (e.g. setup issues)
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = (provider) => {
        // Store current location for redirect after OAuth
        const currentPath = location.state?.from?.pathname || '/dashboard';
        window.location.href = `${backendUrl}/api/auth/oauth/${provider}?redirect=${encodeURIComponent(currentPath)}`;
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to your account</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <div className="form-options">
                        <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="divider">
                    <span>Or continue with</span>
                </div>

                <div className="oauth-buttons">
                    <button
                        type="button"
                        className="oauth-button google"
                        onClick={() => handleOAuthLogin('google')}>
                        Google
                    </button>
                </div>

                <div className="signup-link">
                    <p>
                        Don't have an account? <Link to="/register">Sign up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
