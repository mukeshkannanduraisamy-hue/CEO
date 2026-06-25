import { useState, useEffect, useRef } from 'react';
import { Command, Eye, EyeOff, Lock, User, LogIn, Shield, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import './Login.css';

// ── Credentials ────────────────────────────────────────────────
const ADMIN_USER  = (import.meta.env.VITE_LOGIN_USER  || 'admin').trim();
const ADMIN_PASS  = (import.meta.env.VITE_LOGIN_PASS  || 'ceo@2024').trim();
const PAYOUT_USER = (import.meta.env.VITE_PAYOUT_USER || 'payout').trim();
const PAYOUT_PASS = (import.meta.env.VITE_PAYOUT_PASS || 'payout@2024').trim();
const ALT_PASS    = 'admin'; // Backup password for admin
const AUTH_KEY    = 'ceo_cc_auth';

// Returns { role: 'admin'|'payout' } or null
function validateCredentials(username, password) {
  const u = username.trim();
  const p = password.trim();
  if (u === ADMIN_USER  && (p === ADMIN_PASS || p === ALT_PASS)) return { role: 'admin' };
  if (u === PAYOUT_USER && p === PAYOUT_PASS)                    return { role: 'payout' };
  return null;
}

export default function Login({ onLogin }) {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [remember, setRemember]     = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const canvasRef                   = useRef(null);

  // Animated particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,77,138,${p.alpha * 0.6})`;
        ctx.fill();
      });

      // Draw connecting lines
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(232,77,138,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    // Simulate slight auth delay for UX
    await new Promise(r => setTimeout(r, 900));

    const auth = validateCredentials(username, password);
    if (auth) {
      setSuccess(true);
      const payload = { user: username.trim(), role: auth.role, at: Date.now() };
      if (remember) localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
      else sessionStorage.setItem(AUTH_KEY, JSON.stringify(payload));
      setTimeout(() => onLogin(payload), 600);
    } else {
      setError('Invalid username or password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Animated canvas background */}
      <canvas ref={canvasRef} className="login-canvas" />

      {/* Glow orbs */}
      <div className="login-orb login-orb--1" />
      <div className="login-orb login-orb--2" />
      <div className="login-orb login-orb--3" />

      {/* Grid overlay */}
      <div className="login-grid" />

      {/* Card */}
      <div className={`login-card ${success ? 'login-card--success' : ''}`}>
        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo">
            <Command size={28} color="#fff" />
          </div>
          <div className="login-logo-ring" />
        </div>

        <div className="login-brand">CEO Command Center</div>
        <div className="login-tagline">Secure access to your executive dashboard</div>

        {/* Divider */}
        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text"><Lock size={11} /> Authenticated Access</span>
          <span className="login-divider-line" />
        </div>

        {/* Default credentials hint */}


        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          {/* Username */}
          <div className="login-field">
            <label className="login-label">Username</label>
            <div className="login-input-wrap">
              <User size={15} className="login-input-icon" />
              <input
                className="login-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-wrap">
              <Lock size={15} className="login-input-icon" />
              <input
                className="login-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
              />
              <button type="button" className="login-eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="login-row">
            <label className="login-check-label">
              <input type="checkbox" className="login-check" checked={remember} onChange={e => setRemember(e.target.checked)} />
              <span className="login-check-box">{remember && <CheckCircle2 size={11} />}</span>
              <span>Remember me</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Submit */}
          <button className={`login-btn ${loading ? 'loading' : ''} ${success ? 'success' : ''}`} type="submit" disabled={loading || success}>
            {success ? (
              <><CheckCircle2 size={17} /> Access Granted</>
            ) : loading ? (
              <><span className="login-spinner" /> Authenticating…</>
            ) : (
              <><LogIn size={17} /> Sign In to Dashboard</>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="login-footer">
          <div className="login-footer-badge"><Shield size={11} /> Secured with local authentication</div>
          <div className="login-footer-badge"><Zap size={11} /> CEO Command Center v2.0</div>
        </div>
      </div>

      {/* Version mark */}
      <div className="login-version">Built for executive productivity · © 2024</div>
    </div>
  );
}
