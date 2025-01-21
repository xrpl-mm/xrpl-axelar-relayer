import { ethers } from "ethers";
import { RELAYER_CONFIG } from "../relayer_config";
import IAxelarGateway from "./IAxelarGateway.abi.json";
import { remove0x, unfurlEvent } from "./utils";
import { execSync } from "child_process";
import stringify from "safe-stable-stringify";
import {
  isAxelarExecuteCommandOutput,
  isGetProofSuccessOutputForRelayToEVM,
  isGetProofSuccessOutputForRelayToXRPL,
  isRouteITSMessageOutput,
  LoggedEvent,
} from "./types";
import { Client, SubmitRequest, SubmitResponse } from "xrpl";
import { getXrplProvider } from "./constants";
interface ContractCallEvent {
  // 0x43F2ccD4E27099b5F580895b44eAcC866e5F7Bb1
  sender: string; // Address of the sender
  // axelarnet
  destinationChain: string; // Destination chain name
  // axelar10jzzmv5m7da7dn2xsfac0yqe7zamy34uedx3e28laq0p6f3f8dzqp649fp
  destinationContractAddress: string; // Destination contract address
  // 0x6c6bbf3da23bf931b974ca16cc15dea2b0c4ccf387dc80d693ca33010c5b91db
  payloadHash: string; // Payload hash
  // 0x00000000000000000000000000000000000000000000000000000000000000030000000000...
  payload: string; // Payload (in bytes)
}

function composeMessageId({
  "0xTxHash": txHash,
  eventIndex,
}: {
  "0xTxHash": string;
  eventIndex: number;
}) {
  return `${txHash}-${eventIndex}`;
}

async function handleContractCallEvent(
  sender: ContractCallEvent[`sender`],
  destinationChain: ContractCallEvent[`destinationChain`],
  destinationContractAddress: ContractCallEvent[`destinationContractAddress`],
  payloadHash: ContractCallEvent[`payloadHash`],
  payload: ContractCallEvent[`payload`],
  txHash: string,
  index: number,
) {
  console.log("ContractCall Event Detected:");
  console.log("Sender:", sender);
  console.log("Destination Chain:", destinationChain);
  console.log("Destination Contract Address:", destinationContractAddress);
  console.log("Payload Hash:", payloadHash);
  console.log("Payload:", payload);
  console.log("Index:", index);
  console.log("Tx Hash:", txHash);

  const payloadHashWithout0x = remove0x(payloadHash);
  const payloadWithout0x = remove0x(payload);
  const messageId = composeMessageId({
    "0xTxHash": txHash,
    eventIndex: index,
  });
  await verifyMessage({
    messageId,
    sourceAddress: sender, // always ITS address on EVM sidechain
    destinationChain,
    destinationAddress: destinationContractAddress,
    payloadHash: payloadHashWithout0x,
  });

  await routeMessage({
    sourceChain: RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
    messageId,
    sourceAddress: sender,
    destinationChain,
    destinationAddress: destinationContractAddress,
    payloadHash: payloadHashWithout0x,
  });

  const { loggedEvent } = await executeITSHubMessage({
    sourceChain: RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
    messageId,
    payload: payloadWithout0x,
  });

  const { multisigSessionId } = await constructTransferProof({
    messageId: loggedEvent.messageId,
    payload: loggedEvent.payload,
  });

  const { txBlob } = await getProof({ multisigSessionId });
  const submitResponse = await submitTransactionBlob(txBlob);

  if (!submitResponse.result.accepted) {
    console.log(`XRPL tx not accepted: ${submitResponse.result.engine_result}`);
    console.log(stringify(submitResponse, null, 2));

    return
  }

  await verifyProverMessage({
    xrplTxHash: submitResponse.result.tx_json.hash!,
  });
  await confirmTxStatus({
    multisigSessionId,
    signedTxHash: submitResponse.result.tx_json.hash!,
    // "Signers": [
    //   {
    //     "Signer": {
    //       "Account": "r4LDyA6WoyzJ6ZhQ5NWU4AG1aApBwbSSk6",
    //       "SigningPubKey": "030543653008B6A4EB09B34231BC1B800422053AA558E4088B141CFB632AF40AD6",
    //       "TxnSignature": "3045022100F8597ED8DD62B11FB0CF76DCF6A944AB88805C89C267915F802F7E3E6AE52B3A02201AF179D75FC3E4AB7B69C47D9F3C56618ED3D94FFF2CD6EEDE105325A859E40F"
    //     }
    //   }
    // ],
    signerPublicKey:
      submitResponse.result.tx_json.Signers![0].Signer.SigningPubKey,
  });
}

async function verifyMessage({
  messageId,
  sourceAddress,
  destinationChain,
  destinationAddress,
  payloadHash,
}: {
  // "0xb7441c4bade3ce322264b33c769dea181ce2e0c151984c2fd55924f721333382-2"
  messageId: string;
  // always ITS address on EVM sidechain
  sourceAddress: string;
  destinationChain: string;
  destinationAddress: string;
  // "ee4a05ee7582bf86217694a25875eac0b24429cf6de286631f88d699180ebe7b"
  payloadHash: string;
}) {
  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`axelarnet_gateway_address`]
  } '{
    "verify_messages": [
      ${stringify({
        cc_id: {
          source_chain:
            RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
          message_id: messageId,
        },
        source_address: sourceAddress,
        destination_chain: destinationChain,
        destination_address: destinationAddress,
        payload_hash: payloadHash,
      })}
    ]
  }' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
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
}

async function routeMessage({
  sourceChain,
  messageId,
  sourceAddress,
  destinationChain,
  destinationAddress,
  payloadHash,
}: {
  sourceChain: string;
  messageId: string;
  sourceAddress: string;
  destinationChain: string;
  destinationAddress: string;
  payloadHash: string;
}) {
  const routeMessageCall = {
    route_messages: [
      {
        cc_id: {
          source_chain: sourceChain,
          message_id: messageId,
        },
        destination_chain: destinationChain,
        destination_address: destinationAddress,
        source_address: sourceAddress,
        payload_hash: payloadHash,
      },
    ],
  };

  // axelard tx wasm execute $XRPL_EVM_SIDECHAIN_GATEWAY '{
  //   "route_messages": [
  //     {
  //       "cc_id": {
  //         "source_chain": "xrpl-evm-sidechain",
  //         "message_id": "0xb7441c4bade3ce322264b33c769dea181ce2e0c151984c2fd55924f721333382-2"
  //       },
  //       "source_address": "'$XRPL_EVM_SIDECHAIN_ITS'",
  //       "destination_chain": "axelar",
  //       "destination_address": "axelar13ehuhysn5mqjeaheeuew2gjs785f6k7jm8vfsqg3jhtpkwppcmzqtedxty",
  //       "payload_hash": "ee4a05ee7582bf86217694a25875eac0b24429cf6de286631f88d699180ebe7b"
  //     }
  //   ]
  // }' "${ARGS[@]}"
  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`axelarnet_gateway_address`]
  } '${stringify(routeMessageCall)}' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  while (true) {
    try {
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

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
}

// axelard tx wasm execute $AXELARNET_GATEWAY '{"execute":{"cc_id":{"source_chain":"xrpl-evm-sidechain","message_id":"0xb7441c4bade3ce322264b33c769dea181ce2e0c151984c2fd55924f721333382-2"},"payload":"0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000047872706c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000807e7301d2070bb8753685fd3739aafacb88b82f24b921840241f936b3811fe800000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000014ac2fd8e04577cc5199d74e1a681847803a7712490000000000000000000000000000000000000000000000000000000000000000000000000000000000000014928846baf59bd48c28b131855472d04c93bbd0b70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"}}' "${ARGS[@]}"
async function executeITSHubMessage({
  sourceChain,
  messageId,
  payload,
}: {
  sourceChain: string;
  messageId: string;
  payload: string;
}) {
  const executeCall = {
    execute: {
      cc_id: {
        source_chain: sourceChain,
        message_id: messageId,
      },
      payload: payload,
    },
  };

  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`axelarnet`][`axelarnet_gateway_address`]
  } '${stringify(executeCall)}' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  let loggedEvent: LoggedEvent | null = null;
  while (true) {
    try {
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

      const parsed = JSON.parse(output);

      console.log(parsed);

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

  return { loggedEvent: unfurled };
}

// axelard tx wasm execute $XRPL_MULTISIG_PROVER '{"construct_proof":{"cc_id":{"source_chain":"axelar","message_id":"0xae1dfbc0b61849e587b038776d1f60094aa59b6d14e44e48647c8b7f586bb62b-2119"},"payload":"0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000127872706c2d65766d2d73696465636861696e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000807e7301d2070bb8753685fd3739aafacb88b82f24b921840241f936b3811fe800000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000014ac2fd8e04577cc5199d74e1a681847803a7712490000000000000000000000000000000000000000000000000000000000000000000000000000000000000014928846baf59bd48c28b131855472d04c93bbd0b70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"}}' "${ARGS[@]}"
async function constructTransferProof({
  messageId,
  payload,
}: {
  messageId: string;
  payload: string;
}) {
  const constructProofCall = {
    construct_proof: {
      message_id: {
        source_chain: RELAYER_CONFIG[`chains`][`axelarnet`][`chain_id`],
        message_id: messageId,
      },
      payload: payload,
    },
  };
  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`xrpl`][`axelarnet_multisig_prover_address`]
  } '${stringify(constructProofCall)}' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  let loggedEvent: LoggedEvent | null = null;
  while (true) {
    try {
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

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
}

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
          RELAYER_CONFIG[`chains`][`xrpl`][`axelarnet_multisig_prover_address`]
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

      if (isGetProofSuccessOutputForRelayToXRPL(parsed)) {
        console.log(`Proof constructed. Tx Blob: ${parsed.data.tx_blob}`);

        return {
          txBlob: parsed.data.tx_blob,
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

async function submitTransactionBlob(txBlob: string): Promise<SubmitResponse> {
  console.log(`Submitting transaction blob: ${txBlob}`);
  const request: SubmitRequest = {
    command: "submit",
    tx_blob: txBlob,
    fail_hard: true,
  };

  const client = await getXrplProvider();
  const response = await client.request(request);

  console.log(
    `https://devnet.xrpl.org/transactions/${response.result.tx_json.hash}`,
  );

  return response;
}

// axelard tx wasm execute $XRPL_GATEWAY '{"verify_messages":[{"prover_message":"7FFD99C31E7FFAE2835208B9EE0617C15B357776C97EE2E16268A86E7002C478"}]}' "${ARGS[@]}"
async function verifyProverMessage({ xrplTxHash }: { xrplTxHash: string }) {
  const verifyMessageCall = {
    verify_messages: [
      {
        prover_message: xrplTxHash,
      },
    ],
  };
  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`xrpl`][`axelarnet_gateway_address`]
  } '${stringify(verifyMessageCall)}' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  while (true) {
    try {
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

      const parsed = JSON.parse(output);
      console.log({ output: stringify(parsed, null, 2) });

      // TODO: resolve the promise when the prover message is verified
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for prover message to be verified...`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
// axelard tx wasm execute $XRPL_MULTISIG_PROVER '{"confirm_tx_status":{"multisig_session_id":"84","signed_tx_hash":"7FFD99C31E7FFAE2835208B9EE0617C15B357776C97EE2E16268A86E7002C478","signer_public_keys":[{"ecdsa":"0226BB43B7E6A6EBD4A07C852BB2F054B32A53286F4465FF1CF9C0D56EFB1FE113"}]}}' "${ARGS[@]}"
async function confirmTxStatus({
  multisigSessionId,
  signedTxHash,
  signerPublicKey,
}: {
  multisigSessionId: string;
  signedTxHash: string;
  signerPublicKey: string;
}) {
  const confirmTxStatusCall = {
    confirm_tx_status: {
      multisig_session_id: multisigSessionId,
      signed_tx_hash: signedTxHash,
      signer_public_keys: [{ ecdsa: signerPublicKey }],
    },
  };

  const command = `axelard tx wasm execute ${
    RELAYER_CONFIG[`chains`][`xrpl`][`axelarnet_multisig_prover_address`]
  } '${stringify(confirmTxStatusCall)}' --keyring-backend test --from ${
    RELAYER_CONFIG[`wallet_name`]
  } --keyring-dir ${
    RELAYER_CONFIG["keyring_dir"]
  } --gas 20000000 --gas-adjustment 1.5 --gas-prices 0.00005uamplifier --chain-id devnet-amplifier --node ${
    RELAYER_CONFIG["chains"]["axelarnet"][`rpc`]
  }`;

  while (true) {
    try {
      const output = execSync(command, {
        env: {
          ...process.env,
          AXELARD_CHAIN_ID: `axelar-testnet-lisbon-3`,
        },
      }).toString();

      const parsed = JSON.parse(output);
      console.log({ output: stringify(parsed, null, 2) });

      // TODO: resolve the promise when the transaction is confirmed
    } catch (e) {
      const error = e as Error;
      console.log(
        `Error: ${error.message}. Waiting for transaction status to be confirmed...`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

const listenToEventsOnNewBlock = async () => {
  const provider = new ethers.JsonRpcProvider(
    RELAYER_CONFIG["chains"]["xrpl-evm-sidechain"]["rpc"]["http"],
  );
  const contract = new ethers.Contract(
    RELAYER_CONFIG["chains"]["xrpl-evm-sidechain"]["native_gateway_address"],
    IAxelarGateway,
    provider,
  );

  const filter = contract.filters.ContractCall();
  let lastProcessedBlock = await provider.getBlockNumber(); // Start from the latest block

  provider.on("block", async (blockNumber) => {
    console.log(`current block: ${blockNumber}`);
    try {
      console.log(
        `Fetching logs from block ${
          lastProcessedBlock + 1
        } to ${blockNumber}...`,
      );
      // Update the last processed block
      const prevLastProcessedBlock = lastProcessedBlock;
      lastProcessedBlock = blockNumber;

      // Fetch logs from the last processed block (inclusive) to the current block
      // This might take a long time, that's why we have lastProcessedBlock = blockNumber; right above this
      // to avoid fetching the same logs again. Otherwise we might run more than once for the same block.
      const logs = await provider.getLogs({
        ...filter,
        fromBlock: prevLastProcessedBlock + 1, // Start from the next unprocessed block
        toBlock: blockNumber, // Current block
      });

      logs.forEach((log) => {
        const event = contract.interface.parseLog(log);

        if (!event) {
          return;
        }
        const index = log.index;
        const txHash = log.transactionHash;

        handleContractCallEvent(
          event.args.sender,
          event.args.destinationChain,
          event.args.destinationContractAddress,
          event.args.payloadHash,
          event.args.payload,
          txHash,
          index,
        );
      });
    } catch (error) {
      console.error("Error fetching logs on new block:", error);
    }
  });

  console.log("Listening for events on new blocks...");
};

export const relayEvmToXrpl = async () => {
  listenToEventsOnNewBlock();
};
