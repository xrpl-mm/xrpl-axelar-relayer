import { Amount } from "xrpl";

export type RelayerConfig = {
  keyring_dir: string;
  its_gas_limit: number;
  token_ids: {
    xrp: string;
  };
  chains: {
    "xrpl-evm-sidechain": {
      chain_id: string;
      rpc: {
        http: string;
      };
      native_relaying_wallet_private_key: string;
      native_gateway_address: string;
      native_interchain_token_service_address: string;
      axelarnet_multisig_prover_address: string;
      token_contracts: {
        xrp: string;
      };
    };
    xrpl: {
      chain_id: string;
      rpc: {
        ws: string;
      };
      axelarnet_gateway_address: string;
      native_gateway_address: string;
    };
    axelarnet: {
      rpc: string;
      chain_id: string;
      axelarnet_gateway_address: string;
      axelarnet_interchain_token_service_address: string;
    };
  };
};

export type MessageFromXrpl = {
  tx_hash: string;
  source_address: string;
  destination_address: string;
  amount: Amount;
  payload_hash: string;
  payload: string;
};

export type PaymentToXRPLGateway = Omit<MessageFromXrpl, "payload">;

export type POSTPayloadRequest = {
  /**
   * Hex
   */
  payload: string;
};

// deno-lint-ignore no-explicit-any
export function isPOSTPayloadRequest(obj: any): obj is POSTPayloadRequest {
  return obj.payload !== undefined;
}
