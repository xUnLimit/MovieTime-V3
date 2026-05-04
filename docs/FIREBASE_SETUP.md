# 🔥 Configuración de Firebase para MovieTime System

## ✅ Estado Actual

La integración de Firebase ha sido configurada e incluye:

1. ✅ **Firebase SDK instalado** (firebase v11+)
2. ✅ **Configuración completa** en `src/lib/firebase/`
3. ✅ **Variables de entorno** configuradas en `.env.local`
4. ✅ **AuthStore actualizado** para usar Firebase Authentication
5. ✅ **Servicios de Firestore** listos para CRUD operations

## 📋 Pasos Siguientes Requeridos

### 1. Configurar Firebase Console

Ve a [Firebase Console](https://console.firebase.google.com/) y realiza los siguientes pasos:

#### A. Habilitar Authentication
1. En Firebase Console, ve a **Authentication**
2. Click en **Get Started**
3. Habilita **Email/Password** provider
4. (Opcional) Habilita otros proveedores si los necesitas

#### B. Crear Base de Datos Firestore
1. Ve a **Firestore Database**
2. Click en **Create database**
3. Selecciona **Start in production mode** (configuraremos las reglas después)
4. Elige la ubicación más cercana (ej: `us-central1`)

#### C. Configurar Reglas de Seguridad

En Firestore Database > Rules, reemplaza con estas reglas iniciales:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user is admin
    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection - users can only read/write their own data
    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }

    // All other collections - require authentication
    match /{collection}/{document=**} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

### 2. Crear Primer Usuario (Administrador)

Ejecuta este código en tu navegador console o crea un script temporal:

```javascript
// En Firebase Console > Authentication > Users > Add user
// O usa este código:
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './src/lib/firebase/config';

// Crear admin
await createUserWithEmailAndPassword(auth, 'admin@movietime.com', 'TuPasswordSegura123');
```

### 3. Inicializar Colecciones en Firestore

Necesitas crear las siguientes colecciones con datos iniciales:

**Colecciones necesarias:**
- `clientes` - Clientes del sistema
- `revendedores` - Revendedores
- `servicios` - Servicios de streaming (Netflix, Disney+, etc.)
- `categorias` - Categorías de servicios
- `suscripciones` - Suscripciones activas
- `notificaciones` - Notificaciones del sistema
- `metodosPago` - Métodos de pago disponibles
- `activityLog` - Log de actividades
- `templates` - Plantillas de mensajes WhatsApp
- `config` - Configuración del sistema

### 4. Migrar Mock Data a Firebase (Opcional)

Si quieres importar los datos mock existentes a Firebase:

```javascript
// Script para importar mock data
import { collection, addDoc } from 'firebase/firestore';
import { db } from './src/lib/firebase/config';
import { MOCK_CLIENTES } from './src/lib/mock-data';

// Ejemplo: Importar clientes
for (const cliente of MOCK_CLIENTES) {
  const { id, ...data } = cliente; // Remove ID, Firebase will generate one
  await addDoc(collection(db, 'clientes'), data);
}
```

## 🔐 Seguridad

### Variables de Entorno

El archivo `.env.local` contiene tus credenciales de Firebase. **NUNCA** lo subas a Git.

Archivo `.gitignore` debe incluir:
```
.env.local
.env*.local
```

### Reglas de Firestore

Las reglas actuales permiten que cualquier usuario autenticado pueda leer/escribir. Para producción, debes:

1. Agregar validación de datos
2. Limitar operaciones según roles
3. Implementar rate limiting
4. Validar estructura de documentos

## 🚀 Desarrollo

### Comandos Útiles

```bash
# Iniciar servidor de desarrollo
npm run dev

# Verificar tipos TypeScript
npm run build

# Limpiar caché de Next.js
rm -rf .next
```

### Estructura de Archivos Firebase

```
src/lib/firebase/
├── config.ts          # Configuración de Firebase
├── auth.ts            # Servicios de Authentication
└── firestore.ts       # Servicios de Firestore (CRUD)

src/store/
└── authStore.ts       # Zustand store con Firebase Auth
```

## 📚 Próximos Pasos

1. **Actualizar otros Stores**: Los stores de `clientes`, `servicios`, `suscripciones`, etc. aún usan mock data
2. **Eliminar Mock Data**: Una vez migrado todo a Firebase, eliminar archivos en `src/lib/mock-data/`
3. **Implementar Real-time Listeners**: Usar Firestore onSnapshot para actualizaciones en tiempo real
4. **Agregar Manejo de Errores**: Implementar mejor manejo de errores de Firebase
5. **Configurar Storage**: Si necesitas subir imágenes/archivos

## ⚠️ Problemas Comunes

### Error: "Firebase not initialized"
- Verifica que las variables en `.env.local` estén correctamente configuradas
- Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "Missing permissions"
- Revisa las reglas de Firestore
- Verifica que el usuario esté autenticado

### Error: "Network error"
- Verifica tu conexión a internet
- Comprueba que Firebase Console esté accesible

## 📞 Soporte

Si encuentras problemas:
1. Revisa la consola del navegador para errores
2. Verifica Firebase Console > Firestore > Data
3. Revisa Firebase Console > Authentication > Users

---

**Última actualización**: Enero 2026
