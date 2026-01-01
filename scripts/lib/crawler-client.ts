/**
 * Crawler/Parser API client
 *
 * Communicates with the private crawler and parser services.
 * URLs and API keys are stored as GitHub secrets.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CrawlRequest {
  url: string;
  type?: "software" | "hardware" | "manufacturer";
}

export interface CrawlResult {
  success: boolean;
  url: string;
  fetchedAt: string;
  data?: {
    name?: string;
    manufacturer?: string;
    description?: string;
    categories?: string[];
    formats?: string[];
    platforms?: string[];
    website?: string;
    version?: string;
    prices?: Array<{ amount: number; currency: string }>;
    [key: string]: unknown;
  };
  error?: string;
  suggestions?: string[];
}

export interface ParseRequest {
  type: "software" | "hardware" | "manufacturer";
  data: Record<string, unknown>;
  existingManufacturers?: string[];
}

export interface ParseResult {
  success: boolean;
  parsedAt: string;
  yaml?: string;
  slug?: string;
  validationErrors?: string[];
  warnings?: string[];
  manufacturerStatus?: {
    exists: boolean;
    slug?: string;
    suggestion?: string;
  };
}

// =============================================================================
// CLIENT
// =============================================================================

function getConfig(): { url: string; apiKey: string } {
  const url = process.env.CRAWLER_API_URL;
  const apiKey = process.env.CRAWLER_API_KEY;

  if (!url) {
    throw new Error(
      "CRAWLER_API_URL environment variable is required. Add it as a repository secret."
    );
  }

  if (!apiKey) {
    throw new Error(
      "CRAWLER_API_KEY environment variable is required. Add it as a repository secret."
    );
  }

  return { url: url.replace(/\/$/, ""), apiKey };
}

async function apiRequest<T>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const { url, apiKey } = getConfig();

  const response = await fetch(`${url}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const statusText = response.statusText || "Unknown status";
    throw new Error(
      `API request failed with status ${response.status} ${statusText}`
    );
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * Crawl a URL to fetch product/manufacturer data
 */
export async function crawl(request: CrawlRequest): Promise<CrawlResult> {
  try {
    return await apiRequest<CrawlResult>("/crawl", request);
  } catch (error) {
    return {
      success: false,
      url: request.url,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse crawled data into structured YAML format
 */
export async function parse(request: ParseRequest): Promise<ParseResult> {
  try {
    return await apiRequest<ParseResult>("/parse", request);
  } catch (error) {
    return {
      success: false,
      parsedAt: new Date().toISOString(),
      validationErrors: [
        error instanceof Error ? error.message : "Unknown error",
      ],
    };
  }
}

/**
 * Enrich: crawl + parse in a single call
 */
export async function enrich(
  url: string,
  type: "software" | "hardware" | "manufacturer",
  existingManufacturers?: string[]
): Promise<{ crawl: CrawlResult; parse?: ParseResult }> {
  const crawlResult = await crawl({ url, type });

  if (!crawlResult.success || !crawlResult.data) {
    return { crawl: crawlResult };
  }

  const parseResult = await parse({
    type,
    data: crawlResult.data,
    existingManufacturers,
  });

  return {
    crawl: crawlResult,
    parse: parseResult,
  };
}

/**
 * Check if the crawler service is available
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const { url, apiKey } = getConfig();
    const response = await fetch(`${url}/health`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
