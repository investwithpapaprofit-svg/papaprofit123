export const oldSD = 50000;
export const newSD = 75000;

export const applySurchargeAndCess = (tax: number, income: number) => {
  let surcharge = 0;
  if (income > 50000000) surcharge = tax * 0.37;
  else if (income > 20000000) surcharge = tax * 0.25;
  else if (income > 10000000) surcharge = tax * 0.15;
  else if (income > 5000000) surcharge = tax * 0.10;
  
  const taxWithSurcharge = tax + surcharge;
  return taxWithSurcharge * 1.04; 
};

export const calculateOldTax = (inc: number) => {
  if (inc <= 500000) return 0; 
  let tax = 0;
  if (inc > 1000000) {
    tax += (inc - 1000000) * 0.3 + 112500;
  } else if (inc > 500000) {
    tax += (inc - 500000) * 0.2 + 12500;
  } else if (inc > 250000) {
    tax += (inc - 250000) * 0.05;
  }
  return applySurchargeAndCess(tax, inc);
};

export const calculateNewTax = (inc: number) => {
  if (inc <= 1200000) return 0; 
  let tax = 0;
  if (inc > 2400000) tax += (inc - 2400000) * 0.3 + 300000;
  else if (inc > 2000000) tax += (inc - 2000000) * 0.25 + 200000;
  else if (inc > 1600000) tax += (inc - 1600000) * 0.20 + 120000;
  else if (inc > 1200000) tax += (inc - 1200000) * 0.15 + 60000;
  else if (inc > 800000) tax += (inc - 800000) * 0.10 + 20000;
  else if (inc > 400000) tax += (inc - 400000) * 0.05;
  return applySurchargeAndCess(tax, inc);
};
