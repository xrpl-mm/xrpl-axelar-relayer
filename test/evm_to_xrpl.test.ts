import { ethers } from "ethers";
import { EVM_SIDECHAIN_RELAYING_WALLET } from "../constants";
import { RELAYER_CONFIG } from "../relayer_config";

const testingEnv = {
  testingContractAddress: `0x60766991c4900a88974aa59e18d4029452415c13`,
  destinationAddress: `0x928846BAF59BD48C28B131855472D04C93BBD0B7`,
};

async function sendMessageFromEVMToXRPL(amount: bigint) {
  console.log(`Approving`);
  const tokenContractAddress =
    RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`token_contracts`][`xrp`];
  const tokenContract = new ethers.Contract(
    tokenContractAddress,
    [`function approve(address spender, uint256 amount) public returns (bool)`],
    EVM_SIDECHAIN_RELAYING_WALLET,
  );
  const approveResult = await tokenContract.approve(
    testingEnv.testingContractAddress,
    amount,
  );

  console.log(`Approved: ${approveResult.hash}`);

  // Send
  const testingContract = new ethers.Contract(
    testingEnv.testingContractAddress,
    [
      {
        inputs: [
          {
            internalType: "bytes",
            name: "destinationAddress",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "sendXRPToXRPL",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    EVM_SIDECHAIN_RELAYING_WALLET,
  );

  console.log(`Sending token`);

  const sendResult = await testingContract.sendXRPToXRPL(
    testingEnv.destinationAddress,
    amount,
  );

  console.log(`Sent token: ${sendResult.hash}`);
}

sendMessageFromEVMToXRPL(10000000568n);
