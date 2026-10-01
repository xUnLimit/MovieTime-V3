-- anon nunca debe tener via de acceso a tablas de aplicacion: toda la app opera como `authenticated`.
-- RLS ya lo bloquea, pero las politicas sin TO aplican a PUBLIC; quitar los grants es defensa en profundidad.
-- Compatible con la version anterior de la app: ninguna ruta usa el rol anon contra estas tablas.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
