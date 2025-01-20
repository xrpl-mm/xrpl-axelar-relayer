import { RelayerConfig } from "./types.ts";

export const Config: RelayerConfig = {
  "keyring_dir": "/Users/jm/Documents/Code/axelar-test/relayer/.axelar",
  "its_gas_limit": 8000000,
  "token_ids": {
    "xrp": "0xc2bb311dd03a93be4b74d3b4ab8612241c4dd1fd0232467c54a03b064f8583b6",
  },
  "chains": {
    "xrpl-evm-sidechain": {
      "chain_id": "xrpl-evm-sidechain",
      "rpc": "https://rpc.xrplevm.org",
      "gateway_address": "0x48CF6E93C4C1b014F719Db2aeF049AA86A255fE2",
      "interchain_token_service": "0x43F2ccD4E27099b5F580895b44eAcC866e5F7Bb1",
      "multisig_prover":
        "axelar19pu8hfnwgc0vjhadmvmgz3w4d2g7d7qlg6jjky9y2mf8ea4vf4usj6ramg",
    },
    "xrpl": {
      "chain_id": "xrpl",
      "gateway":
        "axelar13w698a6pjytxj6jzprs6pznaxhan3flhf76fr0nc7jg3udcsa07q9c7da3",
      "gateway_address": "rP9iHnCmJcVPtzCwYJjU1fryC2pEcVqDHv",
    },
    "axelarnet": {
      "chain_id": "axelarnet",
      "gateway":
        "axelar1yvfcrdke7fasxfaxx2r706h7h85rnk3w68cc5f4fkmafz5j755ssl8h9p0",
    },
  },
};
