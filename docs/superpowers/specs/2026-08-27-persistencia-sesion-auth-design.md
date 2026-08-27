# Persistencia confiable de la sesión

## Objetivo

La sesión debe sobrevivir al cierre y reapertura del navegador o de la PWA cuando el usuario activa **Recordarme**. Cuando la opción está desactivada, la sesión debe durar solamente mientras permanezca abierta la sesión del navegador o de la PWA. Un error temporal de conectividad o al consultar el perfil nunca debe eliminar una sesión válida.

## Problema confirmado

El cliente del navegador combina dos modelos incompatibles:

- `rememberAwareStorage` intenta alternar entre `localStorage` y `sessionStorage`.
- `createBrowserClient` de `@supabase/ssr` reemplaza internamente ese almacenamiento por cookies.

Por ello, `auth-remember` no gobierna el lugar donde Supabase persiste el token. Además, la inicialización trata cualquier error al cargar el perfil como una sesión inválida y ejecuta `signOut`, incluso cuando el fallo puede ser transitorio. Ese `signOut` usa el alcance global predeterminado de Supabase, por lo que un fallo en un dispositivo puede invalidar también las sesiones de los demás. Las funciones de autenticación convierten errores distintos en `null`, impidiendo distinguir un usuario inválido de un fallo de red o de base de datos.

La aplicación no necesita una sesión SSR en el navegador: las rutas del servidor que requieren usuario reciben un token `Bearer`, y ni el proxy ni los Server Components usan las cookies de Supabase para autorizar peticiones.

## Diseño

### Cliente y almacenamiento

El cliente del navegador se construirá con `createClient` de `@supabase/supabase-js`. Mantendrá `persistSession`, `autoRefreshToken` y `detectSessionInUrl` activados.

Un adaptador de almacenamiento con una sola responsabilidad gestionará la sesión:

- Con `auth-remember=true`, leerá y escribirá la sesión en `localStorage`.
- Sin esa preferencia, leerá y escribirá la sesión en `sessionStorage`.
- Al escribir, eliminará la copia equivalente del almacenamiento no seleccionado para evitar sesiones divergentes.
- Al leer, podrá localizar una sesión existente en cualquiera de los dos almacenamientos para completar cambios de preferencia y migraciones sin perder datos.
- Al eliminar, limpiará ambos almacenamientos.

La preferencia se establecerá antes de iniciar sesión, de modo que la primera escritura de Supabase llegue al almacenamiento correcto. El cierre manual conservará la preferencia visual del usuario, pero eliminará todos los tokens.

### Compatibilidad con las cookies actuales

Se añadirá una migración limitada y defensiva para la cookie de sesión creada por la versión actual:

1. Solo se ejecutará cuando no exista ya una sesión en el almacenamiento nuevo.
2. Reconstruirá los fragmentos de la cookie de Supabase y decodificará únicamente el formato conocido de la versión instalada.
3. Validará la estructura mínima de la sesión antes de copiarla.
4. La escribirá en `localStorage` si **Recordarme** estaba activo y, en caso contrario, en `sessionStorage`.
5. Eliminará los fragmentos antiguos solamente después de confirmar la copia.

Si la cookie no tiene el formato esperado, la migración no modificará datos y Supabase continuará sin sesión. La compatibilidad no intentará renovar ni revocar tokens por su cuenta.

### Inicialización y eventos

La restauración será explícita y separará la lectura de sesión de la carga del perfil:

1. Registrar el listener de cambios de autenticación con una devolución inmediata; el callback no ejecutará llamadas encadenadas a Supabase mientras la librería mantiene su bloqueo interno.
2. Obtener la sesión persistida al iniciar.
3. Para una sesión presente, validar y cargar el perfil fuera del callback interno.
4. Ignorar resultados obsoletos si llega un evento de autenticación más reciente durante una carga.

Los eventos repetidos para la misma sesión podrán reutilizar una carga en curso para evitar consultas duplicadas.

### Clasificación de errores

La capa de autenticación dejará de convertir todos los errores en `null`:

- **Sesión ausente o token rechazado:** limpiar el estado local. Supabase gestiona la eliminación o renovación del token; la aplicación no revocará otros dispositivos.
- **Perfil inexistente o usuario inactivo:** ejecutar cierre con alcance local y mostrar el estado no autenticado.
- **Fallo transitorio de red, timeout o consulta de perfil:** conservar el token, no ejecutar `signOut` y reintentar la carga del perfil con un límite corto.
- **Fallo transitorio persistente:** mantener la sesión almacenada y exponer un estado de error recuperable. No redirigir al formulario como si las credenciales fueran inválidas.

El logout solicitado por el usuario seguirá siendo explícito, usará `scope: 'local'` y limpiará los dos almacenamientos y cualquier cookie heredada. Cerrar las sesiones de todos los dispositivos no formará parte de este flujo; requeriría una acción separada y explícita.

## Estado de interfaz

El store distinguirá entre:

- hidratación en curso;
- usuario autenticado y perfil disponible;
- usuario no autenticado confirmado;
- sesión presente pero perfil temporalmente no disponible.

En el último estado, las pantallas protegidas mostrarán un mensaje de reconexión/reintento en lugar de redirigir a login. Esto evita pedir credenciales por un fallo temporal y permite recuperarse cuando vuelve la conexión.

## Pruebas

Las pruebas automatizadas cubrirán:

- selección de `localStorage` con **Recordarme**;
- selección de `sessionStorage` sin **Recordarme**;
- eliminación de copias divergentes y limpieza de logout;
- restauración después de simular cierre/reapertura cuando se recuerda;
- ausencia de restauración al desaparecer `sessionStorage`;
- migración válida de cookies fragmentadas y rechazo seguro de cookies inválidas;
- evento inicial con sesión válida y carga de perfil exitosa;
- fallo transitorio que conserva el token y nunca llama a `signOut`;
- perfil inexistente o inactivo que termina la sesión local;
- evento de cierre que limpia el estado;
- logout manual que usa alcance local y no invalida otros dispositivos;
- renovación de token que mantiene el almacenamiento seleccionado.

Después de las pruebas focalizadas se ejecutarán la suite completa, lint, comprobación de tipos mediante el build de Next.js y el build de producción.

## Fuera de alcance

- Convertir las páginas protegidas a autenticación SSR.
- Habilitar acceso offline con datos privados sin validar la sesión.
- Cambiar las políticas de expiración o sesión única del proyecto Supabase.
- Modificar la autenticación de las rutas API, que continuará usando tokens `Bearer`.
