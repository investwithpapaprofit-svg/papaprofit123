import { UserProfile } from '../types';

export function SavingsPercentile({ profile }: { profile: UserProfile }) {
  const sr = profile.metrics?.savingsRate || 0;
  
  if (sr <= 0) return null; // Only show if positive savings rate

  let percentile = 0;
  if (sr < 5) percentile = 20;
  else if (sr < 10) percentile = 40;
  else if (sr < 15) percentile = 50;
  else if (sr < 20) percentile = 65;
  else if (sr < 30) percentile = 80;
  else if (sr < 40) percentile = 90;
  else if (sr < 50) percentile = 95;
  else percentile = 99;

  // Age formatting
  const rawAge = profile.personal?.age;
  let ageBucket = "your age group";
  
  if (typeof rawAge === 'number' || (typeof rawAge === 'string' && !isNaN(parseInt(rawAge)))) {
      const ageNum = typeof rawAge === 'number' ? rawAge : parseInt(rawAge);
      if (ageNum < 25) ageBucket = "Indians under 25";
      else if (ageNum <= 34) ageBucket = "Indians aged 25–34";
      else if (ageNum <= 44) ageBucket = "Indians aged 35–44";
      else if (ageNum <= 54) ageBucket = "Indians aged 45–54";
      else ageBucket = "Indians aged 55+";
  } else if (typeof rawAge === 'string' && (rawAge as string).length > 0) {
      ageBucket = `Indians aged ${rawAge}`;
  }

  const emoji = percentile >= 80 ? '👑' : percentile >= 50 ? '📈' : '🌱';

  return (
    <div className="bg-gradient-to-r from-[#1a7a4a] to-[#22c55e] rounded-[14px] p-5 text-white shadow-md relative overflow-hidden flex items-center justify-between mt-4">
       <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl transform translate-x-4 -translate-y-4">
         {emoji}
       </div>
       <div className="relative z-10 w-full">
         <h4 className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/70 mb-1">Peer Benchmark</h4>
         <p className="text-lg md:text-xl font-bold leading-tight">
            Your savings rate is better than <span className="text-[#ecfccb] text-2xl font-black">{percentile}%</span> of {ageBucket}.
         </p>
         {percentile >= 80 ? (
           <p className="text-xs text-white/80 mt-2 font-medium">You are in the top tier of wealth builders. Keep compounding.</p>
         ) : percentile >= 50 ? (
           <p className="text-xs text-white/80 mt-2 font-medium">You're doing better than average. Try to push it to {Math.ceil((sr + 5)/5)*5}%!</p>
         ) : (
           <p className="text-xs text-white/80 mt-2 font-medium">Every 1% increase accelerates your financial freedom significantly.</p>
         )}
       </div>
    </div>
  );
}
