export async function onRequest({ request }: { request: Request }) {
  const { pathname } = new URL(request.url);

  if (pathname === "/ping") {
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Not Found", { status: 404 });
}
