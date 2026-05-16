export interface Subscription {
  name: string;
  cost: number;
  billingCycle: 'monthly' | 'yearly';
}

export interface IncomeSource {
  name: string;
  value: number; // Monthly
}

export interface Expense {
  name: string;
  value: number; // Monthly
  category?: string;
}

export interface HistoricalEvent {
  date: string;
  timestamp: number;
  type: string;
  description: string;
  amount?: number;
  metricsSnapshot?: FinancialMetrics;
}

export interface Holding {
  symbol: string;
  name: string;
  assetType: 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'bond' | 'other';
  quantity: number;
  averageBuyPrice: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedGainLoss?: number;
  allocation?: number;
}

export interface FinancialMetrics {
  netWorth: number;
  monthlyCashFlow: number;
  savingsRate: number;
  debtToIncomeRatio: number;
  emergencyFundRunwayMonths: number;
  financialHealthScore: number;
  totalIncome?: number;
  totalExpenses?: number;
  totalLiabilities?: number;
}

export interface Insight {
  id: string;
  type: 'anomaly' | 'trend' | 'opportunity' | 'warning' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface FinancialGoal {
  name: string;
  target: number;
  saved: number;
  months: number;
  type?: 'emergency' | 'vacation' | 'vehicle' | 'home' | 'education' | 'retirement' | 'debt' | 'custom';
  monthlyNeeded?: number;
  probabilityOfSuccess?: number;
}

export interface Loan {
  name: string;
  amount: number; // Total outstanding
  rate: number;
  emi: number; // Monthly
}

export interface Asset {
  name: string;
  type: 'property' | 'gold' | 'cash' | 'vehicle' | 'other';
  value: number;
  mortgageable?: boolean;
}

export interface UserPreferences {
  currency: string;
}

export interface UserProfile {
  personal: {
    name?: string;
    age?: number;
    riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  };
  income: IncomeSource[];
  expenses: Expense[];
  loans: Loan[];
  assets: Asset[];
  subscriptions: Subscription[];
  portfolio: Holding[];
  goals: FinancialGoal[];
  metrics: FinancialMetrics;
  insights: Insight[];
  preferences: UserPreferences;
  history: HistoricalEvent[];
  isPremium?: boolean;
  role?: string;
  adminFields?: any;
  onboardingCompleted?: boolean;
  lastUpdated: string | null;
}

export interface UserDocument {
  name?: string;
  email: string;
  createdAt: string;
  profile: UserProfile;
  lastUpdated: string;
}
