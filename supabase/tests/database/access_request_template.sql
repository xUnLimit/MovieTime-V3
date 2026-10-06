BEGIN;
SELECT plan(5);

SELECT ok('datos_acceso' = ANY(enum_range(NULL::public.tipo_template_enum)::text[]), 'requested access has its own template type');
SELECT is((SELECT count(*)::integer FROM public.templates WHERE tipo = 'datos_acceso'), 1, 'one initial access request template');
SELECT ok((SELECT activo FROM public.templates WHERE tipo = 'datos_acceso'), 'access request template starts enabled');
SELECT ok((SELECT contenido LIKE '%{correo}%' AND contenido LIKE '%{contrasena}%' AND contenido LIKE '%{perfil_nombre}%'
  FROM public.templates WHERE tipo = 'datos_acceso'), 'access request contains credential variables');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.templates'::regclass), 'template RLS remains enabled');

SELECT * FROM finish();
ROLLBACK;
