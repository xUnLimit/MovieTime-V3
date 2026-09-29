/**
 * Script inline (con nonce de la CSP) que aplica el tema guardado antes del primer pintado,
 * para evitar el destello oscuro cuando el usuario eligio claro o sistema.
 * Debe mantenerse alineado con `ThemeProvider` (misma clave y mismo default).
 */
export const THEME_STORAGE_KEY = 'theme';

export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='light'?false:t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:true;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
