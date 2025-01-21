import { relayEvmToXrpl } from "./evm_to_xrpl.ts";
import { runServer } from "./server.ts";
import { relayXrplToEvm } from "./xrpl_to_evm.ts";
import dotenv from "dotenv";

dotenv.config();

export async function main() {
  runServer();
  relayEvmToXrpl();
  return await relayXrplToEvm();
}

main();
