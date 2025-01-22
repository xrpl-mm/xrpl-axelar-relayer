import { ethers } from "ethers";
import { xrplAccountToEvmAddress } from "../src/utils";
import { bootstrap } from "../src/bootstrap";

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
  const augmentedRelayerConfig = bootstrap();

  console.log(`Approving`);
  const tokenContractAddress =
    augmentedRelayerConfig.config[`chains`][`xrpl-evm-sidechain`][
      `token_contracts`
    ][`xrp`];
  const tokenContract = new ethers.Contract(
    tokenContractAddress,
    [`function approve(address spender, uint256 amount) public returns (bool)`],
    augmentedRelayerConfig.evmSidechainRelayingWallet,
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
    augmentedRelayerConfig.evmSidechainRelayingWallet,
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
