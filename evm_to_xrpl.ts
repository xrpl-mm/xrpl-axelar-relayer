import { ethers } from "ethers";
import { RELAYER_CONFIG } from "./relayer_config";
import IAxelarGateway from "./IAxelarGateway.abi.json";

interface ContractCallEvent {
  sender: string; // Address of the sender
  destinationChain: string; // Destination chain name
  destinationContractAddress: string; // Destination contract address
  payloadHash: string; // Payload hash
  payload: string; // Payload (in bytes)
}

const handleContractCallEvent = (
  sender: ContractCallEvent[`sender`],
  destinationChain: ContractCallEvent[`destinationChain`],
  destinationContractAddress: ContractCallEvent[`destinationContractAddress`],
  payloadHash: ContractCallEvent[`payloadHash`],
  payload: ContractCallEvent[`payload`],
) => {
  console.log("ContractCall Event Detected:");
  console.log("Sender:", sender);
  console.log("Destination Chain:", destinationChain);
  console.log("Destination Contract Address:", destinationContractAddress);
  console.log("Payload Hash:", payloadHash);
  console.log("Payload:", payload);
};

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

        handleContractCallEvent(
          event.args.sender,
          event.args.destinationChain,
          event.args.destinationContractAddress,
          event.args.payloadHash,
          event.args.payload,
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

const listenToAxelarGatewayContractCallEvents = async () => {
  const provider = new ethers.JsonRpcProvider(
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`rpc`][`http`],
  );

  const contract = new ethers.Contract(
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`native_gateway_address`],
    IAxelarGateway,
    provider,
  );

  // contract.on(
  //   "ContractCall",
  //   handleContractCallEvent
  // );
  provider.on(`block`, async (blockNumber) => {
    console.log(`Block Number: ${blockNumber}`);
  });
};

export const relayEvmToXrpl = async () => {
  listenToEventsOnNewBlock();
};
