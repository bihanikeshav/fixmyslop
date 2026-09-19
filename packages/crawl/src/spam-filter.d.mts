export interface SpamRecord {
  host?: string;
  desktop?: { elements?: Array<{ textSnippet?: string }>; sections?: Array<{ heading?: string }> } | null;
  mobile?: { elements?: Array<{ textSnippet?: string }>; sections?: Array<{ heading?: string }> } | null;
}

export interface SpamScoreResult {
  score: number;
  signals: string[];
  hardFlag: boolean;
  textSample: string;
  charCount: number;
}

export declare function scoreRecord(record: SpamRecord): SpamScoreResult | null;
export declare function collectRecordText(record: SpamRecord): { allText: string; headings: string[] } | null;
export declare function registrableDomain(host: string): string;
export declare function extractDomainTokens(text: string): Set<string>;
export declare const THRESHOLDS: {
  gamblingWeightedDensityHard: number;
  gamblingWeightedHitsMinForHard: number;
  gamblingDensitySoftWeightPerUnit: number;
  gamblingDensitySoftCap: number;
  pharmaStrongWeightPerTerm: number;
  pharmaWeakWeightPerTerm: number;
  pharmaCap: number;
  wpDefaultWeightPerPhrase: number;
  wpDefaultCap: number;
  linkFarmDomainCountSoft: number;
  linkFarmDomainCountHard: number;
  linkFarmSoftWeight: number;
  parkedSoftWeightPerHit: number;
  parkedSoftCap: number;
  softFlagThreshold: number;
  borderlineFloor: number;
};
