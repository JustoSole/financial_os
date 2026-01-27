import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';
import styles from './Auth.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Manejar errores que vienen por query params (ej: email no confirmado)
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam === 'unconfirmed_email') {
      setError('Por favor, confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
    }

    // Manejar errores de Supabase que vienen en el hash (ej: link expirado)
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const errorCode = hashParams.get('error_code');
    const errorDesc = hashParams.get('error_description');
    
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      setError(`El link de acceso ha expirado o es inválido: ${errorDesc || ''}. Por favor, intenta de nuevo.`);
      // Limpiar el hash de la URL para que no persista el error
      window.history.replaceState(null, '', location.pathname);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1 className={styles.authTitle}>Bienvenido</h1>
          <p className={styles.authSubtitle}>Ingresá a tu Financial OS</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.authForm} onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className={styles.authFooter}>
          ¿No tenés cuenta? 
          <Link to="/registro" className={styles.authLink}>Registrate</Link>
        </div>
      </div>
    </div>
  );
}

