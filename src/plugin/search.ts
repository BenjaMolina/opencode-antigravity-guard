/**
 * Google Search Tool Implementation (Move-and-Reexport facade over @benjamolina/antigravity-guard-core)
 *
 * Due to Gemini API limitations, native search tools (googleSearch, urlContext)
 * cannot be combined with function declarations. This module delegates to the
 * shared core engine that makes separate API calls with only grounding tools enabled.
 */

import {
  executeAntigravitySearch,
  type SearchArgs,
  type SearchResult,
} from "@benjamolina/antigravity-guard-core";
import { ANTIGRAVITY_ENDPOINT, getAntigravityHeaders } from "../constants";
import { createLogger } from "./logger";

export type { SearchArgs, SearchResult };

const log = createLogger("search");

/**
 * Execute a Google Search using the Gemini grounding API.
 *
 * This makes a SEPARATE API call with only googleSearch/urlContext tools,
 * which is required because these tools cannot be combined with function declarations.
 */
export async function executeSearch(
  args: SearchArgs,
  accessToken: string,
  projectId: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  return executeAntigravitySearch(args, accessToken, projectId, {
    abortSignal,
    endpoint: ANTIGRAVITY_ENDPOINT,
    headers: getAntigravityHeaders(),
    onDebug: (message, metadata) => log.debug(message, metadata),
  });
}
