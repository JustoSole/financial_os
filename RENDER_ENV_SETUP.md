# Configuración de Variables de Entorno en Render

## Variables de Supabase para tu proyecto

### ✅ Valores obtenidos automáticamente:

```bash
SUPABASE_URL=https://sklttofvjmxwqyyynpqt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbHR0b2Z2am14d3F5eXlucHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODQ2MTcsImV4cCI6MjA4NDY2MDYxN30.tFDSOIEVlJ9RTopR1AwX-XHncR_AoVpgdxY32U2uaYY
```

**O también puedes usar la clave publishable (recomendada):**
```bash
SUPABASE_ANON_KEY=sb_publishable_GrCrl0_M89dJF9Q3_5Df1Q_PbxsnDqk
```

### ⚠️ SERVICE_ROLE_KEY (solo si la necesitas)

La `SUPABASE_SERVICE_ROLE_KEY` es una clave secreta que **NO** está disponible vía MCP por razones de seguridad.

**Para obtenerla:**
1. Ve a: https://supabase.com/dashboard/project/sklttofvjmxwqyyynpqt/settings/api
2. Busca la sección **"Project API keys"**
3. Copia el valor de **"service_role"** (está oculta, haz click en "Reveal")

**⚠️ Importante:** Esta clave bypassa todas las políticas RLS (Row Level Security). 

**¿Cuándo necesitas SERVICE_ROLE_KEY?**
- ✅ **Recomendado para backend:** Si tu backend necesita hacer operaciones sin autenticación de usuario
- ✅ Si tus tablas tienen RLS muy restrictivo y el backend necesita acceso directo
- ✅ Para operaciones administrativas o de sistema

**¿Cuándo NO la necesitas?**
- ✅ Si todas las operaciones del backend usan autenticación de usuarios (JWT tokens)
- ✅ Si tus tablas RLS permiten acceso con ANON_KEY cuando hay un usuario autenticado
- ✅ Para mayor seguridad: el backend solo puede hacer lo que el usuario autenticado puede hacer

**Recomendación:** Para empezar, puedes usar solo `SUPABASE_ANON_KEY`. Si encuentras problemas de permisos, entonces agrega `SUPABASE_SERVICE_ROLE_KEY`.

## Pasos para configurar en Render:

1. Ve a tu servicio en Render Dashboard
2. Click en **"Environment"** en el menú lateral
3. Agrega estas variables:

### Variables para Backend:
| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://sklttofvjmxwqyyynpqt.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (o la publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (Opcional) Obtener desde Supabase Dashboard |

### Variables para Frontend (requieren prefijo `VITE_`):
| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://sklttofvjmxwqyyynpqt.supabase.co` (mismo que SUPABASE_URL) |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (mismo que SUPABASE_ANON_KEY) |

**⚠️ Importante:** Las variables `VITE_*` son necesarias para que el frontend funcione. Vite las inyecta durante el build, así que deben estar configuradas antes del deploy.

4. Guarda los cambios
5. El servicio se redeployará automáticamente

## Verificación:

Después del deploy, verifica que todo funciona:
```bash
curl https://tu-app.onrender.com/api/health
```

Deberías ver:
```json
{
  "success": true,
  "status": "ok",
  "dependencies": {
    "supabase": "configured"
  }
}
```

