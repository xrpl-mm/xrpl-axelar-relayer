import { relayerConfigSchema, AugmentedRelayerConfig } from "./relayer_config";
import { prepend0x } from "./utils";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

export function bootstrap() {
  const firstArg = process.argv[2];

  if (!firstArg) {
    throw new Error("Path to relayer config not provided");
  }

  const relayerConfigPath = firstArg;

  const EVM_SIDECHAIN_PRIVATE_KEY: string | undefined =
    process.env.EVM_SIDECHAIN_PRIVATE_KEY;

  if (!EVM_SIDECHAIN_PRIVATE_KEY) {
    throw new Error("EVM_SIDECHAIN_PRIVATE_KEY is not set");
  }

  const with0xEvmSidechainPrivateKey = prepend0x(EVM_SIDECHAIN_PRIVATE_KEY);

  const relayerConfig = JSON.parse(fs.readFileSync(relayerConfigPath, "utf-8"));
  const parsedRelayerConfig = relayerConfigSchema.parse(relayerConfig);
  const augmentedRelayerConfig = new AugmentedRelayerConfig({
    config: parsedRelayerConfig,
    evmSidechainPrivateKey: with0xEvmSidechainPrivateKey,
  });

  return augmentedRelayerConfig;
}
