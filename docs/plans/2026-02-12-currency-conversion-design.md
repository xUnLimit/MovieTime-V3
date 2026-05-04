# Multi-Currency Conversion System - Design Document

**Date:** February 12, 2026
**Author:** Claude (Brainstorming Skill)
**Status:** Design Complete - Pending Implementation

---

## Executive Summary

The MovieTime system currently sums monetary amounts without considering currency differences, leading to incorrect financial metrics. This design introduces a hybrid currency conversion system that:

- Converts all aggregated totals to USD for accurate reporting
- Preserves original currency display for individual items
- Uses external API with 24-hour Firebase caching for exchange rates
- Requires zero database migration
- Impacts only 4 critical calculation points

**Example Problem:**
- Current: ₺75 TRY + $1,500 ARS + $5 USD = **$1,580** ❌ (incorrect raw sum)
- Solution: ₺75 TRY + $1,500 ARS + $5 USD = **$11.93 USD** ✅ (converted)

---

## Architecture

### Three-Layer System

```
UI Components (VentasMetrics, ServiceDetail, etc.)
      ↓
Conversion Helpers (sumInUSD, convertToUSD, formatAggregateInUSD)
      ↓
Currency Service (API fetch + Firebase cache with 24h TTL)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Async helpers** | Fresher rates, accepts minor loading states |
| **USD as base** | All conversions route through USD |
| **24-hour cache** | Balances freshness with API cost (~30 calls/month) |
| **On-demand conversion** | No data migration, original amounts unchanged |
| **Centralized service** | Single source of truth for all rates |

---

## Implementation Impact

### Files to Create
- `src/lib/services/currencyService.ts` (currency service)

### Files to Modify
- `src/lib/utils/calculations.ts` (add 3 helpers)
- `src/lib/services/metricsService.ts` (make async)
- `src/components/ventas/VentasMetrics.tsx` (async state)
- `src/app/(dashboard)/servicios/detalle/[id]/page.tsx` (async total)
- `src/components/ventas/VentaPagosTable.tsx` (async total)

### Environment Variables
- `NEXT_PUBLIC_EXCHANGE_RATE_API_KEY` (exchangerate-api.io)

---

## User Experience

### Before (Current)
```
VentasMetrics:
  Ingreso Total: $1,585.00    ❌ Incorrect (raw sum)
```

### After (Proposed)
```
VentasMetrics:
  Ingreso Total: $17.00 USD   ✅ Correct (converted)

Payment History Table:
  Row 1: ₺75.00              ← Original currency
  Row 2: $1,500.00           ← Original currency
  Row 3: $5.00               ← Original currency
  ─────────────────
  Total: $17.00 USD          ← Converted total
```

**Key UX Principles:**
- Individual items always show original currency
- Totals/aggregations always show USD
- Loading states during conversion
- Graceful error handling (stale cache fallback)

---

## Technical Specifications

### Currency Service API

```typescript
class CurrencyService {
  async getExchangeRate(from: string, to: string): Promise<number>
  async convertToUSD(amount: number, from: string): Promise<number>
  async refreshExchangeRates(): Promise<void>
  private async getCachedRates(): Promise<CachedRates | null>
  private async saveRatesToCache(rates: Record<string, number>): Promise<void>
}
```

### Conversion Helpers

```typescript
// Sum array of mixed currencies to USD
async function sumInUSD(items: Array<{ monto: number; moneda?: string }>): Promise<number>

// Convert single amount to USD
async function convertToUSD(amount: number, fromCurrency: string): Promise<number>

// Format aggregate with USD label
function formatAggregateInUSD(amount: number): string
```

### Cache Structure (Firebase)

```typescript
// Document: config/exchange_rates
{
  rates: {
    'USD_TRY': 35.20,
    'USD_ARS': 850.75,
    'USD_NGN': 1650.50,
    // ... all currencies
  },
  lastUpdated: Timestamp,
  source: 'exchangerate-api.io',
  apiVersion: 'v6'
}
```

---

## Implementation Phases

### Phase 1: Foundation (Day 1)
- Create currency service
- Add helper functions
- Setup API integration

### Phase 2: VentasMetrics (Day 2)
- Update metrics calculations
- Add loading states
- Test with mixed currencies

### Phase 3: Detail Pages (Day 3)
- Update service detail total
- Update venta payment table
- Test individual vs. aggregate display

### Phase 4: Error Handling (Day 4)
- Add error boundaries
- Test API failures
- Add admin tools

### Phase 5: Testing & Docs (Day 5)
- Full test suite
- Performance verification
- Update documentation

---

## Testing Strategy

### Critical Test Cases

**Test 1: Mixed Currency Sum**
```
Input: ₺75 TRY, $1,500 ARS, $10 USD
Expected: $17.00 USD (converted)
Verify: Not $1,585 (raw sum)
```

**Test 2: Cache Behavior**
```
Step 1: First load → API call → Cache in Firebase
Step 2: Reload < 24h → Use cache → No API call
Step 3: Reload > 24h → Fresh API call → Update cache
```

**Test 3: API Failure**
```
Given: API is down
When: User loads metrics
Then: Use stale cache + show warning
And: App doesn't crash
```

**Test 4: Individual Item Display**
```
Given: Payment history with mixed currencies
When: User views table
Then: Each row shows original currency
And: Footer shows USD total
```

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| First load (cache miss) | < 2s | Chrome DevTools |
| Cached load | < 500ms | Chrome DevTools |
| Firebase reads/page | +1 | Firebase Console |
| API calls/day | < 2 | API dashboard |
| Conversion time (100 items) | < 100ms | console.time() |

---

## Acceptance Criteria

- [ ] Individual items always display in original currency
- [ ] Totals always display in USD with "USD" label
- [ ] Mixed-currency sums are mathematically correct (±$0.10)
- [ ] Cache reduces API calls to ~1 per 24h
- [ ] API failures don't crash app (stale cache fallback)
- [ ] No breaking changes to existing data
- [ ] Performance impact < 500ms per page
- [ ] All 20+ supported currencies work correctly

---

## Risk Mitigation

### Risk: API Rate Limits
- **Mitigation:** 24h cache reduces calls to ~30/month (well within 1,500 free tier)

### Risk: API Downtime
- **Mitigation:** Stale cache fallback + warning banner, no crashes

### Risk: Stale Exchange Rates
- **Mitigation:** 24h refresh is acceptable for subscription business (not high-frequency trading)

### Risk: Performance Impact
- **Mitigation:** In-memory rate caching after first fetch, async doesn't block UI

---

## Future Enhancements (Out of Scope)

- Historical rates (convert using rate at transaction date)
- Multi-base currency support (EUR, PAB base options)
- Currency converter admin tool
- Real-time rate alerts for volatile currencies
- Crypto-to-fiat conversions (BTC, ETH)

---

## Rollback Plan

**Quick Rollback:** Revert 4 component files to show raw sums (no conversion)

**Files to revert:**
- metricsService.ts
- VentasMetrics.tsx
- servicios/detalle/[id]/page.tsx
- VentaPagosTable.tsx

**Data Safety:** No database changes made, so no data rollback needed

---

## References

- **Full Implementation Plan:** `C:\Users\iTs_A\.claude\plans\mossy-petting-swan.md`
- **API Provider:** [exchangerate-api.io](https://www.exchangerate-api.com/)
- **Free Tier:** 1,500 requests/month
- **Expected Usage:** ~30 requests/month with caching

---

## Approval

**Design Status:** ✅ Complete
**User Approval:** Pending
**Ready for Implementation:** Yes

This design was created through collaborative brainstorming with the user, exploring:
- 3 architectural approaches (selected: Centralized Service)
- Async vs. sync helpers (selected: Async)
- Cache refresh strategies (selected: On-demand 24h)
- Display format options (selected: Original + USD totals)

All user requirements validated and incorporated into final design.

---

*Document generated by Claude Brainstorming Skill on February 12, 2026*
