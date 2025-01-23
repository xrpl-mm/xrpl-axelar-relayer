import { Amount } from "xrpl";
import { AugmentedRelayerConfig } from "./relayer_config";

export type RelayerConfig = {
  keyring_dir: string;
  wallet_name: string;
  its_gas_limit: number;
  environment: string;
  token_ids: {
    xrp: string;
    eth: string;
  };
  chains: {
    "xrpl-evm-sidechain": {
      chain_id: string;
      rpc: {
        http: string;
      };
      native_gateway_address: string;
      native_interchain_token_service_address: string;
      axelarnet_multisig_prover_address: string;
      axelarnet_gateway_address: string;
      token_contracts: {
        xrp: string;
        eth: string;
      };
    };
    xrpl: {
      chain_id: string;
      rpc: {
        ws: string;
      };
      axelarnet_gateway_address: string;
      axelarnet_multisig_prover_address: string;
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
export function isPOSTPayloadRequest(obj: any): obj is POSTPayloadRequest {
  return obj.payload !== undefined;
}

export type RouteITSHubMessageOutput = {
  txhash: string;
  code: 0 | number;
};

export function isRouteITSMessageOutput(
  output: any
): output is RouteITSHubMessageOutput {
  return (
    output.txhash !== undefined &&
    output.code !== undefined &&
    typeof output.txhash === "string" &&
    typeof output.code === "number"
  );
}

export type EventAttribute = {
  key: string;
  value: string;
};

export type LoggedEvent = {
  type: string;
  attributes: Array<EventAttribute>;
};

export type UnfurledEvent = {
  sourceChain: string;
  sourceAddress: string;
  messageId: string;
  payload: string;
  payloadHash: string;
  destinationChain: string;
  destinationAddress: string;
};

export type AxelarExecuteCommandOutput = {
  logs: {
    events: Array<LoggedEvent>;
  }[];
};

type GetProofSuccessOutputForRelayToEVM = {
  data: {
    status: {
      completed: {
        // hex string without preceding 0x
        execute_data: string;
      };
    };
  };
};

// {"data":{"status":"completed","unsigned_tx_hash":"228b7c84176536ed36fe5a636dfcabf1a91a930052afba16eee45def4f8c722c","tx_blob":"120000220000000024000000002029006a072e61d4838d7ea4c68000000000000000000000000000455448000000000053e8ecb19c39ed8cfecc1b2729d2d6305bb1de10684000000000000bb873008114b51a21de7d16f27e32975dd76bacb7e678b75a368314928846baf59bd48c28b131855472d04c93bbd0b7f3e01073210226bb43b7e6a6ebd4a07c852bb2f054b32a53286f4465ff1cf9c0d56efb1fe11374473045022100ebd2ceca2e520bec6a95b9a8e1c4a2a94babc162403dc7018515fbcee2b3786802205753222813d6cac50da00bd928a6867ea62bb94aa2a8a5c60628b656e3ace56d811459599907c56ea92593f696d6b279264c5f80709de1f1f9ea7c136d756c74697369675f73657373696f6e5f69647d0154e1f1"}}
type GetProofSuccessOutputForRelayToXRPL = {
  data: {
    status: "completed" | string;
    // hex string without preceding 0x
    unsigned_tx_hash: string;
    // hex string without preceding 0x
    tx_blob: string;
  };
};

export function isAxelarExecuteCommandOutput(
  output: any
): output is AxelarExecuteCommandOutput {
  return output.logs !== undefined && Array.isArray(output.logs);
}

export function isGetProofSuccessOutputForRelayToEVM(
  output: any
): output is GetProofSuccessOutputForRelayToEVM {
  return (
    output.data !== undefined &&
    output.data.status !== undefined &&
    output.data.status.completed !== undefined &&
    output.data.status.completed.execute_data !== undefined &&
    typeof output.data.status.completed.execute_data === "string"
  );
}

export function isGetProofSuccessOutputForRelayToXRPL(
  output: any
): output is GetProofSuccessOutputForRelayToXRPL {
  return (
    output.data !== undefined &&
    output.data.status !== undefined &&
    output.data.status === "completed" &&
    output.data.unsigned_tx_hash !== undefined &&
    output.data.tx_blob !== undefined &&
    typeof output.data.unsigned_tx_hash === "string" &&
    typeof output.data.tx_blob === "string"
  );
}

export type WithRelayerConfig<T = {}> = {
  relayerConfig: AugmentedRelayerConfig;
} & T;
