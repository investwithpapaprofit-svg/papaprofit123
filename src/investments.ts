import { UserProfile } from './types';
import { finance } from './finance';

export const investments = {
  generateRecommendations(profile: UserProfile): string[] {
    const recommendations: string[] = [];
    
    if (!profile.income || profile.income <= 0) {
      return ["Please add your income to get personalized investment recommendations."];
    }

    const sr = finance.savingsRate(profile);
    const emergencyNeeded = (profile.expenses || 0) * 6;
    const hasEmergencyFund = profile.assets.cash >= emergencyNeeded;

    // 1. Foundation
    if (!hasEmergencyFund) {
      recommendations.push(`**Build your Emergency Fund:** Before investing, ensure you have 6 months of expenses (₹${emergencyNeeded.toLocaleString('en-IN')}) in a liquid savings account or liquid mutual funds.`);
      return recommendations; // Stop here if no emergency fund
    }

    if (sr < 10) {
      recommendations.push(`**Increase Savings Rate:** Your savings rate is below 10%. Try to reduce discretionary expenses to free up capital for investments.`);
    }

    // 2. Risk Profile & Asset Allocation
    const nw = finance.netWorth(profile);
    const totalAssets = finance.totalAssets(profile);
    
    const propertyValue = profile.assets.property.reduce((s, a) => s + (a.value || 0), 0);
    const goldValue = profile.assets.gold || 0;
    const stocksValue = profile.assets.stocks?.reduce((s, a) => s + ((a.currentPrice || a.buyPrice || 0) * (a.quantity || 0)), 0) || 0;
    const cryptoValue = profile.assets.crypto?.reduce((s, a) => s + (a.value || 0), 0) || 0;

    const propertyPct = totalAssets > 0 ? (propertyValue / totalAssets) * 100 : 0;
    const goldPct = totalAssets > 0 ? (goldValue / totalAssets) * 100 : 0;
    const stocksPct = totalAssets > 0 ? (stocksValue / totalAssets) * 100 : 0;
    const cryptoPct = totalAssets > 0 ? (cryptoValue / totalAssets) * 100 : 0;

    if (!profile.riskProfile) {
      recommendations.push(`**Define Risk Profile:** Please tell me your risk appetite (conservative, moderate, or aggressive) so I can suggest a specific asset allocation.`);
    } else {
      if (profile.riskProfile === 'conservative') {
        if (stocksPct > 30) recommendations.push(`**Rebalance Portfolio:** As a conservative investor, your equity exposure (${stocksPct.toFixed(1)}%) is high. Consider shifting some funds to fixed income like FDs or debt mutual funds.`);
        if (cryptoPct > 0) recommendations.push(`**Reduce High Risk:** Crypto is highly volatile and may not suit a conservative profile. Consider reducing this exposure.`);
        if (stocksPct < 10) recommendations.push(`**Add Mild Growth:** Consider adding 10-20% in large-cap index funds to beat inflation while keeping risk low.`);
      } else if (profile.riskProfile === 'moderate') {
        if (stocksPct < 40) recommendations.push(`**Increase Equity:** For moderate growth, consider increasing your equity exposure (currently ${stocksPct.toFixed(1)}%) to 40-60% via diversified mutual funds.`);
        if (goldPct > 15) recommendations.push(`**Reduce Gold:** Your gold allocation (${goldPct.toFixed(1)}%) is slightly high. Gold should ideally be 5-10% of a moderate portfolio as a hedge.`);
      } else if (profile.riskProfile === 'aggressive') {
        if (stocksPct < 60) recommendations.push(`**Maximize Growth:** As an aggressive investor, your equity exposure (${stocksPct.toFixed(1)}%) is low. Consider increasing it to 60-80% using a mix of large, mid, and small-cap funds.`);
        if (propertyPct > 60) recommendations.push(`**Diversify from Real Estate:** Real estate makes up a large portion of your assets (${propertyPct.toFixed(1)}%). It's illiquid. Consider directing new investments into equities.`);
      }
    }

    // 3. Goal-Based Advice
    if (profile.goals.length > 0) {
      profile.goals.forEach(goal => {
        if (goal.months <= 12) {
          recommendations.push(`**Goal '${goal.name}' (Short-term):** Since this goal is less than a year away, keep the funds in safe, liquid instruments like FDs or liquid funds. Avoid stocks.`);
        } else if (goal.months > 12 && goal.months <= 60) {
          recommendations.push(`**Goal '${goal.name}' (Medium-term):** Consider balanced advantage funds or aggressive hybrid funds for this goal to get moderate growth with lower volatility.`);
        } else if (goal.months > 60) {
          recommendations.push(`**Goal '${goal.name}' (Long-term):** You have a long time horizon. Equity mutual funds (like Nifty 50 index funds) are best suited to beat inflation and compound wealth for this goal.`);
        }
      });
    }

    // 4. Tax Saving (Generic Indian context)
    if (profile.income > 1000000 && !profile.assets.other.find(a => a.name.toLowerCase().includes('ppf') || a.name.toLowerCase().includes('elss'))) {
      recommendations.push(`**Tax Optimization:** With your income level, ensure you are maximizing your ₹1.5L Section 80C limit using ELSS (for growth) or PPF (for safety).`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Your portfolio looks well-balanced for your current profile. Keep up the good work and continue your SIPs!");
    }

    return recommendations;
  }
};
