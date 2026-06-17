const DEV_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

function allowedOrigins(): string[] {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return [...DEV_ORIGINS, siteUrl].filter((value): value is string => Boolean(value));
}

export function mobileApiCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export function mobileApiOptionsResponse(request: Request) {
  return new Response(null, {
    status: 204,
    headers: mobileApiCorsHeaders(request),
  });
}

export function mobileApiJsonResponse(
  request: Request,
  body: unknown,
  init?: ResponseInit
) {
  return Response.json(body, {
    ...init,
    headers: {
      ...mobileApiCorsHeaders(request),
      ...(init?.headers ?? {}),
    },
  });
}
