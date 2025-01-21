import { ethers } from "ethers";
import { RELAYER_CONFIG } from "./relayer_config";
import IAxelarGateway from "./IAxelarGateway.abi.json";
import { remove0x } from "./utils";
import { execSync } from "child_process";
import stringify from "safe-stable-stringify";
import { isRouteITSMessageOutput } from "./types";

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
  }' --keyring-backend test --from wallet --keyring-dir ${
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
  } '${stringify(
    routeMessageCall,
  )}' --keyring-backend test --from wallet --keyring-dir ${
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
    try {
      console.log(
        `Fetching logs from block ${
          lastProcessedBlock + 1
        } to ${blockNumber}...`,
      );
      // Fetch logs from the last processed block (inclusive) to the current block
      const logs = await provider.getLogs({
        ...filter,
        fromBlock: lastProcessedBlock + 1, // Start from the next unprocessed block
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

      // Update the last processed block
      lastProcessedBlock = blockNumber;
    } catch (error) {
      console.error("Error fetching logs on new block:", error);
    }
  });

  console.log("Listening for events on new blocks...");
};

export const relayEvmToXrpl = async () => {
  listenToEventsOnNewBlock();
};
