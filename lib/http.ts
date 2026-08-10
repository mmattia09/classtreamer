/**
 * Redirect back to a path on whatever host the request came in on.
 *
 * These endpoints are targets of plain <form method="post">, so the browser
 * follows the response. They used to build an absolute URL from PUBLIC_URL,
 * which sends the browser to a different origin whenever the app is reached by
 * another name — the machine's IP, 127.0.0.1 instead of localhost, a staging
 * hostname. The session cookie does not travel to that other origin, so the
 * admin lands on the login page, in the middle of a live assembly.
 *
 * A relative Location keeps the browser exactly where it is. RFC 7231 allows a
 * relative reference and every browser resolves it. It also avoids deriving the
 * origin from the Host header, which is client-controlled and would turn these
 * into open redirects behind a misconfigured proxy.
 */
export function redirectToPath(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}
