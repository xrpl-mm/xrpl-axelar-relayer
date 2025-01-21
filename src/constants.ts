import { JsonRpcProvider, Wallet } from "ethers";
import { RELAYER_CONFIG } from "../relayer_config.ts";
import { Client } from "xrpl";

export const EVM_SIDECHAIN_PROVIDER = new JsonRpcProvider(
  RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`rpc`][`http`],
);
export const EVM_SIDECHAIN_RELAYING_WALLET = new Wallet(
  RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][
    `native_relaying_wallet_private_key`
  ],
  EVM_SIDECHAIN_PROVIDER,
);
const client = new Client(RELAYER_CONFIG[`chains`][`xrpl`][`rpc`][`ws`]);
export const getXrplProvider = async () => {
  if (client.isConnected()) {
    return client;
  }

  try {
    await client.connect();
  } catch (e) {
    console.error(`Connecting to XRPL RPC failed: ${e}`);
    throw e;
  }
  return client;
};
