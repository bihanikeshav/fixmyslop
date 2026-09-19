export interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

export declare function parseRobotsTxt(text: string): RobotsGroup[];
export declare function selectGroupRules(groups: RobotsGroup[], uaToken: string): RobotsGroup | null;
export declare function isPathAllowed(rules: RobotsRule[], path: string): boolean;
export declare function evaluateRobotsAccess(
  robotsText: string,
  uaToken: string,
  pathAndQuery: string,
): { allowed: boolean; crawlDelay: number | null };

export type RobotsFetch = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status?: number; text(): Promise<string> }>;

export interface FetchRobotsTxtOptions {
  fetchImpl?: RobotsFetch;
  ua?: string;
  timeoutMs?: number;
}
export declare function fetchRobotsTxt(
  origin: string,
  options?: FetchRobotsTxtOptions,
): Promise<{ ok: boolean; text?: string; status?: number; error?: string }>;

export interface CheckRobotsAllowedOptions {
  ua?: string;
  uaToken?: string;
  fetchImpl?: RobotsFetch;
  timeoutMs?: number;
  cache?: Map<string, { text: string; failOpen: boolean }>;
  ignoreRobots?: boolean;
}
export declare function checkRobotsAllowed(
  url: string,
  options?: CheckRobotsAllowedOptions,
): Promise<{ allowed: boolean; crawlDelay?: number | null; reason?: string }>;
