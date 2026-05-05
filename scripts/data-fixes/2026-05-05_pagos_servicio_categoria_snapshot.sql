-- ============================================================================
-- Data fix: restore category snapshot for two legacy pagos_servicio.
--
-- These payments were registered as Crunchyroll expenses before their parent
-- services were moved to Spotify. The schema migration sets
-- categoria_id_snapshot from the current servicios.categoria_id, which would
-- now incorrectly attribute these historical expenses to Spotify.
--
-- This fix restores them to Spotify's category id (the snapshot wanted by
-- Firebase historical reports). Run once against the MovieTime production
-- dataset after the schema migrations and Firebase import.
-- ============================================================================

UPDATE pagos_servicio
SET categoria_id_snapshot = 'fY4CJAblcOMS4eBx46de'
WHERE id IN ('MAObIlYwfCRFQ6cLhg9q', 'MozoU8AS0LkDlX1TsI9r');
