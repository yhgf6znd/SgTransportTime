export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data, meta = {}, status = 200) {
  return new Response(JSON.stringify({ success: true, data, meta }), { status, headers: baseHeaders });
}

export function errorResponse(error) {
  const known = error instanceof ProviderError;
  const status = known ? error.status : 502;
  const code = known ? error.code : 'UPSTREAM_ERROR';
  const message = known ? error.message : 'The transport provider is temporarily unavailable.';
  return new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: baseHeaders });
}

export function run(handler) {
  return async (context) => {
    try { return await handler(context); } catch (error) { return errorResponse(error); }
  };
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw new ProviderError('UPSTREAM_TIMEOUT', 'The transport provider did not respond in time.', 504);
    throw new ProviderError('UPSTREAM_UNAVAILABLE', 'The transport provider is temporarily unavailable.', 502);
  } finally { clearTimeout(timeout); }
}

export async function readJson(response, options = {}) {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(options.authCode ?? 'UPSTREAM_AUTH', options.authMessage ?? 'The transport provider rejected the configured credentials.', options.authStatus ?? 502);
    }
    if (response.status === 429) throw new ProviderError('UPSTREAM_RATE_LIMIT', 'The transport provider rate limit was reached. Try again shortly.', 429);
    throw new ProviderError('UPSTREAM_ERROR', 'The transport provider returned an error.', 502);
  }
  let body;
  try { body = await response.json(); } catch { throw new ProviderError('UPSTREAM_INVALID', 'The transport provider returned an invalid response.', 502); }
  return body;
}

export function queryLength(value, min, max) {
  const normalized = String(value ?? '').trim();
  if (normalized.length < min || normalized.length > max) throw new ProviderError('INVALID_INPUT', `Search must be between ${min} and ${max} characters.`, 400);
  return normalized;
}
