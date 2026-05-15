import { UserProfile, Loan } from '../types';

export interface DebtPlan {
  totalDebt: number;
  highestInterestLoan: Loan | null;
  payoffPriority: Loan[];
  estimatedPayoffGuidance: string;
}

export function generateDebtPlan(profile: UserProfile): DebtPlan {
  const loans = [...(profile.loans || [])];
  
  const totalDebt = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  
  // Avalanche method: sort by highest interest rate first
  const payoffPriority = loans.sort((a, b) => (b.rate || 0) - (a.rate || 0));
  
  const highestInterestLoan = payoffPriority.length > 0 ? payoffPriority[0] : null;
  
  let guidance = "You have no active loans recorded.";
  if (loans.length > 0) {
    if (highestInterestLoan && highestInterestLoan.rate > 10) {
      guidance = `We recommend the Avalanche Method. Pay minimums on all loans, but put every extra rupee towards your ${highestInterestLoan.name} (${highestInterestLoan.rate}%) to save the most on interest.`;
    } else {
      guidance = `Your loans have relatively manageable interest rates. Keep paying the EMIs steadily, and any extra cash can go towards the ${highestInterestLoan?.name || 'highest rate loan'}.`;
    }
  }

  return {
    totalDebt,
    highestInterestLoan,
    payoffPriority,
    estimatedPayoffGuidance: guidance
  };
}
