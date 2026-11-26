import {
  ANTIGRAVITY_ENDPOINTS,
  SEARCH_MODEL,
  SEARCH_SYSTEM_INSTRUCTION,
  SEARCH_TIMEOUT_MS,
} from "./constants.ts"
import { buildAntigravityHubHeaders } from "./headers.ts"

export interface GroundingChunk {
  web?: {
    uri?: string
    title?: string
  }
}

export interface GroundingSupport {
  segment?: {
    startIndex?: number
    endIndex?: number
    text?: string
  }
  groundingChunkIndices?: number[]
}

export interface GroundingMetadata {
  webSearchQueries?: string[]
  groundingChunks?: GroundingChunk[]
  groundingSupports?: GroundingSupport[]
  searchEntryPoint?: {
    renderedContent?: string
  }
}

export interface UrlMetadata {
  retrieved_url?: string
  url_retrieval_status?: string
}

export interface UrlContextMetadata {
  url_metadata?: UrlMetadata[]
}

export interface SearchCandidate {
  content?: {
    parts?: Array<{ text?: string }>
    role?: string
  }
  finishReason?: string
  groundingMetadata?: GroundingMetadata
  urlContextMetadata?: UrlContextMetadata
}

export interface SearchResponse {
  candidates?: SearchCandidate[]
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

export interface AntigravitySearchResponse {
  response?: SearchResponse
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

export interface SearchArgs {
  query: string
  urls?: string[]
  thinking?: boolean
}

export interface SearchResult {
  text: string
  sources: Array<{ title: string; url: string }>
  searchQueries: string[]
  urlsRetrieved: Array<{ url: string; status: string }>
}

export type CandidateGroundingSummary = Omit<SearchResult, "text">

export interface ExecuteAntigravitySearchOptions {
  abortSignal?: AbortSignal
  endpoint?: string
  endpoints?: readonly string[]
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
  userAgent?: string
  timeoutMs?: number
  onDebug?: (message: string, metadata?: Record<string, unknown>) => void
}

let sessionCounter = 0
const sessionPrefix = `search-${Date.now().toString(36)}`

function generateRequestId(): string {
  return `search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function getSessionId(): string {
  sessionCounter++
  return `${sessionPrefix}-${sessionCounter}`
}

export function parseCandidateGrounding(
  candidate: Pick<SearchCandidate, "groundingMetadata" | "urlContextMetadata"> | undefined,
  options?: { deduplicateSources?: boolean },
): CandidateGroundingSummary {
  const summary: CandidateGroundingSummary = {
    sources: [],
    searchQueries: [],
    urlsRetrieved: [],
  }
  if (!candidate) {
    return summary
  }

  const deduplicate = options?.deduplicateSources ?? true
  const seenUrls = new Set<string>()

  if (candidate.groundingMetadata) {
    const groundingMeta = candidate.groundingMetadata
    if (Array.isArray(groundingMeta.webSearchQueries)) {
      summary.searchQueries = groundingMeta.webSearchQueries.filter(
        (q): q is string => typeof q === "string" && q.length > 0,
      )
    }

    if (Array.isArray(groundingMeta.groundingChunks)) {
      for (const chunk of groundingMeta.groundingChunks) {
        const uri = chunk?.web?.uri
        const title = chunk?.web?.title
        if (typeof uri === "string" && uri.length > 0 && typeof title === "string" && title.length > 0) {
          if (deduplicate) {
            if (seenUrls.has(uri)) continue
            seenUrls.add(uri)
          }
          summary.sources.push({ title, url: uri })
        }
      }
    }
  }

  if (Array.isArray(candidate.urlContextMetadata?.url_metadata)) {
    for (const meta of candidate.urlContextMetadata.url_metadata) {
      if (typeof meta?.retrieved_url === "string" && meta.retrieved_url.length > 0) {
        summary.urlsRetrieved.push({
          url: meta.retrieved_url,
          status: typeof meta.url_retrieval_status === "string" ? meta.url_retrieval_status : "UNKNOWN",
        })
      }
    }
  }

  return summary
}

export function formatGroundingFooter(grounding: CandidateGroundingSummary): string {
  const lines: string[] = []

  if (grounding.sources.length > 0) {
    lines.push("### Sources")
    for (const source of grounding.sources) {
      lines.push(`- [${source.title}](${source.url})`)
    }
    lines.push("")
  }

  if (grounding.urlsRetrieved.length > 0) {
    lines.push("### URLs Retrieved")
    for (const url of grounding.urlsRetrieved) {
      const status = url.status === "URL_RETRIEVAL_STATUS_SUCCESS" ? "✓" : "✗"
      lines.push(`- ${status} ${url.url}`)
    }
    lines.push("")
  }

  if (grounding.searchQueries.length > 0) {
    lines.push("### Search Queries Used")
    for (const q of grounding.searchQueries) {
      lines.push(`- "${q}"`)
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  return lines.join("\n")
}

export function formatAntigravitySearchResult(result: SearchResult): string {
  const lines: string[] = []

  lines.push("## Search Results\n")
  lines.push(result.text)
  lines.push("")

  if (result.sources.length > 0) {
    lines.push("### Sources")
    for (const source of result.sources) {
      lines.push(`- [${source.title}](${source.url})`)
    }
    lines.push("")
  }

  if (result.urlsRetrieved.length > 0) {
    lines.push("### URLs Retrieved")
    for (const url of result.urlsRetrieved) {
      const status = url.status === "URL_RETRIEVAL_STATUS_SUCCESS" ? "✓" : "✗"
      lines.push(`- ${status} ${url.url}`)
    }
    lines.push("")
  }

  if (result.searchQueries.length > 0) {
    lines.push("### Search Queries Used")
    for (const q of result.searchQueries) {
      lines.push(`- "${q}"`)
    }
  }

  return lines.join("\n")
}

export function parseAntigravitySearchResponse(data: AntigravitySearchResponse): SearchResult {
  const result: SearchResult = {
    text: "",
    sources: [],
    searchQueries: [],
    urlsRetrieved: [],
  }

  const response = data.response
  if (!response || !response.candidates || response.candidates.length === 0) {
    if (data.error) {
      result.text = `Error: ${data.error.message ?? "Unknown error"}`
    } else if (response?.error) {
      result.text = `Error: ${response.error.message ?? "Unknown error"}`
    }
    return result
  }

  const candidate = response.candidates[0]
  if (!candidate) {
    return result
  }

  if (candidate.content?.parts) {
    result.text = candidate.content.parts
      .map((p: { text?: string }) => p.text ?? "")
      .filter(Boolean)
      .join("\n")
  }

  const grounding = parseCandidateGrounding(candidate, { deduplicateSources: false })
  result.sources = grounding.sources
  result.searchQueries = grounding.searchQueries
  result.urlsRetrieved = grounding.urlsRetrieved

  return result
}

function isRetryableSearchEndpointStatus(status: number): boolean {
  return status === 404 || status === 408 || status === 429 || status >= 500
}

export async function executeAntigravitySearch(
  args: SearchArgs,
  accessToken: string,
  projectId: string,
  options?: ExecuteAntigravitySearchOptions,
): Promise<string> {
  const { query, urls, thinking = true } = args

  let prompt = query
  if (urls && urls.length > 0) {
    const urlList = urls.join("\n")
    prompt = `${query}\n\nURLs to analyze:\n${urlList}`
  }

  const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }]
  if (urls && urls.length > 0) {
    tools.push({ urlContext: {} })
  }

  const requestPayload = {
    systemInstruction: {
      parts: [{ text: SEARCH_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    tools,
    generationConfig: {
      temperature: 0,
      topP: 1,
    },
  }

  const wrappedBody = {
    project: projectId,
    model: SEARCH_MODEL,
    userAgent: "antigravity",
    requestId: generateRequestId(),
    request: {
      ...requestPayload,
      sessionId: getSessionId(),
    },
  }

  const candidateEndpoints =
    options?.endpoints && options.endpoints.length > 0
      ? options.endpoints
      : [options?.endpoint ?? ANTIGRAVITY_ENDPOINTS.daily]

  const fetchImpl = options?.fetch ?? globalThis.fetch
  const baseHeaders: Record<string, string> =
    options?.headers ??
    (options?.userAgent
      ? { "User-Agent": options.userAgent }
      : { ...buildAntigravityHubHeaders() })
  const timeoutMs = options?.timeoutMs ?? SEARCH_TIMEOUT_MS

  options?.onDebug?.("Executing search", {
    query,
    urlCount: urls?.length ?? 0,
    thinking,
  })

  let lastHttpFailure: { status: number; statusText: string; errorText: string } | undefined

  for (let index = 0; index < candidateEndpoints.length; index++) {
    const endpoint = candidateEndpoints[index]!
    const isLastEndpoint = index === candidateEndpoints.length - 1
    const url = `${endpoint}/v1internal:generateContent`

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wrappedBody),
        signal: options?.abortSignal ?? AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const errorText = await response.text()
        options?.onDebug?.("Search API error", { status: response.status, error: errorText })
        lastHttpFailure = {
          status: response.status,
          statusText: response.statusText,
          errorText,
        }
        if (!isLastEndpoint && isRetryableSearchEndpointStatus(response.status)) {
          continue
        }
        return `## Search Error\n\nFailed to execute search: ${response.status} ${response.statusText}\n\n${errorText}\n\nPlease try again with a different query.`
      }

      const data = (await response.json()) as AntigravitySearchResponse
      options?.onDebug?.("Search response received", { hasResponse: !!data.response })

      const result = parseAntigravitySearchResponse(data)
      const formatted = formatAntigravitySearchResult(result)
      options?.onDebug?.("Search response formatted", { resultLength: formatted.length })
      return formatted
    } catch (error) {
      if (options?.abortSignal?.aborted) {
        const message = error instanceof Error ? error.message : String(error)
        options?.onDebug?.("Search execution error", { error: message })
        return `## Search Error\n\nFailed to execute search: ${message}. Please try again with a different query.`
      }
      if (!isLastEndpoint) {
        continue
      }
      const message = error instanceof Error ? error.message : String(error)
      options?.onDebug?.("Search execution error", { error: message })
      return `## Search Error\n\nFailed to execute search: ${message}. Please try again with a different query.`
    }
  }

  if (lastHttpFailure) {
    return `## Search Error\n\nFailed to execute search: ${lastHttpFailure.status} ${lastHttpFailure.statusText}\n\n${lastHttpFailure.errorText}\n\nPlease try again with a different query.`
  }
  return "## Search Error\n\nFailed to execute search: Unknown error. Please try again with a different query."
}
