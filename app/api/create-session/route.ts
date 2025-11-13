import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

interface CreateSessionRequestBody {
  workflow?: { id?: string | null } | null;
  scope?: { user_id?: string | null } | null;
  workflowId?: string | null;
  chatkit_configuration?: {
    file_upload?: {
      enabled?: boolean;
    };
  };
}

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const CLIENT_SECRET_COOKIE_NAME = "chatkit_client_secret";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type UpstreamJSON = {
  client_secret?: string;
  expires_after?: unknown;
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  // cookies que podríamos setear en la respuesta
  let sessionCookie: string | null = null;
  let clientSecretCookie: string | null = null;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY environment variable",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const parsedBody = await safeParseJson<CreateSessionRequestBody>(request);

    // 1) userId persistente
    const { userId, sessionCookie: resolvedSessionCookie } =
      await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;

    // 2) si ya tenemos client_secret en cookie, reutilizarlo (mantiene el hilo)
    const existingClientSecret = getCookieValue(
      request.headers.get("cookie"),
      CLIENT_SECRET_COOKIE_NAME
    );
    if (existingClientSecret) {
      return buildJsonResponse(
        { client_secret: existingClientSecret, reused: true },
        200,
        { "Content-Type": "application/json" },
        collectSetCookies([sessionCookie]) // sólo reenvía la de session si corresponde
      );
    }

    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    if (!resolvedWorkflowId) {
      return buildJsonResponse(
        { error: "Missing workflow id" },
        400,
        { "Content-Type": "application/json" },
        collectSetCookies([sessionCookie])
      );
    }

    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;
    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: resolvedWorkflowId },
        user: userId,
        chatkit_configuration: {
          file_upload: {
            enabled:
              parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
          },
        },
      }),
    });

    const upstreamJson = (await upstreamResponse
      .json()
      .catch(() => ({}))) as UpstreamJSON | undefined;

    if (!upstreamResponse.ok) {
      const upstreamError = extractUpstreamError(upstreamJson);
      console.error("OpenAI ChatKit session creation failed", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamJson,
      });
      return buildJsonResponse(
        {
          error:
            upstreamError ??
            `Failed to create session: ${upstreamResponse.statusText}`,
          details: upstreamJson,
        },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        collectSetCookies([sessionCookie])
      );
    }

    const clientSecret = upstreamJson?.client_secret ?? null;
    const expiresAfter = upstreamJson?.expires_after ?? null;

    if (clientSecret) {
      clientSecretCookie = serializeClientSecretCookie(clientSecret);
    }

    const responsePayload = {
      client_secret: clientSecret,
      expires_after: expiresAfter,
      reused: false,
    };

    return buildJsonResponse(
      responsePayload,
      200,
      { "Content-Type": "application/json" },
      collectSetCookies([sessionCookie, clientSecretCookie])
    );
  } catch (error: unknown) {
    // 👇 usar 'error' elimina el warning de variable sin uso
    console.error("Create session error", error);
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      collectSetCookies([sessionCookie, clientSecretCookie])
    );
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowedResponse();
}

function methodNotAllowedResponse(): Response {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

async function resolveUserId(request: Request): Promise<{
  userId: string;
  sessionCookie: string | null;
}> {
  const existing = getCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  );
  if (existing) {
    return { userId: existing, sessionCookie: null };
  }

  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return {
    userId: generated,
    sessionCookie: serializeSessionCookie(generated),
  };
}

function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (!rawName || rest.length === 0) continue;
    if (rawName.trim() === name) return rest.join("=").trim();
  }
  return null;
}

function serializeSessionCookie(value: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

function serializeClientSecretCookie(value: string): string {
  const attributes = [
    `${CLIENT_SECRET_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

/**
 * Recoge hasta dos valores de cookie serializados y devuelve un array para Set-Cookie
 */
function collectSetCookies(parts: Array<string | null>): string[] | null {
  const valid = parts.filter((p): p is string => Boolean(p));
  return valid.length ? valid : null;
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  setCookies: string[] | null
): Response {
  const responseHeaders = new Headers(headers);
  if (setCookies) {
    for (const c of setCookies) {
      responseHeaders.append("Set-Cookie", c);
    }
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
}

async function safeParseJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** type guards utilitarios */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function getStringProp(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  return typeof val === "string" ? val : null;
}

/**
 * Extrae mensaje de error de la respuesta aguas arriba (sin usar 'any')
 */
function extractUpstreamError(payload: UpstreamJSON | undefined): string | null {
  if (!payload) return null;

  // error como string directo
  if (typeof payload.error === "string") return payload.error;

  // error como objeto con "message"
  if (isRecord(payload.error)) {
    const msg = getStringProp(payload.error, "message");
    if (msg) return msg;
  }

  // details puede ser string
  if (typeof payload.details === "string") return payload.details;

  // details.error anidado
  if (isRecord(payload.details)) {
    const nested = payload.details["error"];
    if (typeof nested === "string") return nested;
    if (isRecord(nested)) {
      const msg = getStringProp(nested, "message");
      if (msg) return msg;
    }
  }

  // message suelto
  if (typeof payload.message === "string") return payload.message;

  return null;
}

/** extrae un mensaje de error útil desde el JSON de la API */
function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) return fallback;

  // error como string directo
  if (typeof payload.error === "string") return payload.error;

  // error como objeto con "message"
  if (isRecord(payload.error)) {
    const msg = getStringProp(payload.error, "message");
    if (msg) return msg;
  }

  // details como string
  if (typeof payload.details === "string") return payload.details;

  // details.error (string u objeto con message)
  if (isRecord(payload.details)) {
    const nested = (payload.details as Record<string, unknown>)["error"];
    if (typeof nested === "string") return nested;
    if (isRecord(nested)) {
      const msg = getStringProp(nested, "message");
      if (msg) return msg;
    }
  }

  // message suelto
  if (typeof payload.message === "string") return payload.message;

  return fallback;
}

