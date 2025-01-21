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

const handleContractCallEvent = (sender: ContractCallEvent[`sender`], destinationChain: ContractCallEvent[`destinationChain`], destinationContractAddress: ContractCallEvent[`destinationContractAddress`], payloadHash: ContractCallEvent[`payloadHash`], payload: ContractCallEvent[`payload`]) => {
  console.log("ContractCall Event Detected:");
  console.log("Sender:", sender);
  console.log("Destination Chain:", destinationChain);
  console.log("Destination Contract Address:", destinationContractAddress);
  console.log("Payload Hash:", payloadHash);
  console.log("Payload:", payload);
}

const listenToAxelarGatewayContractCallEvents = async () => {
  const provider = new ethers.JsonRpcProvider(RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`rpc`][`http`]);

  const contract = new ethers.Contract(RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`native_gateway_address`], IAxelarGateway, provider);

  contract.on(
    "ContractCall",
    handleContractCallEvent
  );
}

export const relayEvmToXrpl = async () => {
  listenToAxelarGatewayContractCallEvents();
}
