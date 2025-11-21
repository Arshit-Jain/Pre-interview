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

    const backendUrl = import.meta.env.BACKEND_URL;
    console.log(backendUrl);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        }
    }, [navigate, location]);

    useEffect(() => {
        if (!location.search) return;

        const params = new URLSearchParams(location.search);
        const tokenParam = params.get('token');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(errorParam.replace(/_/g, ' '));
        }

        if (tokenParam) {
            const redirectParam = params.get('redirect');
            const encodedUser = params.get('user');
            let userFromOAuth = null;

            if (encodedUser) {
                try {
                    userFromOAuth = JSON.parse(window.atob(encodedUser));
                } catch (decodeError) {
                    console.error('Failed to decode OAuth user payload', decodeError);
                }
            }

            localStorage.setItem('token', tokenParam);
            if (userFromOAuth) {
                localStorage.setItem('user', JSON.stringify(userFromOAuth));
            }

            const redirectTo = (redirectParam && redirectParam.startsWith('/')) ? redirectParam : '/dashboard';
            navigate(redirectTo, { replace: true });
        }
    }, [location, navigate]);

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

            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Login failed');
            } else if (err.request) {
                setError('No response from server. Please try again later.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = (provider) => {
        const currentPath = location.state?.from?.pathname || '/dashboard';
        window.location.href = `${backendUrl}/api/auth/oauth/${provider}?redirect=${encodeURIComponent(currentPath)}`;
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to access your dashboard</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <div className="label-row">
                            <label htmlFor="password">Password</label>
                            {/* <Link to="/forgot-password" className="forgot-link">Forgot?</Link> */}
                        </div>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="primary-btn" disabled={loading}>
                        {loading ? <span className="spinner"></span> : 'Sign In'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>Or continue with</span>
                </div>

                <div className="oauth-actions">
                    <button
                        type="button"
                        className="oauth-btn google"
                        onClick={() => handleOAuthLogin('google')}
                    >
                        <svg className="icon" viewBox="0 0 24 24" width="24" height="24">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -22.444 46.099 -25.094 43.989 -14.754 43.989 Z" />
                            </g>
                        </svg>
                        Google
                    </button>
                </div>

                {/* <div className="auth-footer">
                    <p>Don't have an account? <Link to="/register">Sign up</Link></p>
                </div> */}
            </div>
        </div>
    );
};

export default LoginPage;