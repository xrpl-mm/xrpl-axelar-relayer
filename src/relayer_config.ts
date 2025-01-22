import { JsonRpcProvider, Wallet } from "ethers";
import { Client } from "xrpl";
import { z } from "zod";

export const relayerConfigSchema = z.object({
  keyring_dir: z.string(),
  wallet_name: z.string(),
  environment: z.string(),
  its_gas_limit: z.number(),
  token_ids: z.object({
    xrp: z.string(),
    eth: z.string(),
  }),
  chains: z.object({
    "xrpl-evm-sidechain": z.object({
      chain_id: z.string(),
      rpc: z.object({
        http: z.string(),
      }),
      native_gateway_address: z.string(),
      native_interchain_token_service_address: z.string(),
      axelarnet_multisig_prover_address: z.string(),
      axelarnet_gateway_address: z.string(),
      token_contracts: z.object({
        xrp: z.string(),
        eth: z.string(),
      }),
    }),
    xrpl: z.object({
      chain_id: z.string(),
      rpc: z.object({
        ws: z.string(),
      }),
      axelarnet_gateway_address: z.string(),
      axelarnet_multisig_prover_address: z.string(),
      native_gateway_address: z.string(),
    }),
    axelarnet: z.object({
      rpc: z.string(),
      chain_id: z.string(),
      axelarnet_gateway_address: z.string(),
      axelarnet_interchain_token_service_address: z.string(),
    }),
  }),
});

export class AugmentedRelayerConfig {
  config: z.infer<typeof relayerConfigSchema>;
  evmSidechainProvider: JsonRpcProvider;
  evmSidechainRelayingWallet: Wallet;
  xrplClient: Client;

  constructor(args: {
    config: z.infer<typeof relayerConfigSchema>;
    evmSidechainPrivateKey: string;
  }) {
    this.config = args.config;

    this.evmSidechainProvider = new JsonRpcProvider(
      args.config[`chains`][`xrpl-evm-sidechain`][`rpc`][`http`],
    );
    this.evmSidechainRelayingWallet = new Wallet(
      args.evmSidechainPrivateKey,
      this.evmSidechainProvider,
    );

    this.xrplClient = new Client(args.config[`chains`][`xrpl`][`rpc`][`ws`]);
  }

  getXrplProvider = async () => {
    if (this.xrplClient.isConnected()) {
      return this.xrplClient;
    }

    try {
      await this.xrplClient.connect();
    } catch (e) {
      console.error(`Connecting to XRPL RPC failed: ${e}`);
      throw e;
    }
    return this.xrplClient;
  };
}
