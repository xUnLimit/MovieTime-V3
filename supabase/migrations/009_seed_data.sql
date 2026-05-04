-- ============================================================================
-- 009_seed_data.sql
-- Seed minimo: monedas, config global, tipos de gasto base.
-- El migrador agregara mas monedas si encuentra otras en datos reales.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- currencies
-- ----------------------------------------------------------------------------
INSERT INTO currencies (code, nombre, activo)
VALUES
  ('USD', 'US Dollar', true),
  ('PAB', 'Balboa', true),
  ('ARS', 'Peso argentino', true),
  ('TRY', 'Lira turca', true)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- config singleton
-- ----------------------------------------------------------------------------
INSERT INTO config (id)
VALUES ('global')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- dashboard_stats singleton
-- ----------------------------------------------------------------------------
INSERT INTO dashboard_stats (id)
VALUES ('singleton')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- exchange_rates: USD<->USD = 1 como base. El refresh job actualiza el resto.
-- ----------------------------------------------------------------------------
INSERT INTO exchange_rates (currency_pair, rate, source)
VALUES ('USD_USD', 1, 'seed')
ON CONFLICT (currency_pair) DO NOTHING;
