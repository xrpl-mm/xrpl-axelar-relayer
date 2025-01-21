import { ethers } from "ethers";
import { EVM_SIDECHAIN_RELAYING_WALLET } from "../src/constants";
import { RELAYER_CONFIG } from "../relayer_config";
import { xrplAccountToEvmAddress } from "../src/utils";

// Address
// rEjrYCKjc3yR4qokX1Yy4y4EPj924UndeC
// Secret
// sEdTHrLSHKeYVr6PsMB8a1WzWpHqRgQ
const XRPLDestination = xrplAccountToEvmAddress(
  `rEjrYCKjc3yR4qokX1Yy4y4EPj924UndeC`,
);

console.log(`XRPL Destination: ${XRPLDestination}`);

const testingEnv = {
  testingContractAddress: `0x60766991c4900a88974aa59e18d4029452415c13`,
  destinationAddress: XRPLDestination,
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

  // wait for tx hash
  await approveResult.wait();

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

// XRP is 18 decimals on EVM sidechain
sendMessageFromEVMToXRPL(
  // 0.12 XRP (be careful not to send a lot, not to waste the token balance)
  120000000000000000n,
);
