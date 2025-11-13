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
const CLIENT_SECRET_COOKIE_NAME = "chatkit_client_secret"; // NEW
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }
  let sessionCookie: string | null = null;
  let clientSecretCookie: string | null = null; // NEW

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsedBody = await safeParseJson<CreateSessionRequestBody>(request);

    // 1) Resolver userId (persistente)
    const { userId, sessionCookie: resolvedSessionCookie } = await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;

    // 2) Reutilizar client_secret si ya existe (mantiene el hilo)  // NEW
    const existingClientSecret = getCookieValue(
      request.headers.get("cookie"),
      CLIENT_SECRET_COOKIE_NAME
    );
    if (existingClientSecret) {
      // Opcional: podrías validar expiración si la guardaras aparte
      return buildJsonResponse(
        { client_secret: existingClientSecret, reused: true },
        200,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    if (!resolvedWorkflowId) {
      return buildJsonResponse(
        { error: "Missing workflow id" },
        400,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;

    // 3) Crear sesión SOLO si no hay client_secret previo              // NEW
    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: resolvedWorkflowId },
        // Usa un userId estable; esto ayuda a identificar al usuario
        user: userId,
        // Si quieres, puedes pasar también 'scope' como parte del cuerpo:
        // scope: { user_id: userId }, // opcional
        chatkit_configuration: {
          file_upload: {
            enabled: parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
          },
        },
      }),
    });

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as
      | Record<string, unknown>
      | undefined;

    if (!upstreamResponse.ok) {
      const upstreamError = extractUpstreamError(upstreamJson);
      return buildJsonResponse(
        {
          error:
            upstreamError ?? `Failed to create session: ${upstreamResponse.statusText}`,
          details: upstreamJson,
        },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const clientSecret = (upstreamJson?.client_secret as string) ?? null;
    const expiresAfter = upstreamJson?.expires_after ?? null;

    // 4) Guardar cookie con el client_secret (para reutilizar)        // NEW
    clientSecretCookie = clientSecret
      ? serializeClientSecretCookie(clientSecret)
      : null;

    return buildJsonResponse(
      {
        client_secret: clientSecret,
        expires_after: expiresAfter,
        reused: false, // NEW (informativo)
      },
      200,
      { "Content-Type": "application/json" },
      // Pasa ambas cookies si corresponden
      mergeSetCookieHeaders(sessionCookie, clientSecretCookie) // NEW
    );
  } catch (error) {
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      mergeSetCookieHeaders(sessionCookie, clientSecretCookie) // NEW
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
  const existing = getCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
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

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
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

// NEW: cookie para el client_secret
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

// NEW: util para combinar Set-Cookie (cuando haya 1 o 2 cookies)
function mergeSetCookieHeaders(
  sessionCookie: string | null,
  clientSecretCookie: string | null
): string | null {
  if (sessionCookie && clientSecretCookie) {
    // Cuando devuelvas la Response, agrega ambas con 'append'.
    // Aquí devolvemos una cadena separada por coma para reutilizar tu buildJsonResponse.
    return `${sessionCookie}, ${clientSecretCookie}`;
  }
  return sessionCookie ?? clientSecretCookie;
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  setCookieHeader: string | null // UPDATED
): Response {
  const responseHeaders = new Headers(headers);
  if (setCookieHeader) {
    // Si quieres ser estricto, usa 2x append cuando haya coma:
    const parts = setCookieHeader.split(", ");
    for (const p of parts) {
      responseHeaders.append("Set-Cookie", p);
    }
  }
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
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

function extractUpstreamError(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  const error = payload.error;
  if (typeof error === "string") return error;

  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }

  const details = payload.details;
  if (typeof details === "string") return details;

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as any).error;
    if (typeof nestedError === "string") return nestedError;
    if (nestedError && typeof nestedError === "object" && "message" in nestedError && typeof (nestedError as any).message === "string") {
      return (nestedError as any).message;
    }
  }

  if (typeof payload.message === "string") return payload.message;
  return null;
}
