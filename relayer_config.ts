import { RelayerConfig } from "./types.ts";
import { prepend0x } from "./utils.ts";

// const XRP_TOKEN_ID = `0xc2bb311dd03a93be4b74d3b4ab8612241c4dd1fd0232467c54a03b064f8583b6`;
// const EVM_SIDECHAIN = "xrpl-evm-sidechain";
// const XRPL = "xrpl";
// const AXELARNET = "axelarnet";
// const AXELARNET_GATEWAY = `axelar1yvfcrdke7fasxfaxx2r706h7h85rnk3w68cc5f4fkmafz5j755ssl8h9p0`;
// const INTERCHAIN_TOKEN_SERVICE = `axelar10jzzmv5m7da7dn2xsfac0yqe7zamy34uedx3e28laq0p6f3f8dzqp649fp`;
// const XRPL_GATEWAY = `axelar13w698a6pjytxj6jzprs6pznaxhan3flhf76fr0nc7jg3udcsa07q9c7da3`;
// const XRPL_AXELAR_GATEWAY = `rP9iHnCmJcVPtzCwYJjU1fryC2pEcVqDHv`;
// const EVM_SIDECHAIN_MULTISIG_PROVER = `axelar19pu8hfnwgc0vjhadmvmgz3w4d2g7d7qlg6jjky9y2mf8ea4vf4usj6ramg`;
// const EVM_SIDECHAIN_GATEWAY_ADDRESS = `0x48CF6E93C4C1b014F719Db2aeF049AA86A255fE2`;
// const EVM_SIDECHAIN_INTERCHAIN_TOKEN_SERVICE_ADDRESS = `0x43F2ccD4E27099b5F580895b44eAcC866e5F7Bb1`;
// const EVM_SIDECHAIN_RPC = `https://rpc.xrplevm.org`;
// const evmSideChainProvider = new providers.JsonRpcProvider(EVM_SIDECHAIN_RPC);
// const evmSidechainWallet = new Wallet(`0x${EVM_SIDECHAIN_PRIVATE_KEY}`, evmSideChainProvider);
// const ITS_GAS_LIMIT = 8000000;
const EVM_SIDECHAIN_PRIVATE_KEY = Deno.env.get("EVM_SIDECHAIN_PRIVATE_KEY");

if (!EVM_SIDECHAIN_PRIVATE_KEY) {
  throw new Error("EVM_SIDECHAIN_PRIVATE_KEY is not set");
}

const with0xEvmSidechainPrivateKey = prepend0x(EVM_SIDECHAIN_PRIVATE_KEY);

export const RELAYER_CONFIG: RelayerConfig = {
  "keyring_dir": "/Users/jm/Documents/Code/axelar-test/relayer/.axelar",
  "its_gas_limit": 8000000,
  "token_ids": {
    "xrp": "0xc2bb311dd03a93be4b74d3b4ab8612241c4dd1fd0232467c54a03b064f8583b6",
  },
  "chains": {
    "xrpl-evm-sidechain": {
      "chain_id": "xrpl-evm-sidechain",
      "rpc": {
        http: "https://rpc.xrplevm.org",
      },
      "native_relaying_wallet_private_key": with0xEvmSidechainPrivateKey,
      "native_gateway_address": "0x48CF6E93C4C1b014F719Db2aeF049AA86A255fE2",
      "native_interchain_token_service_address":
        "0x43F2ccD4E27099b5F580895b44eAcC866e5F7Bb1",
      "axelarnet_multisig_prover_address":
        "axelar19pu8hfnwgc0vjhadmvmgz3w4d2g7d7qlg6jjky9y2mf8ea4vf4usj6ramg",
    },
    "xrpl": {
      "chain_id": "xrpl",
      "rpc": {
        ws: "wss://s.devnet.rippletest.net:51233",
      },
      "axelarnet_gateway_address":
        "axelar13w698a6pjytxj6jzprs6pznaxhan3flhf76fr0nc7jg3udcsa07q9c7da3",
      "native_gateway_address": "rP9iHnCmJcVPtzCwYJjU1fryC2pEcVqDHv",
    },
    "axelarnet": {
      "rpc": "http://devnet-amplifier.axelar.dev:26657",
      "chain_id": "axelarnet",
      "axelarnet_gateway_address":
        "axelar1yvfcrdke7fasxfaxx2r706h7h85rnk3w68cc5f4fkmafz5j755ssl8h9p0",
      "axelarnet_interchain_token_service_address":
        "axelar10jzzmv5m7da7dn2xsfac0yqe7zamy34uedx3e28laq0p6f3f8dzqp649fp",
    },
  },
};
