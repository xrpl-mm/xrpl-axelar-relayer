export type RelayerConfig = {
  keyring_dir: string;
  its_gas_limit: number;
  token_ids: {
    xrp: string;
  };
  chains: {
    "xrpl-evm-sidechain": {
      chain_id: string;
      rpc: string;
      gateway_address: string;
      interchain_token_service: string;
      multisig_prover: string;
    };
    xrpl: {
      chain_id: string;
      gateway: string;
      gateway_address: string;
    };
    axelarnet: {
      chain_id: string;
      gateway: string;
    };
  };
};
