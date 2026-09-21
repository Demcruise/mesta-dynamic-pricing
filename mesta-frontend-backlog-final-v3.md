# Mesta Dynamic Pricing — Final Frontend Backlog v3

Backlog ini diturunkan dari `mesta-frontend-final-audit-v3.md`. Fokus **100% frontend-only**: mock data, local state, UI, interaction, routing, performance, accessibility, i18n, dan test. Tidak ada task backend, database, API, autentikasi server, atau integrasi eksternal.

## Cara Membaca
- **P0**: blocker agar data flow frontend tidak putus atau tampilan demo tidak menipu.
- **P1**: wajib untuk MVP frontend yang coherent dan siap dipakai user-testing.
- **P2**: penting untuk kelengkapan workflow/polish.
- **P3**: hardening dan improvement setelah MVP.
- **DoD**: Definition of Done — kriteria objektif sebuah task dianggap selesai.

---

# 0. Product Scope & Flow

## Flow Utama yang Harus Tetap Nyambung

```text
Catalog
  → pilih SKU
  → Strategy Builder
  → Simulation
  → Recommendation Queue
  → Approval / Reject / Adjust
  → Deployment Queue
  → Outcome Monitoring
  → Audit Trail
  → Overview (agregasi seluruh aktivitas)
```

## Contract Antar Fitur

| Fitur | Membaca dari | Menulis ke | Output untuk fitur berikutnya |
|---|---|---|---|
| Catalog | `useProductCatalogStore`, `useRecommendationStore` | `useCatalogSelectionStore` | SKU/category scope |
| Strategy | `useCatalogSelectionStore`, `useStrategyStore` | `useStrategyStore` | Strategy + guardrail aktif/draft |
| Simulation | Product store, Strategy store | `useRecommendationStore` | Recommendation source `simulation` |
| Recommendations | Recommendation store, Strategy store | Recommendation store, Audit store | Status approved/rejected/adjusted |
| Deployment | Recommendation store, Product store | Product store, Audit store, Notification store | Harga baru + deployment status |
| Monitoring | Product store, Audit store, Notification store | Notification store, Audit store | Grouped anomaly/model-review event |
| Audit | Audit store | — | Read-only history |
| Overview | Semua store relevan | Telemetry event stub | KPI + deep links |

**Rule wajib:** Tidak ada halaman yang boleh memanggil `generateProducts()` atau `generateRecommendations()` langsung. Semua data page-level harus lewat query hook atau store terpusat.

---

# EPIC 0 — Project Foundation & Design System
**Priority:** P0
**Tujuan:** Menyediakan fondasi konsisten untuk semua page dan fitur.

## 0.1 Project Setup
- [ ] Inisialisasi Next.js App Router + TypeScript strict mode.
- [ ] Setup Tailwind CSS dan import `styles/tokens.css` ke global stylesheet.
- [ ] Setup shadcn/ui sebagai primitive layer.
- [ ] Setup React Bits Pro registry di `components.json`; pilih block hanya sebagai akselerator UI, lalu bungkus dalam komponen Mesta.
- [ ] Install dependency frontend: `zustand`, `@tanstack/react-query`, `@tanstack/react-virtual`, `react-hook-form`, `zod`, `vitest`, `@testing-library/react`, `playwright`.

**DoD:** App dapat dijalankan, style token ter-load, dan semua dependency tidak menghasilkan TypeScript/build error.

## 0.2 Design Tokens
- [ ] Terapkan seluruh color token: background, text, border, brand, signal up/down/hold/info/critical.
- [ ] Terapkan typography token: Inter/IBM Plex Sans untuk UI, IBM Plex Mono untuk angka/harga/delta.
- [ ] Terapkan spacing 4px base, radius card/input, density compact dan comfortable.
- [ ] Buat helper class/token untuk state hover, focus visible, selected row, disabled, destructive.
- [ ] Pastikan signal value tidak pernah hanya bergantung warna: selalu pasangan icon/label (contoh ▲ Increase, ▼ Decrease).

**DoD:** Tidak ada hex color hardcoded di feature component; warna memakai Tailwind token atau CSS variable Mesta.

## 0.3 Design System Components
- [ ] Finalisasi `<PriceValue>`: IDR, tabular number, optional currency/locale.
- [ ] Finalisasi `<DeltaBadge>`: up/down/flat icon, aria-label, color token.
- [ ] Finalisasi `<ConfidenceBar>`: 0–100, high/medium/low tier, meter semantics.
- [ ] Finalisasi `<AgentBorderCard>`: state agent/human/rule.
- [ ] Finalisasi `<StatusChip>`: pending/approved/rejected/adjusted/stale.
- [ ] Tambah `<EmptyState>`, `<LoadingRows>`, `<PageHeader>`, `<KpiCard>`, `<PermissionDeniedState>`.

**DoD:** Semua component punya loading/disabled/accessibility state sesuai kebutuhan dan tidak menduplikasi style antar feature.

## 0.4 Domain & Permission Types
- [ ] Finalisasi `ontology.ts` untuk Product, Strategy, Scenario, Recommendation, RationaleFactor, PriceEvent, DeploymentRecord, AnomalyAlert.
- [ ] Tambah `UserSession` frontend mock: `userId`, `name`, `role`, `ownedSkuIds`.
- [ ] Finalisasi `rbac.ts` sebagai satu-satunya permission matrix.
- [ ] Tambah test type-level/manual untuk memastikan action baru wajib masuk `PERMISSIONS`.

**DoD:** Tidak ada permission string literal tersebar di page; semuanya berasal dari `Action` type.

---

# EPIC 1 — Bootstrap, Shared State & Query Layer
**Priority:** P0
**Tujuan:** Semua halaman membaca data demo yang sama dan state mengalir tanpa putus.

## 1.1 Centralized Mock Dataset
- [ ] Pertahankan `useProductCatalogStore` sebagai single source untuk `products` dan `competitors`.
- [ ] Pastikan `bootstrapMestaData()` idempotent: dipanggil dua kali tidak menggandakan products, strategies, recommendations, anomalies, atau audit events.
- [ ] Seed data hanya dari satu source product list.
- [ ] Tambah `resetMestaData()` untuk dev/demo testing.
- [ ] Tambah dev-only "Reset demo data" action pada user menu.

**DoD:** SKU, price, category, dan stock status yang sama tampil identik di Catalog, Simulation, Recommendation, Deployment, Monitoring, Audit, dan Overview.

## 1.2 Bootstrap Provider
- [ ] Pasang `<BootstrapProvider>` di root client-provider tree.
- [ ] Pastikan `QueryClientProvider` membungkus seluruh `(shell)` layout.
- [ ] Buat state loading bootstrap yang accessible (`aria-live="polite"`).
- [ ] Hindari hydration mismatch pada Next.js untuk Zustand/persist state.

**DoD:** Semua route dapat reload langsung tanpa error, tanpa empty flash sebelum demo data siap.

## 1.3 TanStack Query Abstraction
- [ ] Lengkapi query hooks: `useSkuList`, `useSkuDetail`, `useRecommendations`, `useRecommendation`, `useStrategies`, `useStrategy`, `useScenarios`, `useDeploymentRecords`, `useAuditLog`, `useAnomalies`.
- [ ] Tetapkan query key convention per domain.
- [ ] Tambah `useInvalidateMesta` untuk invalidasi domain setelah local write action.
- [ ] Page/feature component dilarang import `mock-data` langsung.
- [ ] Tambah loading/error/empty return shape konsisten di setiap hook.

**DoD:** Semua page hanya mengakses data melalui hooks di `lib/queries/`, bukan generator atau store mentah untuk data server-like.

## 1.4 Store Contracts
- [ ] Pecah store per domain bila `lib/stores/index.ts` terlalu besar: role, selection, strategy, recommendation, audit, notification, catalog.
- [ ] Tambah action transition guard untuk recommendation: pending → approved/rejected/adjusted; deployed hanya valid setelah approved.
- [ ] Tambah action transition guard untuk strategy: draft → pending_manager_approval → active → archived.
- [ ] Tambah deployment row lock state agar retry tidak bisa double-click.

**DoD:** Invalid state transition tidak mengubah store dan mengembalikan error/feedback UI.

---

# EPIC 2 — Global App Shell & Navigation
**Priority:** P0
**Tujuan:** Semua page diakses melalui shell yang konsisten, RBAC-aware, responsive, dan bilingual.

## 2.1 App Shell
- [ ] Implement `app/(shell)/layout.tsx` dengan `AppShell`, sidebar, top bar, main content, dan mobile bottom navigation.
- [ ] Gunakan Next.js `<Link>` untuk internal navigation, bukan raw `<a>` dan `window.location.href`.
- [ ] Terapkan active route state untuk nested route (contoh `/catalog/[sku]` tetap menandai Catalog).
- [ ] Tambah skip-to-content link untuk keyboard user.
- [ ] Tambah focus-visible style di seluruh interactive element.

**DoD:** Navigasi dapat digunakan full keyboard dan tidak melakukan full-page reload.

## 2.2 RBAC Navigation
- [ ] Wrap menu dengan `<RoleGate>` berdasar permission matrix.
- [ ] Tetapkan perilaku untuk route yang user tidak punya izin: redirect ke `/overview` + permission denied notice.
- [ ] Audit setiap action handler menggunakan `useCan()`, bukan hanya visibility tombol.
- [ ] Tambah role switcher dev-only di TopBar untuk Analyst, Manager, Ops Lead, Compliance.

**DoD:** Role yang tidak punya permission tidak bisa men-trigger action via tombol, keyboard, direct navigation, atau event handler.

## 2.3 Command Menu
- [ ] Buat command menu yang sebenarnya dengan searchable index dari SKU, strategy, recommendation, scenario.
- [ ] Tambah keyboard shortcuts: Cmd/Ctrl+K open, Escape close, Arrow keys navigate, Enter open result.
- [ ] Tambah quick actions sesuai RBAC: Create strategy, Open pending approvals, Open deployment failures.
- [ ] Tambah empty result state dan highlighted matching text.

**DoD:** User dapat mencari `SKU-1004` dan berpindah ke detail SKU tanpa memakai sidebar.

## 2.4 Locale Toggle
- [ ] Tambah ID/EN toggle di user menu memakai `useLocaleStore`.
- [ ] Persist pilihan locale di browser local storage.
- [ ] Terapkan locale ke currency/date formatter pada primitives dan page.

**DoD:** Toggle langsung mengubah label yang sudah ditranslate dan format tanggal/harga tanpa reload.

## 2.5 Responsive Layout
- [ ] Desktop: persistent sidebar, dense table layout.
- [ ] Tablet: collapsible sidebar.
- [ ] Mobile: bottom nav dengan Overview, Deployment, Monitoring; context page tetap readable.
- [ ] Tambah responsive table strategy: horizontal scroll, column priority, atau detail drawer.

**DoD:** Tidak ada horizontal overflow tak terkendali pada viewport 320px, 768px, 1024px, 1440px.

---

# EPIC 3 — SKU Catalog & Segmentation
**Priority:** P0
**Tujuan:** Menjadi entry point utama untuk analisis SKU dan pemilihan scope bagi strategy/simulation.

## 3.1 Catalog Data Table
- [ ] Migrasi penuh Catalog ke `useSkuList()` dan `useRecommendations()`.
- [ ] Gunakan `@tanstack/react-virtual` untuk table dataset besar.
- [ ] Implement columns: checkbox, SKU, name, category, cost, current price, competitor average, margin %, elasticity band, stock, last change, AI flag, actions.
- [ ] Tambah density toggle compact/comfortable dari global UI state.
- [ ] Tambah sorting keyboard-accessible per kolom.
- [ ] Tambah sticky header dan selected-row state.

**DoD:** Render 5.000 mock SKU tetap smooth, hanya visible rows yang di-render, sort/filter tidak merusak selection.

## 3.2 Filters & Segmentation
- [ ] Category multi-select.
- [ ] Elasticity band filter.
- [ ] Margin health filter.
- [ ] Competitor price gap range filter.
- [ ] Stock status filter.
- [ ] Saved filter presets local-only (contoh: "High-risk margin", "Competitor undercut").
- [ ] Clear all filter action + filter count chip.

**DoD:** Semua filter bisa dikombinasikan, hasil table/KPI/URL search params konsisten.

## 3.3 Catalog KPIs
- [ ] Avg margin.
- [ ] SKUs below MAP guardrail.
- [ ] Pending AI recommendations.
- [ ] Avg competitor price gap.
- [ ] Semua KPI dihitung dari dataset yang sudah difilter.

**DoD:** Mengubah filter kategori langsung mengubah semua KPI terkait.

## 3.4 Row Actions & Bulk Actions
- [ ] View SKU detail.
- [ ] Simulate price.
- [ ] Override price manual (RBAC Analyst/Manager).
- [ ] View audit trail (context SKU).
- [ ] Apply strategy to selected SKUs.
- [ ] Sticky bulk-action bar bila ada selection.
- [ ] Manual override dialog dengan min/max/MAP guardrail validation.

**DoD:** Action membawa context SKU yang benar ke route target; forbidden action tidak dapat dieksekusi oleh Ops/Compliance.

## 3.5 SKU Detail Sub-page
- [ ] Route `/catalog/[sku]`.
- [ ] Detail identity, current price, cost, margin health, stock, elasticity.
- [ ] Price history mock sparkline/table fallback.
- [ ] Competitor comparison.
- [ ] Related pending/previous recommendations.
- [ ] Related audit events.
- [ ] Quick actions: Simulate, View audit, back to filtered catalog.

**DoD:** Semua data detail berasal dari SKU identifier URL dan store/query source yang sama.

## 3.6 States & Accessibility
- [ ] Loading skeleton sesuai row height.
- [ ] Empty filter result with Clear filters.
- [ ] Error state mock (simulate query error) + Retry.
- [ ] Table semantics, column header scope, keyboard row focus.

**DoD:** Screen reader dapat memahami header dan cell; warna AI/margin memiliki label teks/ikon.

---

# EPIC 4 — Pricing Strategy Builder
**Priority:** P1
**Tujuan:** Mendefinisikan objective, scope, dan guardrail yang memandu simulation/recommendation.

## 4.1 Strategy List
- [ ] Route `/strategy` menampilkan active, pending manager approval, draft, archived strategies.
- [ ] Search/filter by status/objective/category.
- [ ] Card/table menampilkan name, objective, scope count, guardrail summary, owner, status, updated time.
- [ ] RBAC actions: Analyst create draft/submit; Manager activate/edit/archive.

**DoD:** User dapat membedakan strategy draft, pending, dan active tanpa masuk detail.

## 4.2 Create/Edit Wizard
- [ ] Route `/strategy/new` dan `/strategy/[strategyId]/edit`.
- [ ] Step 1 Objective selector.
- [ ] Step 2 Scope selector prefilled dari Catalog selection store.
- [ ] Step 3 Guardrail form: min/max, MAP, max price change/cycle, auto-approve threshold.
- [ ] Step 4 Review summary.
- [ ] Back/Next navigation tanpa kehilangan input.
- [ ] Draft autosave ke local store saat prototype.

**DoD:** Refresh simulasi local dapat mempertahankan draft; valid strategy dapat dibuat dan muncul di Strategy List.

## 4.3 Guardrail Conflict Detection
- [ ] Validasi minPrice < maxPrice.
- [ ] Validasi max change > 0 dan threshold masuk range 0–100.
- [ ] Deteksi strategy active lain yang scope SKU/category overlap.
- [ ] Tampilkan warning vs blocker sesuai severity.
- [ ] Tampilkan guardrail summary di review step dalam plain language.

**DoD:** User tidak dapat activate strategy dengan bounds invalid; overlap dapat terlihat sebelum submit.

## 4.4 Manager Approval Flow
- [ ] Analyst submit status `pending_manager_approval`.
- [ ] Manager dapat approve activation/reject dengan note.
- [ ] Buat audit event untuk submit/approve/reject strategy.
- [ ] Update notification store untuk Manager.

**DoD:** Analyst tidak bisa bypass activation dengan direct event dispatch atau direct route action.

---

# EPIC 5 — Simulation & Scenario Analysis
**Priority:** P0
**Tujuan:** Mengubah selected SKU + active strategy menjadi scenario yang dapat dikirim sebagai recommendation.

## 5.1 Central Data Migration (Audit P0 Follow-up)
- [ ] Hapus semua direct `generateProducts()` dari `SimulationPage.tsx`.
- [ ] Baca product lewat `useSkuList`/`useSkuDetail` dan strategy lewat `useStrategies`.
- [ ] Ambil `sku` dan `strategyId` dari URL search params.
- [ ] Jika context kosong, tampilkan selector yang membaca source data terpusat.

**DoD:** Harga SKU yang dipilih di Simulation sama persis dengan harga SKU di Catalog dan Recommendation Queue.

## 5.2 Scenario Controls
- [ ] Current price baseline.
- [ ] Proposed price slider/input numeric.
- [ ] Slider range mengikuti strategy guardrail jika strategy aktif tersedia.
- [ ] Inline validation untuk price out-of-range dan MAP breach.
- [ ] Reset to baseline action.
- [ ] Add up to 3 side-by-side scenarios.

**DoD:** Tidak bisa mengirim scenario invalid; user dapat membandingkan baseline + 3 scenario.

## 5.3 Projection Visualization
- [ ] Demand curve visualization.
- [ ] Forecast revenue, gross margin, demand change, price delta.
- [ ] Baseline vs each scenario comparison table.
- [ ] Toggle visual chart ↔ accessible data table.
- [ ] Confidence interval/assumption disclosure card.

**DoD:** Semua projection metric berubah saat proposed price berubah; table fallback punya data yang sama dengan chart.

## 5.4 Scenario Lifecycle
- [ ] Save local scenario draft.
- [ ] Route `/simulation/[scenarioId]` reloads saved scenario.
- [ ] Send to Recommendations creates `Recommendation` with `source: 'simulation'` in central store.
- [ ] Discard action with unsaved changes confirmation.

**DoD:** Recommendation hasil simulation muncul tepat satu kali di queue dengan SKU, price, and rationale yang sama.

---

# EPIC 6 — AI Recommendation & Approval Queue
**Priority:** P0
**Tujuan:** Human-in-the-loop review dengan explainability, reversible decision, dan audit trail.

## 6.1 Central Store Integrity
- [ ] Queue hanya boleh membaca data dari `useRecommendations()`.
- [ ] Semua approve/reject/adjust hanya boleh menulis melalui transition action di Recommendation store.
- [ ] Setelah action, invalidate query recommendations/audit/overview domain.
- [ ] Jangan seed data lokal di page component.

**DoD:** Recommendation yang dibuat dari Simulation, agent mock, atau manual scenario muncul dalam satu queue yang sama.

## 6.2 Recommendation Card
- [ ] Header: SKU, product name, source badge, status, confidence, price delta.
- [ ] RationaleBreakdown per factor (competitor, elasticity, stock, seasonality) dengan weight.
- [ ] Evidence expander: mini trend, current/proposed/competitor value, link ke simulation context.
- [ ] Stale state bila product price/competitor observation lebih baru dari recommendation creation.
- [ ] Deep-link detail route `/recommendations/[recId]`.

**DoD:** User bisa menjawab "apa berubah, berapa dampaknya, dan mengapa agent menyarankan ini" tanpa meninggalkan card.

## 6.3 Approval Actions
- [ ] Approve individual (Analyst/Manager).
- [ ] Reject dengan mandatory note.
- [ ] Adjust: proposed price editable, guardrail validation, mandatory note, status `adjusted`.
- [ ] Undo toast 10 detik untuk approve/reject/adjust sebelum audit commit final.
- [ ] Disable card action ketika pending undo untuk mencegah action tumpang tindih.

**DoD:** Reject/adjust tidak bisa selesai tanpa note; undo membalik status dan tidak menciptakan audit event final.

## 6.4 Bulk Actions
- [ ] Bulk approve threshold untuk Manager saja.
- [ ] Preview jumlah target + total projected impact sebelum confirm.
- [ ] Exclude stale/guardrail-breached recommendations otomatis.
- [ ] Tambahkan confirmation dialog yang fokus accessible.

**DoD:** Analyst tidak dapat menjalankan bulk action; Manager dapat melihat exactly recommendation mana yang akan terpengaruh.

## 6.5 Queue Utilities
- [ ] Sort by confidence, projected margin impact, age, category.
- [ ] Filter by category, source, status, confidence tier, price-change magnitude.
- [ ] Empty state: caught up; stale-only; no match filter.
- [ ] Pagination/virtualized feed jika >100 cards.

**DoD:** Filter/sort tidak mengubah status atau menghilangkan recommendation dari source store.

---

# EPIC 7 — Deployment Workspace
**Priority:** P1
**Tujuan:** Memvisualisasikan penerapan approved recommendation ke channel sebagai frontend prototype.

## 7.1 Central Data Migration (Audit Follow-up)
- [ ] Hapus static `initialRows` sebagai primary data source.
- [ ] Bentuk deployment queue dari recommendation berstatus approved dan `deployed === false`.
- [ ] Baca product price dari `useProductCatalogStore`/query hook.
- [ ] Buat deployment record local state/store per channel.

**DoD:** Recommendation approved muncul otomatis di Deployment tanpa manual duplicate data.

## 7.2 Channel Status Board
- [ ] Cards: POS, E-commerce, Marketplace A, Marketplace B.
- [ ] Status Synced/Pending/Failed, count per state, last update.
- [ ] Mobile-optimized card layout untuk Ops Lead.

**DoD:** Status board konsisten dengan row status di deployment table.

## 7.3 Deployment Actions
- [ ] Trigger deployment (Ops Lead only).
- [ ] Retry failed row (Ops Lead only).
- [ ] Row lock/in-flight state, prevent double-click.
- [ ] Simulated latency + result state untuk prototype.
- [ ] On successful deploy: mark recommendation deployed, update product current price, create PriceEvent, invalidate relevant queries, create notification.

**DoD:** Harga updated dapat dilihat di Catalog setelah simulated sync sukses; Audit mencatat old/new price dan action source.

## 7.4 Failure UX
- [ ] Error reason, retry count, timestamp.
- [ ] Expand row for details.
- [ ] Filter failed/pending/synced.
- [ ] Empty deployment queue state.

**DoD:** Ops Lead dapat menemukan dan retry deployment failure tanpa kehilangan context SKU/channel.

---

# EPIC 8 — Outcome Monitoring & Alerts
**Priority:** P1
**Tujuan:** Membandingkan forecast dengan actual mock outcome dan menghasilkan alert yang tidak noisy.

## 8.1 Forecast vs Actual
- [ ] Buat mock outcome data terkait PriceEvent deployed.
- [ ] Render aggregate trend dan SKU-level comparison.
- [ ] Tampilkan revenue, margin, demand actual vs forecast.
- [ ] Buat accessible table fallback dari chart.

**DoD:** Setiap monitored item dapat ditelusuri ke PriceEvent/recommendation asalnya.

## 8.2 Anomaly Detection UI
- [ ] Threshold deviasi configurable local (default >15%).
- [ ] Group alert by category/strategy/channel dalam digest mode.
- [ ] Real-time/mock granular mode.
- [ ] Severity chip + icon + descriptive label.

**DoD:** 12 SKU anomali pada kategori sama dirender sebagai satu grouped alert dalam digest mode.

## 8.3 Model Review Feedback (Dead Button Fix)
- [ ] Implement handler `Flag for model review`.
- [ ] Update anomaly state `flaggedForReview`.
- [ ] Tambah audit event type/note untuk feedback event.
- [ ] Buat notification/feedback confirmation state.
- [ ] Disable/relabel button setelah flag sukses.

**DoD:** Button bukan dead UI; setelah action, state terlihat di Monitoring dan Audit.

---

# EPIC 9 — Audit & Governance
**Priority:** P1
**Tujuan:** Menyediakan frontend system-of-record yang dapat ditelusuri untuk setiap action pricing.

## 9.1 Audit Data Integrity
- [ ] Standarisasi audit event untuk: strategy submit/activate, scenario sent, recommendation approve/reject/adjust, deployment success/failure/retry, model-review feedback, manual override.
- [ ] Tambah event metadata: `actorId`, `actorRole`, `entityType`, `entityId`, `source`, `note`, `timestamp`, optional snapshot.
- [ ] Tambah `currentUser` frontend mock ke session/role state.

**DoD:** Semua action penting di workflow dapat dicari kembali lewat audit log.

## 9.2 Role-Filtered Audit
- [ ] Manager/Compliance: view all.
- [ ] Analyst: filter berdasarkan `actorId`/assigned or owned SKU IDs, bukan berdasarkan `actorRole` generik.
- [ ] Ops Lead: restricted deployment-related view bila diperlukan oleh UX.
- [ ] Enforce filter di query/hook selector, bukan cuma hide UI.

**DoD:** Dua analyst berbeda tidak melihat audit event milik analyst lain melalui direct URL/filter manipulation.

## 9.3 Audit Screen
- [ ] Filter date range, actor, source, event type, SKU, status.
- [ ] Timeline/list view.
- [ ] Drill-in panel with price before/after, rationale snapshot, strategy/scenario relation.
- [ ] Context deep links: Catalog SKU, Recommendation, Deployment record.
- [ ] CSV export UI mock, RBAC Manager/Compliance.

**DoD:** User bisa menemukan satu event price change via SKU lalu menelusuri rationale dan deployment outcome dari screen yang sama.

---

# EPIC 10 — Overview Dashboard
**Priority:** P1
**Tujuan:** Menjadi landing page yang merangkum state aktual semua feature, bukan dummy dashboard.

## 10.1 Role-Aware KPIs
- [ ] Analyst: pending approvals, personal reviewed items, active anomalies.
- [ ] Manager: margin impact, override rate, strategy health, pending manager approvals.
- [ ] Ops Lead: channel failures, pending syncs, last deployment.
- [ ] Compliance: audit volume, manual overrides, policy/guardrail exceptions.

**DoD:** Mengganti role dev switcher mengubah KPI dan quick links sesuai persona.

## 10.2 Charts & Activity
- [ ] Margin trend.
- [ ] Price-change volume by category.
- [ ] Competitor gap heatmap/list equivalent.
- [ ] Recent activity from recommendation/audit/deployment events.
- [ ] Chart table fallback untuk accessibility.

**DoD:** Semua KPI/chart dihitung dari store/query layer yang sama, tanpa hardcoded business number.

## 10.3 Deep Links & Telemetry
- [ ] Pending approval quick link → prefiltered Recommendation Queue.
- [ ] Guardrail breach quick link → prefiltered Catalog/Strategy context.
- [ ] Deployment failure quick link → filtered Deployment.
- [ ] Instrument frontend event stub: page viewed, quick link clicked, recommendation approved/rejected/adjusted, undo used, bulk approval initiated.

**DoD:** Link membawa filter context yang benar; event stub terpicu pada semua critical interaction.

---

# EPIC 11 — Internationalization Completion
**Priority:** P1
**Tujuan:** Menghilangkan hardcoded microcopy dan menjadikan UI siap Indonesia/English.

- [ ] Integrasikan `useTranslation()` ke Strategy, Simulation, Deployment, Monitoring, Audit, AppShell, command menu, shared components.
- [ ] Pindahkan seluruh copy UI ke `id.json`/`en.json` terpisah (jangan satu file raksasa ketika mulai besar).
- [ ] Tambah translation keys untuk error, empty, loading, permission denied, confirmation, toast, date labels.
- [ ] Implement locale-aware `formatPrice`, `formatPercent`, `formatDate`, `formatRelativeTime`.
- [ ] Add missing-key development warning.
- [ ] QA language overflow/longer string khusus Indonesian.

**DoD:** Search for literal user-facing strings di `app/` dan `components/` tidak menemukan hardcoded copy selain test fixture; ID/EN toggle mengubah seluruh page.

---

# EPIC 12 — Testing, Accessibility & Performance Hardening
**Priority:** P2
**Tujuan:** Membuat prototype frontend stabil untuk demo, usability testing, dan iterasi tim.

## 12.1 Unit Tests
- [ ] Test `useProductCatalogStore.hydrate()` idempotent.
- [ ] Test `bootstrapMestaData()` tidak duplicate seed.
- [ ] Test recommendation state transitions invalid/valid.
- [ ] Test strategy state transitions invalid/valid.
- [ ] Test notification grouping.
- [ ] Lanjutkan test RBAC matrix untuk semua action dan role.

**DoD:** Semua store kritis punya test normal path + invalid path.

## 12.2 Component Tests
- [ ] RoleGate hide/disable behavior.
- [ ] DeltaBadge aria label and icon pairing.
- [ ] Recommendation reject mandatory note.
- [ ] Undo action cancels final audit event.
- [ ] Catalog virtual table renders data with filters.
- [ ] Locale toggle changes translated labels.

**DoD:** Component critical flow punya test user-facing, bukan cuma test implementation detail.

## 12.3 E2E Tests (Playwright)
- [ ] Analyst flow: Catalog → select SKU → create/submit strategy → simulation → send recommendation → approve/reject → audit.
- [ ] Manager flow: activate strategy → bulk approve → verify audit.
- [ ] Ops flow: view deployment → retry failed channel → verify Catalog price + audit event.
- [ ] Compliance flow: audit filter/export visibility only.
- [ ] Keyboard navigation flow: Cmd/Ctrl+K search → open SKU detail → navigate back.

**DoD:** E2E smoke suite lulus di Chromium viewport desktop dan mobile.

## 12.4 Accessibility
- [ ] WCAG AA contrast audit (dark/light themes).
- [ ] Full keyboard audit semua routes.
- [ ] Screen-reader labeling: table, chart fallback, dialog, toast, command menu, form errors.
- [ ] Focus trap pada modal/dialog.
- [ ] Respect reduced motion for visual transition/toast.

**DoD:** Tidak ada critical accessibility violation dari automated audit + manual keyboard pass.

## 12.5 Performance
- [ ] Benchmark 5.000 SKU in Catalog.
- [ ] Validate virtualizer row measurement.
- [ ] Route-level code splitting untuk chart-heavy screen.
- [ ] Bundle check; lazy-load charts/large dialog components.
- [ ] Lighthouse performance run untuk Overview, Catalog, Recommendations.

**DoD:** Catalog remain interactive when filtering 5.000 mock rows; no unnecessary full rerender across routes.

---

# EPIC 13 — Design System Governance & Documentation
**Priority:** P2
**Tujuan:** Memastikan Mesta tetap konsisten saat UI bertambah.

- [ ] Setup Storybook.
- [ ] Dokumentasikan every Mesta design-system component, props, states, a11y behavior, do/don't.
- [ ] Tambah visual regression baseline untuk primitives dan card/table patterns.
- [ ] Buat component decision guide: kapan gunakan `StatusChip`, `DeltaBadge`, `AgentBorderCard`, alert, toast, dialog.
- [ ] Link langsung ke React Bits Pro category yang dipakai per component pattern.

**DoD:** Developer baru dapat menemukan, memahami, dan menggunakan component tanpa copy-paste style dari page lain.

---

# EPIC 14 — UX Completeness & Product Polish
**Priority:** P3
**Tujuan:** Menutup sub-pages, saved views, dan edge-case UX yang tidak memblokir loop utama.

- [ ] Recommendation detail sub-page `/recommendations/[recId]`.
- [ ] Scenario detail sub-page `/simulation/[scenarioId]`.
- [ ] Strategy edit/history/rollback UI.
- [ ] Saved Catalog views and filter presets.
- [ ] Theme switcher dark/light.
- [ ] In-app feedback widget frontend-only.
- [ ] Support/help pattern dan contextual glossary untuk margin, elasticity, MAP, confidence.
- [ ] Improve Command Menu ranking/recent items.

**DoD:** Semua entity utama punya deep link/readable detail context; user tidak perlu mengingat state sebelumnya untuk memahami detail screen.

---

# Dependency Order / Build Sequence

```text
Epic 0 Foundation
  → Epic 1 Bootstrap + Query Layer
  → Epic 2 App Shell
  → Epic 3 Catalog
  → Epic 4 Strategy
  → Epic 5 Simulation
  → Epic 6 Recommendations
  → Epic 7 Deployment
  → Epic 8 Monitoring
  → Epic 9 Audit
  → Epic 10 Overview
  → Epic 11 i18n completion
  → Epic 12 Testing/A11y/Performance
  → Epic 13 Governance
  → Epic 14 Polish
```

## Critical Path Checklist Before Calling Frontend MVP “Complete”

- [ ] Semua product/recommendation data berasal dari satu bootstrap/store source.
- [ ] Simulation dan Deployment sudah migrasi dari local generator/static rows ke query/store layer.
- [ ] Catalog → Strategy → Simulation → Recommendation → Deployment → Audit → Overview berjalan end-to-end dengan state yang sama.
- [ ] Role permission benar-benar memblokir action, bukan hanya menyembunyikan tombol.
- [ ] Semua halaman ID/EN; tidak ada hardcoded UI copy.
- [ ] Catalog mampu menangani 5.000 SKU mock dengan virtualisasi.
- [ ] Minimal satu E2E test per persona lulus.
- [ ] Known limitations yang tersisa terdokumentasi di final audit.

---

# References

- [Mesta-Dynamic-Pricing GitHub repository](https://github.com/TANTIRA/Mesta-Dynamic-Pricing) — repo asal; akses konten organisasi terbatas.
- [AIP Dynamic Pricing for Retail — Palantir AIP Now](https://aip.palantir.com/workflow/9bc66665-6f45-493c-93ae-e8676dc85563) — referensi arah workflow agentic retail pricing.
- [React Bits Pro — Application UI](https://pro.reactbits.dev/docs/app-ui) — katalog component blocks.
- [React Bits Pro — Installation](https://pro.reactbits.dev/docs/installation) — setup registry melalui shadcn CLI.
- [React Bits Pro — Builder](https://pro.reactbits.dev/builder) — builder untuk kebutuhan landing page terpisah.
