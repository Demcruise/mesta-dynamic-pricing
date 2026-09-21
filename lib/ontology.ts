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

export type RationaleFactorKey = 'competitor' | 'elasticity' | 'stock' | 'seasonality';
export interface RationaleFactor {
  key: RationaleFactorKey;
  weight: number; // 0-1, sums to ~1
  detail: string;
}

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'adjusted';
export type RecommendationSource = 'agent' | 'simulation' | 'manual';

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
  createdAt: string;
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
export type DeploymentStatus = 'pending' | 'in_flight' | 'synced' | 'failed';

export interface DeploymentRecord {
  id: string;
  recommendationId: string;
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
}

export type AuditEventType =
  | 'strategy_submit' | 'strategy_activate' | 'strategy_reject'
  | 'scenario_sent'
  | 'recommendation_approve' | 'recommendation_reject' | 'recommendation_adjust'
  | 'deployment_success' | 'deployment_failure' | 'deployment_retry'
  | 'model_review_feedback' | 'manual_override';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actorId: string;
  actorRole: Role;
  entityType: 'strategy' | 'scenario' | 'recommendation' | 'deployment' | 'anomaly' | 'product';
  entityId: string;
  sku: string | null;
  source: 'ui' | 'agent' | 'system';
  note: string | null;
  timestamp: string;
  snapshot?: { oldPrice?: number; newPrice?: number };
}
