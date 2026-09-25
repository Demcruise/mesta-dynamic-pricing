export type Role = 'analyst' | 'manager' | 'approver' | 'ops_lead' | 'compliance';

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
  /** Brand label — part of the product ontology (DATA-004). */
  brand: string;
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
export type StrategyStatus = 'draft' | 'pending_manager_approval' | 'scheduled' | 'active' | 'archived';

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
  /** ISO timestamp a scheduled activation fires at; null unless status === 'scheduled'. */
  activateAt: string | null;
  /** Rules bound to this strategy — a bound rule only fires on SKUs the strategy governs. */
  ruleIds: string[];
  /** Condition signals the strategy's bound rules may use; empty = all signals allowed. */
  signals: RuleConditionField[];
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

/** One recorded step in a multi-level approval chain (APR-003). */
export interface ApprovalStep {
  /** The chain level this step satisfies — e.g. 'manager' or 'approver'. */
  level: Role;
  actorId: string;
  at: string;
  note: string | null;
}

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
  /** Approval-chain steps already recorded; status flips to approved only when the chain completes. */
  approvals: ApprovalStep[];
  deployed: boolean;
}

export interface PriceEvent {
  id: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
  recommendationId: string | null;
  source: 'deployment' | 'manual_override' | 'experiment';
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
  /** Channels this job targets — DeploymentRecords spawn only for these. */
  channels: Channel[];
  /** IANA-style label shown to operators ('Asia/Jakarta' default). Scheduling input is always local time. */
  timezone: string;
  /** Optional end of the publish window — the expiry sweep reverts the price after this time. */
  effectiveUntil: string | null;
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

export type DataSourceKind = 'pos_feed' | 'ecommerce_feed' | 'marketplace_feed' | 'competitor_feed' | 'erp';
export type DataSourceStatus = 'healthy' | 'syncing' | 'delayed' | 'failed' | 'paused';

/** An upstream feed the pricing loop depends on. Coverage/rejects describe the last completed sync. */
export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  status: DataSourceStatus;
  lastSyncAt: string;
  coveragePct: number; // share of catalog SKUs receiving data
  recordsTotal: number;
  rejectedRecords: number;
}

export type OverrideRequestStatus = 'pending' | 'approved' | 'rejected';

/** A manual price override waiting on manager approval — direct edits still exist for managers. */
export interface OverrideRequest {
  id: string;
  sku: string;
  requestedPrice: number;
  reason: string;
  status: OverrideRequestStatus;
  requestedBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'concluded' | 'archived' | 'cancelled';

/** A price experiment: applies a treatment delta to a SKU scope and measures against the demand model. */
export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  skuIds: string[];
  /** Treatment price change in percent, e.g. -5. */
  deltaPct: number;
  status: ExperimentStatus;
  ownerId: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

/** A manager's temporary grant letting a named user decide high-impact recommendations. */
export interface DelegationGrant {
  id: string;
  toUserId: string;
  grantedBy: string;
  createdAt: string;
  until: string;
}

export type AuditEventType =
  | 'strategy_submit' | 'strategy_activate' | 'strategy_reject' | 'strategy_rollback' | 'strategy_save'
  | 'strategy_schedule' | 'strategy_unschedule'
  | 'scenario_sent'
  | 'recommendation_approve' | 'recommendation_reject' | 'recommendation_adjust'
  | 'recommendation_request_changes' | 'recommendation_escalate' | 'recommendation_expire' | 'recommendation_resubmit'
  | 'deployment_success' | 'deployment_failure' | 'deployment_retry' | 'deployment_rollback'
  | 'publish_scheduled' | 'publish_cancelled'
  | 'rule_save' | 'rule_run'
  | 'override_request' | 'override_approve' | 'override_reject'
  | 'datasource_sync'
  | 'experiment_save' | 'experiment_start' | 'experiment_conclude' | 'experiment_cancel'
  | 'experiment_ready' | 'experiment_complete' | 'experiment_archive'
  | 'delegation_grant' | 'delegation_revoke'
  | 'policy_override' | 'publish_window_end'
  | 'notification_acknowledge' | 'notification_snooze' | 'notification_escalate'
  | 'model_review_feedback' | 'manual_override'
  | 'settings_change'
  | 'auth_sign_in' | 'auth_sign_out' | 'auth_sso_failed' | 'auth_access_denied' | 'auth_role_changed' | 'auth_workspace_switched' | 'auth_session_revoked' | 'auth_sso_config_changed' | 'auth_user_provisioned' | 'auth_user_deprovisioned';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actorId: string;
  actorRole: Role;
  entityType: 'strategy' | 'scenario' | 'recommendation' | 'deployment' | 'anomaly' | 'product' | 'rule' | 'override' | 'datasource' | 'experiment' | 'delegation' | 'policy' | 'notification' | 'settings' | 'user';
  entityId: string;
  sku: string | null;
  source: 'ui' | 'agent' | 'system' | 'sso';
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
  /** Set when the outcome measures a running/concluded experiment's treatment. */
  experimentId?: string | null;
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
