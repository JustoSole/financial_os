import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, RefreshCw, Calendar, Power } from 'lucide-react';
import {
  checkAdmin,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
} from '../api';
import { Button, Alert, ConfirmDialog } from '../components/ui';
import styles from './Admin.module.css';

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await getAdminUsers();
    if (res.success && res.data) setUsers(res.data);
    else setError(res.error || 'No se pudieron cargar los usuarios');
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await checkAdmin();
      if (!res.success || !res.data?.isAdmin) {
        navigate('/', { replace: true });
        return;
      }
      loadUsers();
    })();
  }, [navigate, loadUsers]);

  const handleToggleActive = async (user: AdminUser) => {
    await updateAdminUser(user.id, { isActive: !user.is_active });
    loadUsers();
  };

  const handleExtend = async (user: AdminUser) => {
    const days = prompt('Extender acceso por cuantos dias?', '30');
    if (!days) return;
    const d = parseInt(days);
    if (!d || d <= 0) return;
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + d);
    await updateAdminUser(user.id, { expiresAt: newExpiry.toISOString() });
    loadUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAdminUser(deleteTarget.id);
    setDeleteTarget(null);
    loadUsers();
  };

  const getStatus = (user: AdminUser) => {
    if (!user.is_active) return 'inactive';
    if (user.expires_at && new Date(user.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  const statusLabel: Record<string, string> = {
    active: 'Activo',
    expired: 'Expirado',
    inactive: 'Desactivado',
  };

  return (
    <div className={styles.adminPage}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administrar Usuarios</h1>
          <p className="page-subtitle">Crear, extender y gestionar accesos</p>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Crear Usuario
        </Button>
        <Button variant="secondary" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={16} /> Actualizar
        </Button>
      </div>

      {loading ? (
        <div className={styles.noData}>Cargando...</div>
      ) : users.length === 0 ? (
        <div className={styles.noData}>No hay usuarios registrados</div>
      ) : (
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Hotel</th>
              <th>Creado</th>
              <th>Expira</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const status = getStatus(u);
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.propertyName || '-'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    {u.expires_at
                      ? new Date(u.expires_at).toLocaleDateString()
                      : 'Sin limite'}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        status === 'active'
                          ? styles.badgeActive
                          : status === 'expired'
                          ? styles.badgeExpired
                          : styles.badgeInactive
                      }`}
                    >
                      {statusLabel[status]}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button onClick={() => handleExtend(u)} title="Extender acceso">
                        <Calendar size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Desactivar' : 'Activar'}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        className="danger"
                        onClick={() => setDeleteTarget(u)}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadUsers();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar usuario"
        message={deleteTarget ? `Vas a eliminar a ${deleteTarget.email} y todos sus datos. Esta accion no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email y contraseña son requeridos');
      return;
    }
    setSaving(true);
    setError('');

    const days = parseInt(expiryDays);
    let expiresAt: string | null = null;
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    const res = await createAdminUser({ email, password, hotelName: hotelName || undefined, expiresAt });
    if (res.success) {
      onCreated();
    } else {
      setError(res.error || 'Error al crear usuario');
    }
    setSaving(false);
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h3>Crear Usuario</h3>
        {error && (
          <Alert variant="error" title="Error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}
        <div className={styles.formStack}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hotel.com" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
          </label>
          <label>
            Nombre del Hotel
            <input type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Mi Hotel" />
          </label>
          <label>
            Dias de acceso (0 = sin limite)
            <input type="number" min={0} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
          </label>
        </div>
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando...' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  );
}
