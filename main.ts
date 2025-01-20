import { server } from "./server.ts";
import { relayXrplToEvm } from "./xrpl_to_evm.ts";

export async function main() {
  Deno.serve({ port: 8001 }, server);

  return await relayXrplToEvm();
}

main();
