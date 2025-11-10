import type { ArrestRecord } from "@shared/schema";

export interface MatchFactor {
  factor: string;
  score: number;
  details: string;
}

export interface DuplicateMatch {
  record1: ArrestRecord;
  record2: ArrestRecord;
  confidenceScore: number;
  matchReasons: MatchFactor[];
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

function parseBookingDate(dateStr: string): Date {
  return new Date(dateStr);
}

function dateDifferenceInHours(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60);
}

export function findDuplicates(
  newRecord: ArrestRecord,
  existingRecords: ArrestRecord[],
  minConfidence: number = 60
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingRecords) {
    if (existing.id === newRecord.id) continue;

    const matchFactors: MatchFactor[] = [];
    let totalScore = 0;

    const fullNameSimilarity = stringSimilarity(
      newRecord.fullName,
      existing.fullName
    );
    if (fullNameSimilarity >= 70) {
      const nameScore = Math.round((fullNameSimilarity / 100) * 40);
      matchFactors.push({
        factor: "Name Match",
        score: nameScore,
        details: `${fullNameSimilarity}% similarity between "${newRecord.fullName}" and "${existing.fullName}"`,
      });
      totalScore += nameScore;
    }

    const newDate = parseBookingDate(newRecord.bookingDate);
    const existingDate = parseBookingDate(existing.bookingDate);
    const hoursDiff = dateDifferenceInHours(newDate, existingDate);
    
    if (hoursDiff <= 48) {
      const dateScore = hoursDiff <= 2 ? 30 : hoursDiff <= 24 ? 20 : 10;
      matchFactors.push({
        factor: "Booking Date Proximity",
        score: dateScore,
        details: `Booked ${Math.round(hoursDiff)} hours apart`,
      });
      totalScore += dateScore;
    }

    if (newRecord.county === existing.county) {
      matchFactors.push({
        factor: "Same County",
        score: 15,
        details: `Both in ${newRecord.county}`,
      });
      totalScore += 15;
    }

    if (newRecord.facility && existing.facility && 
        newRecord.facility === existing.facility) {
      matchFactors.push({
        factor: "Same Facility",
        score: 10,
        details: `Both at ${newRecord.facility}`,
      });
      totalScore += 10;
    }

    if (newRecord.age && existing.age && newRecord.age === existing.age) {
      matchFactors.push({
        factor: "Same Age",
        score: 5,
        details: `Both age ${newRecord.age}`,
      });
      totalScore += 5;
    }

    if (matchFactors.length > 0 && totalScore >= minConfidence) {
      matches.push({
        record1: newRecord,
        record2: existing,
        confidenceScore: Math.min(totalScore, 100),
        matchReasons: matchFactors,
      });
    }
  }

  return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function mergeRecords(primary: ArrestRecord, duplicate: ArrestRecord): Partial<ArrestRecord> {
  return {
    inmateId: primary.inmateId || duplicate.inmateId,
    fullName: primary.fullName,
    firstName: primary.firstName || duplicate.firstName,
    lastName: primary.lastName || duplicate.lastName,
    bookingDate: primary.bookingDate,
    releaseDate: primary.releaseDate || duplicate.releaseDate,
    charges: primary.charges,
    bondAmount: primary.bondAmount || duplicate.bondAmount,
    county: primary.county,
    facility: primary.facility || duplicate.facility,
    age: primary.age || duplicate.age,
    gender: primary.gender || duplicate.gender,
    race: primary.race || duplicate.race,
    scrapedDate: primary.scrapedDate,
    sourceUrl: primary.sourceUrl || duplicate.sourceUrl,
    rawData: primary.rawData || duplicate.rawData,
    crmContactId: primary.crmContactId || duplicate.crmContactId,
    crmSyncDate: primary.crmSyncDate || duplicate.crmSyncDate,
    leadScore: Math.max(primary.leadScore || 0, duplicate.leadScore || 0),
  };
}
