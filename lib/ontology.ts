export type Role = 'analyst' | 'manager' | 'ops_lead' | 'compliance';

export interface UserSession {
  userId: string;
  name: string;
  role: Role;
  ownedSkuIds: string[];
}

export type ElasticityBand = 'inelastic' | 'moderate' | 'elastic';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Product {
  sku: string;
  name: string;
  category: string;
  /** Org → BU → Region → Store scope (BU derived via buOf). */
  region: string;
  store: string;
  cost: number;
  price: number;
  minPrice: number;
  maxPrice: number;
  mapPrice: number;
  competitorAvg: number;
  elasticity: number; // negative number, e.g. -1.4
  stockUnits: number;
  stockStatus: StockStatus;
  lastChangeAt: string; // ISO
  priceHistory: { at: string; price: number }[];
}

export interface CompetitorObservation {
  sku: string;
  competitor: string;
  price: number;
  observedAt: string;
}

export type StrategyObjective = 'maximize_margin' | 'maximize_revenue' | 'match_competitor' | 'clear_inventory';
export type StrategyStatus = 'draft' | 'pending_manager_approval' | 'active' | 'archived';

export interface Guardrail {
  minPrice: number | null;
  maxPrice: number | null;
  mapEnforced: boolean;
  maxChangePercent: number; // per cycle
  autoApproveThreshold: number; // 0-100 confidence
}

export interface Strategy {
  id: string;
  name: string;
  objective: StrategyObjective;
  skuIds: string[];
  categories: string[];
  guardrail: Guardrail;
  status: StrategyStatus;
  ownerId: string;
  updatedAt: string;
}

export interface Scenario {
  id: string;
  sku: string;
  strategyId: string | null;
  proposedPrice: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  /** Set once the scenario was sent to the queue; a scenario can be sent only once. */
  recommendationId: string | null;
}

export type RationaleFactorKey = 'competitor' | 'elasticity' | 'stock' | 'seasonality' | 'rule';
export interface RationaleFactor {
  key: RationaleFactorKey;
  weight: number; // 0-1, sums to ~1
  detail: string;
}

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'adjusted' | 'changes_requested' | 'escalated' | 'expired';
export type RecommendationSource = 'agent' | 'simulation' | 'manual';

/** WHEN condition fields — every value derivable from stored product data. */
export type RuleConditionField = 'competitor_gap_pct' | 'margin_pct' | 'stock_units' | 'days_since_change';
export type ConditionOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
export interface RuleCondition { field: RuleConditionField; op: ConditionOp; value: number }
/** THEN formulas: what price the rule proposes when it fires. */
export type RuleFormulaKind = 'match_competitor' | 'delta_percent' | 'min_margin_pct';
export interface RuleFormula { kind: RuleFormulaKind; value: number }
export type RuleStatus = 'active' | 'draft' | 'paused';
/** Where a rule applies — empty arrays mean "all". */
export interface RuleScope { categories: string[]; regions: string[]; skus: string[] }

/** WHEN/AND/THEN pricing rule (enterprise EPIC 06). Lower priority wins; ties are conflicts. */
export interface Rule {
  id: string;
  name: string;
  status: RuleStatus;
  priority: number;
  scope: RuleScope;
  when: RuleCondition[];
  then: RuleFormula;
  ownerId: string;
  updatedAt: string;
}

export interface Recommendation {
  id: string;
  sku: string;
  currentPrice: number;
  proposedPrice: number;
  confidence: number; // 0-100
  source: RecommendationSource;
  status: RecommendationStatus;
  rationale: RationaleFactor[];
  projectedMarginImpact: number; // IDR
  strategyId: string | null;
  scenarioId: string | null;
  /** Set when the rec was produced by a WHEN/AND/THEN rule run. */
  ruleId: string | null;
  createdAt: string;
  /** Who produced the recommendation — 'agent' for generated ones, a user id for simulation sends. */
  ownerId: string;
  decidedAt: string | null;
  decisionNote: string | null;
  deployed: boolean;
}

export interface PriceEvent {
  id: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
  recommendationId: string | null;
  source: 'deployment' | 'manual_override';
  at: string;
}

export type Channel = 'pos' | 'ecommerce' | 'marketplace_a' | 'marketplace_b';
export type DeploymentStatus = 'pending' | 'in_flight' | 'synced' | 'failed' | 'cancelled' | 'rolled_back';

/** Aggregate publish lifecycle — derived from its channel records plus job-level terminals. */
export type PublishJobStatus = 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'rolled_back' | 'cancelled';

/** One publish job per recommendation: batches the per-channel DeploymentRecords. */
export interface PublishJob {
  id: string;
  recommendationId: string;
  sku: string;
  status: PublishJobStatus;
  /** ISO time the job is due; null = immediate. Scheduled jobs promote via runScheduledJob (no backend clock). */
  scheduledFor: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentRecord {
  id: string;
  recommendationId: string;
  /** The publish job this channel attempt belongs to. */
  jobId: string;
  sku: string;
  channel: Channel;
  status: DeploymentStatus;
  retryCount: number;
  errorReason: string | null;
  updatedAt: string;
}

export interface AnomalyAlert {
  id: string;
  sku: string;
  category: string;
  deviationPercent: number;
  severity: 'info' | 'warning' | 'critical';
  flaggedForReview: boolean;
  createdAt: string;
  channel: Channel;
  strategyId: string | null;
}

export type AuditEventType =
  | 'strategy_submit' | 'strategy_activate' | 'strategy_reject' | 'strategy_rollback'
  | 'scenario_sent'
  | 'recommendation_approve' | 'recommendation_reject' | 'recommendation_adjust'
  | 'recommendation_request_changes' | 'recommendation_escalate' | 'recommendation_expire' | 'recommendation_resubmit'
  | 'deployment_success' | 'deployment_failure' | 'deployment_retry' | 'deployment_rollback'
  | 'publish_scheduled' | 'publish_cancelled'
  | 'rule_save' | 'rule_run'
  | 'model_review_feedback' | 'manual_override';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actorId: string;
  actorRole: Role;
  entityType: 'strategy' | 'scenario' | 'recommendation' | 'deployment' | 'anomaly' | 'product' | 'rule';
  entityId: string;
  sku: string | null;
  source: 'ui' | 'agent' | 'system';
  note: string | null;
  timestamp: string;
  snapshot?: { oldPrice?: number; newPrice?: number };
}

export interface OutcomeMetrics {
  revenue: number;
  margin: number;
  units: number;
}

/** Forecast vs actual for one deployed price change; traceable to its PriceEvent and recommendation. */
export interface Outcome {
  id: string;
  sku: string;
  category: string;
  recommendationId: string | null;
  priceEventId: string | null;
  forecast: OutcomeMetrics;
  actual: OutcomeMetrics;
  at: string;
}

export interface FeedbackEntry {
  id: string;
  message: string;
  page: string;
  at: string;
}
