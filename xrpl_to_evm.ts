import { Buffer } from "buffer";
import { Contract, ethers, id } from "ethers";
import { uint8ArrToHex, xrplAccountToEvmAddress } from "./utils.ts";
import { RELAYER_CONFIG } from "./relayer_config.ts";
import { execSync } from "child_process";
import { dropsToXrp, SubscribeRequest, TransactionStream } from "xrpl";
import IAxelarExecutable from "./IAxelarExecutable.abi.json";
import { EVM_SIDECHAIN_RELAYING_WALLET, getXrplProvider } from "./constants.ts";
import { MessageFromXrpl, PaymentToXRPLGateway } from "./types.ts";
import { inMemoryCache } from "./in_memory_cache.ts";
import stringify from "safe-stable-stringify";

type SerializedUserMessage = {
  tx_id: number[];
  source_address: number[];
  destination_chain: string;
  destination_address: string;
  amount: {
    drops: number;
  };
  payload_hash: string;
};

type RouteITSHubMessageOutput = {
  txhash: string;
  code: 0 | number;
};

type EventAttribute = {
  key: string;
  value: string;
};

type LoggedEvent = {
  type: string;
  attributes: Array<EventAttribute>;
};

type UnfurledEvent = {
  sourceChain: string;
  sourceAddress: string;
  messageId: string;
  payload: string;
  payloadHash: string;
  destinationChain: string;
  destinationAddress: string;
};

type AxelarExecuteCommandOutput = {
  logs: {
    events: Array<LoggedEvent>;
  }[];
};

type GetProofSuccessOutput = {
  data: {
    status: {
      completed: {
        // hex string without preceding 0x
        execute_data: string;
      };
    };
  };
};

function isRouteITSMessageOutput(
  // deno-lint-ignore no-explicit-any
  output: any,
): output is RouteITSHubMessageOutput {
  return (
    output.txhash !== undefined &&
    output.code !== undefined &&
    typeof output.txhash === "string" &&
    typeof output.code === "number"
  );
}

function isAxelarExecuteCommandOutput(
  // deno-lint-ignore no-explicit-any
  output: any,
): output is AxelarExecuteCommandOutput {
  return output.logs !== undefined && Array.isArray(output.logs);
}

// deno-lint-ignore no-explicit-any
function isGetProofSuccessOutput(output: any): output is GetProofSuccessOutput {
  return (
    output.data !== undefined &&
    output.data.status !== undefined &&
    output.data.status.completed !== undefined &&
    output.data.status.completed.execute_data !== undefined &&
    typeof output.data.status.completed.execute_data === "string"
  );
}

function unfurlEvent(event: LoggedEvent): UnfurledEvent {
  const unfurled: UnfurledEvent = {
    sourceChain: "",
    sourceAddress: "",
    messageId: "",
    payload: "",
    payloadHash: "",
    destinationChain: "",
    destinationAddress: "",
  };

  for (const attr of event.attributes) {
    switch (attr.key) {
      case "destination_address":
        unfurled.destinationAddress = attr.value;
        break;
      case "destination_chain":
        unfurled.destinationChain = attr.value;
        break;
      case "message_id":
        unfurled.messageId = attr.value;
        break;
      case "payload":
        unfurled.payload = attr.value;
        break;
      case "payload_hash":
        unfurled.payloadHash = attr.value;
        break;
      case "source_address":
        unfurled.sourceAddress = attr.value;
        break;
      case "source_chain":
        unfurled.sourceChain = attr.value;
        break;
    }
  }

  // Check if any of the fields are empty
  for (const [key, value] of Object.entries(unfurled)) {
    if (value === "") {
      throw new Error(`Unfurled event is missing field: ${key}`);
    }
  }

  return unfurled;
}

const startSubscribeToXrplGateway = async (): Promise<void> => {
  const xrplProvider = await getXrplProvider();
  const subscribeRequest: SubscribeRequest = {
    id: `subscribe-to-xrpl-gateway`,
    command: "subscribe",
    accounts: [RELAYER_CONFIG[`chains`][`xrpl`][`native_gateway_address`]],
  };
  const subscribeResponse = await xrplProvider.request(subscribeRequest);
  if (subscribeResponse.id === "subscribe-to-xrpl-gateway") {
    console.log("Successfully subscribed!");
  } else {
    console.error("Error subscribing: ", subscribeResponse);
  }
};

// Prepare the verify_messages JSON
const prepareVerifyMessages = (message: MessageFromXrpl) => {
  const tx_id = Array.from(new Uint8Array(Buffer.from(message.tx_hash, "hex")));
  const sourceAddressHex = xrplAccountToEvmAddress(
    message.source_address,
  ).slice(2);
  const source_address = Array.from(
    new Uint8Array(Buffer.from(sourceAddressHex, "hex")),
  );
  const user_message = {
    tx_id: tx_id,
    source_address: source_address,
    destination_chain:
      RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
    destination_address: message.destination_address,
    amount: { drops: Number(message.amount) },
    payload_hash: message.payload_hash,
  };
  const verifyMessages = {
    verify_messages: [
      {
        user_message,
      },
    ],
  };
  return {
    str: stringify(verifyMessages),
    user_message,
    payloadHex: message.payload,
  };
};

// Execute axelard command
const verifyMessage = async (message: MessageFromXrpl) => {
  const {
    str: verifyMessagesJson,
    user_message,
    payloadHex,
  } = prepareVerifyMessages(message);

  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG["chains"]["xrpl"]["axelarnet_gateway_address"]
  } '${verifyMessagesJson}' --keyring-backend test --from wallet --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  while (true) {
    try {
      console.log("Executing command:", command);
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

      console.log({ output });

      if (output.includes("wasm-already_verified")) {
        console.log("Verification completed.");
        break;
      } else if (output.includes("wasm-already_rejected")) {
        throw new Error("Verification rejected.");
      } else {
        console.log("Waiting for verification to complete...");
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for verification to complete...`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return { user_message, payloadHex };
};

const routeMessage = async ({
  // without 0x
  payloadHex,
  serializedUserMessage,
}: {
  payloadHex: string;
  serializedUserMessage: SerializedUserMessage;
}) => {
  const routeMessageCall = {
    route_incoming_messages: [
      {
        payload: payloadHex,
        message: {
          user_message: serializedUserMessage,
        },
      },
    ],
  };

  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG["chains"]["xrpl"]["axelarnet_gateway_address"]
  } '${stringify(
    routeMessageCall,
  )}' --keyring-backend test --from wallet --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  while (true) {
    try {
      console.log("Executing command:", command);
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

      if (output.includes("wasm-message_routed")) {
        console.log("Verification completed.");
        break;
      } else {
        console.log(`output: ${output}`);
        console.log("Waiting for routing to complete...");
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for routing to complete...`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("Routing completed.");
};

const executeItsHubMessage = async ({
  user_message,
  payloadHex,
}: {
  user_message: SerializedUserMessage;
  payloadHex: string;
}) => {
  const interchainTransfer = {
    messageType: 0,
    // Only XRP transfer is supported for now
    tokenId: RELAYER_CONFIG[`token_ids`][`xrp`],
    sourceAddress: `0x${uint8ArrToHex(user_message.source_address)}`,
    destinationAddress: `0x${user_message.destination_address}`,
    amount: ethers.parseUnits(dropsToXrp(user_message.amount.drops).toString()),
    data: `0x${payloadHex}`,
  };

  console.log({
    interchainTransfer: stringify(interchainTransfer, null, 2),
  });

  const abiCoder = new ethers.AbiCoder();

  const messageEncoded = abiCoder.encode(
    ["uint256", "bytes32", "bytes", "bytes", "uint256", "bytes"],
    [
      interchainTransfer.messageType,
      interchainTransfer.tokenId,
      interchainTransfer.sourceAddress,
      interchainTransfer.destinationAddress,
      interchainTransfer.amount,
      interchainTransfer.data,
    ],
  );

  const hubMessage = abiCoder.encode(
    ["uint256", "string", "bytes"],
    [
      3n,
      RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
      messageEncoded,
    ],
  );

  const txIdHex = uint8ArrToHex(user_message.tx_id);
  const messageId = `0x${txIdHex.toLowerCase()}-0`;

  const contractCall = {
    execute: {
      cc_id: {
        source_chain: RELAYER_CONFIG[`chains`][`xrpl`][`chain_id`],
        message_id: messageId,
      },
      payload: hubMessage.slice(2),
    },
  };

  console.log({ contractCall: stringify(contractCall, null, 2) });

  let loggedEvent: LoggedEvent | null = null;
  while (true) {
    try {
      const output = execSync(
        `axelard tx wasm execute ${
          RELAYER_CONFIG[`chains`][`axelarnet`][`axelarnet_gateway_address`]
        } '${stringify(
          contractCall,
        )}' --keyring-backend test --from wallet --keyring-dir ${
          RELAYER_CONFIG["keyring_dir"]
        } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
          RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
        }`,
        {
          env: {
            ...process.env,
            AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
          },
        },
      ).toString();

      const parsed = JSON.parse(output);

      if (
        output.includes("wasm-contract_called") &&
        isAxelarExecuteCommandOutput(parsed)
      ) {
        if (parsed.logs.length === 0) {
          console.log(`Empty logs after executing ITS Hub Message.`);
          continue;
        } else {
          const [firstLog] = parsed.logs;
          if (firstLog.events.length === 0) {
            console.log(`Empty events after executing ITS Hub Message.`);
            continue;
          } else {
            const contractCalledEvent = firstLog.events.find(
              ({ type }) => type === "wasm-contract_called",
            )!;

            loggedEvent = contractCalledEvent;
          }
        }
        console.log("ITS Hub message executed.");
        break;
      } else {
        console.log("Waiting for ITS Hub message to be executed...");
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for ITS Hub message to be executed`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const unfurled = unfurlEvent(loggedEvent!);

  console.log({ unfurled: stringify(unfurled, null, 2) });

  return { user_message, payloadHex, messageId, loggedEvent: unfurled };
};

const routeITSHubMessage = async ({
  messageId,
  payloadHash,
}: {
  messageId: string;
  payloadHash: string;
}) => {
  const routeMessages = {
    route_messages: [
      {
        cc_id: {
          source_chain: RELAYER_CONFIG[`chains`][`xrpl`][`chain_id`],
          message_id: messageId,
        },
        destination_chain: RELAYER_CONFIG[`chains`][`axelarnet`][`chain_id`],
        destination_address:
          RELAYER_CONFIG[`chains`][`axelarnet`][
            `axelarnet_interchain_token_service_address`
          ],
        source_address:
          RELAYER_CONFIG[`chains`][`xrpl`][`native_gateway_address`],
        payload_hash: payloadHash,
      },
    ],
  };

  console.log({ routeMessages: stringify(routeMessages, null, 2) });

  while (true) {
    try {
      const output = execSync(
        `axelard tx wasm execute ${
          RELAYER_CONFIG[`chains`][`axelarnet`][`axelarnet_gateway_address`]
        } '${stringify(
          routeMessages,
        )}' --keyring-backend test --from wallet --keyring-dir ${
          RELAYER_CONFIG["keyring_dir"]
        } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
          RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
        }`,
        {
          env: {
            ...process.env,
            AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
          },
        },
      ).toString();

      const parsed = JSON.parse(output);

      console.log(parsed);

      if (isRouteITSMessageOutput(parsed)) {
        if (parsed.code === 0) {
          console.log(
            `ITS Hub message route request submitted: ${parsed.txhash}`,
          );
          break;
        } else {
          console.log(
            `Error: ITS Hub message routing failed (code is not 0): ${stringify(
              parsed,
              null,
              2,
            )}`,
          );
        }
      } else {
        console.log(
          `Error: parsed output is not a RouteITSMessageOutput: ${stringify(
            parsed,
            null,
            2,
          )}`,
        );
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for ITS Hub message to be routed`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

const constructTransferProof = async ({ messageId }: { messageId: string }) => {
  const constructProofCall = {
    construct_proof: [
      {
        source_chain: RELAYER_CONFIG[`chains`][`axelarnet`][`chain_id`],
        message_id: messageId,
      },
    ],
  };

  let loggedEvent: LoggedEvent | null = null;
  while (true) {
    try {
      const output = execSync(
        `axelard tx wasm execute ${
          RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][
            `axelarnet_multisig_prover_address`
          ]
        } '${stringify(
          constructProofCall,
        )}' --keyring-backend test --from wallet --keyring-dir ${
          RELAYER_CONFIG["keyring_dir"]
        } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
          RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
        }`,
        {
          env: {
            ...process.env,
            AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
          },
        },
      ).toString();

      const parsed = JSON.parse(output);
      console.log({ output: stringify(parsed, null, 2) });

      if (
        output.includes("wasm-proof_under_construction") &&
        isAxelarExecuteCommandOutput(parsed)
      ) {
        if (parsed.logs.length === 0) {
          console.log(`Empty logs after executing ITS Hub Message.`);
          continue;
        } else {
          const [firstLog] = parsed.logs;
          if (firstLog.events.length === 0) {
            console.log(`Empty events after executing ITS Hub Message.`);
            continue;
          } else {
            const contractCalledEvent = firstLog.events.find(
              ({ type }) => type === "wasm-proof_under_construction",
            )!;

            loggedEvent = contractCalledEvent;
          }
        }
        break;
      } else {
        console.log("Waiting for transfer proof to be constructed...");
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for transfer proof to be constructed...`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const multisigSessionIdAttribute = loggedEvent!.attributes.find(
    ({ key }) => key === "multisig_session_id",
  );

  if (multisigSessionIdAttribute === undefined) {
    throw new Error(
      `Multisig session ID attribute not found in proof under construction event`,
    );
  }

  const multisigSessionId = multisigSessionIdAttribute.value;

  console.log(`Multisig session ID: ${multisigSessionId}`);

  // The string is wrapped in quotes
  return { multisigSessionId: JSON.parse(multisigSessionId) };
};

const getProof = async ({
  multisigSessionId,
}: {
  multisigSessionId: string;
}) => {
  const getProofCall = {
    proof: {
      multisig_session_id: multisigSessionId,
    },
  };

  while (true) {
    try {
      const output = execSync(
        `axelard q wasm contract-state smart ${
          RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][
            `axelarnet_multisig_prover_address`
          ]
        } '${stringify(getProofCall)}' --output json --node ${
          RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
        }`,
        {
          env: {
            ...process.env,
            AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
          },
        },
      ).toString();

      const parsed = JSON.parse(output);
      console.log({ output: stringify(parsed, null, 2) });

      if (isGetProofSuccessOutput(parsed)) {
        console.log(
          `Proof constructed. Execute data: ${parsed.data.status.completed.execute_data}`,
        );

        return {
          executeData: parsed.data.status.completed.execute_data,
        };
      } else {
        console.log("Waiting for getProof call...");
      }
    } catch (e) {
      const error = e as Error;
      console.log(`Error: ${error.message}. Waiting for getProof call...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

export const sendExecuteDataToGateway = async ({
  gatewayAddress,
  executeData,
}: {
  gatewayAddress: string;
  executeData: string;
}) => {
  console.log(`Sending execute data to gateway: ${gatewayAddress}...`);

  const tx = await EVM_SIDECHAIN_RELAYING_WALLET.sendTransaction({
    from: EVM_SIDECHAIN_RELAYING_WALLET.address,
    to: gatewayAddress,
    data: `0x${executeData}`,
    value: "0",
  });
  const result = await tx.wait();

  if (!result) {
    throw new Error(
      `Failed to send execute data to gateway: ${gatewayAddress}`,
    );
  }

  console.log(`Sent execute data to gateway: ${gatewayAddress}.`);
  console.log(result.toJSON());
};

export const executeITSTransfer = async ({
  sourceChain,
  messageId,
  sourceAddress,
  payload,
}: {
  sourceChain: string;
  messageId: string;
  sourceAddress: string;
  payload: string;
}) => {
  console.log(`Executing ITS transfer on interchain token service...`);
  const commandId = id(`${sourceChain}_${messageId}`);
  const interchainTokenService = new Contract(
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][
      `native_interchain_token_service_address`
    ],
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    IAxelarExecutable,
    EVM_SIDECHAIN_RELAYING_WALLET,
  );
  console.log({
    commandId,
    sourceChain,
    messageId,
    sourceAddress,
    payload,
  });
  const tx = await interchainTokenService.execute(
    commandId,
    RELAYER_CONFIG[`chains`][`axelarnet`][`chain_id`],
    sourceAddress,
    payload,
    {
      gasLimit: RELAYER_CONFIG[`its_gas_limit`],
    },
  );
  const result: ethers.TransactionReceipt | null = await tx.wait();

  if (!result) {
    throw new Error(
      `Failed to execute ITS transfer on interchain token service.`,
    );
  }

  console.log(
    `Executed ITS transfer on interchain token service. Transaction: ${stringify(
      result.toJSON(),
      null,
      2,
    )}`,
  );
};

const parseTx = (tx: TransactionStream) => {
  if (!tx.tx_json) {
    console.log(`Transaction does not have tx_json`);
    return;
  }
  if (tx.tx_json.TransactionType !== `Payment`) {
    console.log(`Transaction is not a payment`);
    return;
  }
  if (!tx.tx_json.Memos || tx.tx_json.Memos.length === 0) {
    console.log(`Payment does not have memos`);
    return;
  }

  const memoKeys = {
    destinationAddress: Buffer.from("destination_address")
      .toString("hex")
      .toUpperCase(),
    destinationChain: Buffer.from("destination_chain")
      .toString("hex")
      .toUpperCase(),
    payloadHash: Buffer.from("payload_hash").toString("hex").toUpperCase(),
  };
  const parsedMemo = {
    destinationAddress: "",
    destinationChain: "",
    payloadHash: "",
  };

  // tx.tx_json.Memos looks like this:
  // {
  //   "Memo": {
  //     "MemoData": "8E03C54DD97FA469D0A4F7A15CBC5DDD2EE5E5C5",
  //     "MemoType": "64657374696E6174696F6E5F61646472657373"
  //   }
  // },
  // {
  //   "Memo": {
  //     "MemoData": "7872706C2D65766D2D73696465636861696E",
  //     "MemoType": "64657374696E6174696F6E5F636861696E"
  //   }
  // },
  // {
  //   "Memo": {
  //     "MemoData": "B036C6E7F6437EB7E1206EE44DA1D1F57CAEB7B1045770907F28C44713D42786",
  //     "MemoType": "7061796C6F61645F68617368"
  //   }
  // }
  for (const memo of tx.tx_json.Memos) {
    if (!memo.Memo || !memo.Memo.MemoData || !memo.Memo.MemoType) {
      console.log(`Memo does not have MemoData`);
      continue;
    }
    switch (memo.Memo.MemoType.toUpperCase()) {
      case memoKeys.destinationAddress:
        parsedMemo.destinationAddress = memo.Memo.MemoData;
        break;
      case memoKeys.destinationChain:
        parsedMemo.destinationChain = memo.Memo.MemoData;
        break;
      case memoKeys.payloadHash:
        parsedMemo.payloadHash = memo.Memo.MemoData;
        break;
      default:
        console.log(
          `Unknown memo: ${memo.Memo.MemoType}=${memo.Memo.MemoData}`,
        );
    }
  }

  const missingMemos = Object.entries(parsedMemo).filter(
    ([, value]) => value === "",
  );

  if (missingMemos.length > 0) {
    console.log(`Missing memos: ${stringify(missingMemos, null, 2)}`);
    return;
  }

  const sourceAddress = tx.tx_json.Account;
  console.log(`New payment from ${sourceAddress}`);
  // this field exists
  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  const txHash = tx.hash as string;

  console.log(stringify(tx));

  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  const amount = tx.tx_json.DeliverMax as typeof tx.tx_json.Amount;
  if (typeof amount !== `string` && `mpt_issuance_id` in amount) {
    console.log(`MPTAmount is not supported`);
    return;
  }

  const paymentToXRPLGateway: PaymentToXRPLGateway = {
    tx_hash: txHash,
    source_address: sourceAddress,
    destination_address: parsedMemo.destinationAddress,
    amount: amount,
    payload_hash: parsedMemo.payloadHash,
  };

  const payload = inMemoryCache.getPayload(paymentToXRPLGateway.payload_hash);

  const messageFromXrpl: MessageFromXrpl = {
    tx_hash: txHash,
    source_address: sourceAddress,
    destination_address: paymentToXRPLGateway.destination_address,
    amount: amount,
    payload_hash: paymentToXRPLGateway.payload_hash,
    payload: payload,
  };

  return messageFromXrpl;
};

const relayMessasge = async (message: MessageFromXrpl) => {
  const { payloadHex, user_message } = await verifyMessage(message);
  await routeMessage({
    payloadHex,
    serializedUserMessage: user_message,
  });
  const { loggedEvent } = await executeItsHubMessage({
    user_message,
    payloadHex,
  });
  await routeITSHubMessage({
    messageId: loggedEvent.messageId,
    payloadHash: user_message.payload_hash,
  });
  const { multisigSessionId } = await constructTransferProof({
    messageId: loggedEvent.messageId,
  });
  const { executeData } = await getProof({ multisigSessionId });
  await sendExecuteDataToGateway({
    gatewayAddress:
      RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`native_gateway_address`],
    executeData,
  });
  await executeITSTransfer({
    // This will be "axelarnet" when relaying from xrpl to evm
    // Unsure about the other direction
    sourceChain: loggedEvent.sourceChain,
    // Sth like 0x0000000000000000000000000000000000000000000000000000000000458cae-531
    messageId: loggedEvent.messageId,
    // This will be INTERCHAIN_TOKEN_SERVICE when relaying from xrpl to evm
    sourceAddress: loggedEvent.sourceAddress,
    // Hex string without 0x
    payload: `0x${loggedEvent.payload}`,
  });
  console.log("✅ Relay completed.");
};

const handleTransactionStream = async (tx: TransactionStream) => {
  const message = parseTx(tx);
  if (message) {
    await relayMessasge(message);
  }
};

const listenToXrplGatewayTransaction = async () => {
  const xrplProvider = await getXrplProvider();
  xrplProvider.on(`transaction`, handleTransactionStream);
};

export const relayXrplToEvm = async () => {
  await startSubscribeToXrplGateway();
  await listenToXrplGatewayTransaction();
};
