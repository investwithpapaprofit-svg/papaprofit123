export interface Loan {
  name: string;
  amount: number;
  rate: number;
  emi: number;
}

export interface Asset {
  name: string;
  value: number;
  mortgageable?: boolean;
}

export interface Goal {
  name: string;
  target: number;
  saved: number;
  months: number;
}

export interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
}

export interface FinancialSource {
  name: string;
  value: number;
}

export interface UserProfile {
  income: number;
  incomeSources: FinancialSource[];
  expenses: number;
  expenseCategories: FinancialSource[];
  savings: number;
  loans: Loan[];
  assets: {
    property: Asset[];
    gold: number;
    cash: number;
    stocks: Stock[];
    crypto: Asset[];
    other: Asset[];
  };
  subscriptions: any[];
  goals: Goal[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive' | null;
  isPremium?: boolean;
  onboardingCompleted?: boolean;
  lastUpdated: string | null;
}

export interface UserDocument {
  name: string;
  email: string;
  createdAt: string;
  profile: UserProfile;
  portfolio: any[];
  lastUpdated: string;
}
