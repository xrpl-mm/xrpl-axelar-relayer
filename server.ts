import { inMemoryCache } from "./in_memory_cache.ts";
import { isPOSTPayloadRequest } from "./types.ts";

export const server: Deno.ServeHandler<Deno.NetAddr> = async (req) => {
  console.log("Method:", req.method);

  if (req.method !== `POST`) {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  if (url.pathname !== `/payload-from-xrpl`) {
    return new Response("Not found", { status: 404 });
  }

  if (req.body) {
    const body = await req.json();

    if (isPOSTPayloadRequest(body)) {
      console.log("Payload received: ", body.payload);
      inMemoryCache.addPayloadFromXRPL(body.payload);

      return new Response("OK");
    }
  }

  return new Response("Bad Request", { status: 400 });
};
