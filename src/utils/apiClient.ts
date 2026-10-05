export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function resolveApiUrl(path: string): string {
  // Relative paths are routed cleanly to localhost server (or custom VITE_API_BASE_URL if set).
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Number of retry attempts on network error or server transient error. Default: 2 */
  retries?: number;
  /** Timeout in ms before the request is aborted. Default: 30000 */
  timeout?: number;
};

/**
 * Fetch wrapper for Localhost MIS:
 * - Automatic Authorization header injection from localStorage session
 * - JSON serialisation of request body
 * - Retry capability on transient connection hiccups
 * - Configurable timeout (default 30 s)
 * - Session expiry detection (401 → dispatches "cainta:session-expired")
 */
export async function apiRequest<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const resolvedUrl = resolveApiUrl(url);
  const cachedUser = localStorage.getItem("cainta_current_user");
  let user: any = null;
  if (cachedUser) {
    try {
      user = JSON.parse(cachedUser);
    } catch {
      localStorage.removeItem("cainta_current_user");
      user = null;
    }
  }

  const maxRetries = options.retries ?? 2;
  const timeoutMs  = options.timeout  ?? 30_000;

  // Build headers once — reuse across retries
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (user?.authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${user.authToken}`);
  }

  const serialisedBody =
    options.body === undefined ? undefined : JSON.stringify(options.body);

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(resolvedUrl, {
        ...options,
        headers,
        body: serialisedBody,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle transient server unavailable / busy states
      if (response.status === 503 && attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("cainta_current_user");
        window.dispatchEvent(new CustomEvent("cainta:session-expired"));
      }

      if (!response.ok || data.success === false) {
        throw new ApiError(
          data.message || "The request could not be completed.",
          response.status
        );
      }

      return data as T;
    } catch (err) {
      clearTimeout(timer);

      // Don't retry on intentional ApiError (bad request, 401, 403, 404, etc.)
      if (err instanceof ApiError) throw err;

      // Network error or abort — retry unless this was the last attempt
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }

  // All retries exhausted
  const isAbort = (lastError as any)?.name === "AbortError";
  throw new ApiError(
    isAbort
      ? "Request timed out. Please check that the local server is running and try again."
      : "Unable to reach the local server. Please check your connection and try again.",
    0
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
