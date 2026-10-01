import path from 'node:path';

// Sesiones guardadas por el proyecto `setup` (carpeta ignorada por Git: contiene tokens).
const AUTH_DIR = path.resolve('e2e', '.auth');

export const ADMIN_STATE_PATH = path.join(AUTH_DIR, 'admin.json');
export const OPERATOR_STATE_PATH = path.join(AUTH_DIR, 'operator.json');
