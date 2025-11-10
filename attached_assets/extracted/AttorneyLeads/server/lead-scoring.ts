/**
 * Lead Scoring Algorithm for Attorney Lead Generation
 * 
 * Scores arrests based on:
 * - Charge Severity (felony vs misdemeanor)
 * - Bond Amount (higher bonds indicate more serious cases)
 * - Demographics (age, location)
 * 
 * Score Range: 0-100
 * - 0-30: Low priority
 * - 31-60: Medium priority
 * - 61-100: High priority
 */

export function calculateLeadScore(record: {
  charges: string;
  bondAmount: string | null;
  age: number | null;
  county: string;
}): number {
  let score = 0;

  // 1. Charge Severity Analysis (0-50 points)
  const charges = record.charges.toLowerCase();
  
  // High-value felony keywords (30-50 points)
  const highValueFelonies = [
    'dui', 'dwi', 'domestic violence', 'battery', 'assault',
    'drug possession', 'possession', 'trafficking', 'fraud',
    'theft', 'burglary', 'robbery', 'weapon', 'firearm'
  ];
  
  const violentCrimes = [
    'murder', 'homicide', 'manslaughter', 'aggravated assault',
    'sexual assault', 'rape', 'kidnapping'
  ];
  
  const felonyKeywords = [
    'felony', 'grand theft', 'aggravated'
  ];
  
  if (violentCrimes.some(crime => charges.includes(crime))) {
    score += 50; // Violent crimes = highest attorney demand
  } else if (highValueFelonies.some(crime => charges.includes(crime))) {
    score += 40; // Common high-value cases
  } else if (felonyKeywords.some(keyword => charges.includes(keyword))) {
    score += 30; // General felonies
  } else if (charges.includes('misdemeanor')) {
    score += 15; // Misdemeanors still have value
  } else {
    score += 20; // Unknown/Other charges
  }

  // 2. Bond Amount Analysis (0-30 points)
  if (record.bondAmount) {
    const bondStr = record.bondAmount.replace(/[,$]/g, '');
    const bond = parseFloat(bondStr);
    
    if (!isNaN(bond)) {
      if (bond >= 100000) {
        score += 30; // Very high bond = serious case
      } else if (bond >= 50000) {
        score += 25;
      } else if (bond >= 25000) {
        score += 20;
      } else if (bond >= 10000) {
        score += 15;
      } else if (bond >= 5000) {
        score += 10;
      } else if (bond > 0) {
        score += 5;
      }
    }
  } else {
    // No bond or "No Bond" usually means serious offense
    if (charges.includes('no bond') || record.bondAmount === null) {
      score += 25;
    }
  }

  // 3. Demographics (0-20 points)
  // Age factor: Adults 18-65 are optimal for attorney services
  if (record.age) {
    if (record.age >= 18 && record.age <= 65) {
      score += 10;
    } else if (record.age > 65) {
      score += 5; // Seniors still viable but less common
    }
  } else {
    score += 5; // Unknown age, assume adult
  }

  // County factor: Some counties have higher attorney engagement
  const highValueCounties = [
    'Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 
    'Orange', 'Pinellas', 'Duval'
  ];
  
  if (highValueCounties.includes(record.county)) {
    score += 10; // Major metro areas = more legal resources
  } else {
    score += 5; // Smaller counties still have value
  }

  // Cap score at 100
  return Math.min(score, 100);
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return 'High Priority';
  if (score >= 40) return 'Medium Priority';
  return 'Low Priority';
}

export function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 70) return 'destructive'; // Red/urgent for high priority
  if (score >= 40) return 'default'; // Default for medium
  return 'secondary'; // Muted for low priority
}
