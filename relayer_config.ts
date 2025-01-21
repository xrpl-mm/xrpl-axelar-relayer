import { RelayerConfig } from "./types.ts";
import { prepend0x } from "./utils.ts";
import dotenv from "dotenv";

dotenv.config();

const EVM_SIDECHAIN_PRIVATE_KEY: string | undefined =
  process.env.EVM_SIDECHAIN_PRIVATE_KEY;

if (!EVM_SIDECHAIN_PRIVATE_KEY) {
  throw new Error("EVM_SIDECHAIN_PRIVATE_KEY is not set");
}

const with0xEvmSidechainPrivateKey = prepend0x(EVM_SIDECHAIN_PRIVATE_KEY);

export const RELAYER_CONFIG: RelayerConfig = {
  keyring_dir: "/Users/jm/Documents/Code/xrpl-mm/xrpl-axelar-relayer/.axelar",
  its_gas_limit: 8000000,
  token_ids: {
    xrp: "0xc2bb311dd03a93be4b74d3b4ab8612241c4dd1fd0232467c54a03b064f8583b6",
  },
  chains: {
    "xrpl-evm-sidechain": {
      chain_id: "xrpl-evm-sidechain",
      rpc: {
        http: "https://rpc.xrplevm.org",
      },
      native_relaying_wallet_private_key: with0xEvmSidechainPrivateKey,
      native_gateway_address: "0x48CF6E93C4C1b014F719Db2aeF049AA86A255fE2",
      native_interchain_token_service_address:
        "0x43F2ccD4E27099b5F580895b44eAcC866e5F7Bb1",
      axelarnet_multisig_prover_address:
        "axelar19pu8hfnwgc0vjhadmvmgz3w4d2g7d7qlg6jjky9y2mf8ea4vf4usj6ramg",
      axelarnet_gateway_address: `axelar1cvc5u0z9fm6n5gcur3xqz4gmxj4j96vr6j5a099ygjedfpcmh5zqepykg4`,
      token_contracts: {
        xrp: `0xD4949664cD82660AaE99bEdc034a0deA8A0bd517`,
      },
    },
    xrpl: {
      chain_id: "xrpl",
      rpc: {
        ws: "wss://s.devnet.rippletest.net:51233",
      },
      axelarnet_gateway_address:
        "axelar13w698a6pjytxj6jzprs6pznaxhan3flhf76fr0nc7jg3udcsa07q9c7da3",
      native_gateway_address: "rP9iHnCmJcVPtzCwYJjU1fryC2pEcVqDHv",
    },
    axelarnet: {
      rpc: "http://devnet-amplifier.axelar.dev:26657",
      chain_id: "axelarnet",
      axelarnet_gateway_address:
        "axelar1yvfcrdke7fasxfaxx2r706h7h85rnk3w68cc5f4fkmafz5j755ssl8h9p0",
      axelarnet_interchain_token_service_address:
        "axelar10jzzmv5m7da7dn2xsfac0yqe7zamy34uedx3e28laq0p6f3f8dzqp649fp",
    },
  },
};
