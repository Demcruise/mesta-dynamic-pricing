# Mesta-Dynamic-Pricing
Dynamic Pricing empowers retail businesses to adopt smart, data-driven pricing strategies that align with their financial and sales objectives. This comprehensive solution offers a robust pricing ecosystem designed to optimize margins and adapt to market dynamics seamlessly.

## Frontend prototype

Next.js 16 (App Router), TypeScript strict, Tailwind 4, Zustand, TanStack Query/Virtual. Frontend only: mock data, local state.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit + component tests (vitest)
npm run test:e2e   # Playwright, uses system Chrome, starts its own dev server on :3100
npm run lint       # tsc --noEmit
```

Flow: Catalog → Strategy → Simulation → Recommendations → Deployment → Monitoring → Audit → Overview.
Switch persona with the role selector in the top bar (dev only). Add `?skus=5000` to any URL for the 5,000-SKU stress dataset.

- `lib/actions/*` all writes (RBAC, guardrails, audit) · `lib/stores/*` state · `lib/queries/*` read hooks · `lib/mock-data.ts` seed (only `lib/bootstrap.ts` may import it)
- `features/*` page-level UI · `components/ds/*` design system · `/design-system` in-app reference
- `lib/i18n/{id,en}/*.json` copy per namespace; `tests/i18n-keys.test.ts` fails on missing keys and raw copy

See [docs/known-limitations.md](docs/known-limitations.md).
