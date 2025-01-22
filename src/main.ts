import { relayEvmToXrpl } from "./evm_to_xrpl.ts";
import { runServer } from "./server.ts";
import { relayXrplToEvm } from "./xrpl_to_evm.ts";
import { bootstrap } from "./bootstrap.ts";
import dotenv from "dotenv";
dotenv.config();

export async function main() {
  const augmentedRelayerConfig = bootstrap();

  runServer({});
  relayEvmToXrpl({ relayerConfig: augmentedRelayerConfig });
  return await relayXrplToEvm({ relayerConfig: augmentedRelayerConfig });
}

main();
