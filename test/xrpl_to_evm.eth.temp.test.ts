import abi from "ethereumjs-abi";
import { getBytes } from "ethers";
import { Client, ECDSA, Payment, Wallet, xrpToDrops } from "xrpl";
import { Buffer } from "node:buffer";
import { createPayloadHash } from "../src/utils.ts";
import { bootstrap } from "../src/bootstrap.ts";

async function sendMessageFromXRPLtoEVM() {
  const relayerConfig = bootstrap();
  // Can always get a new one from https://xrpl.org/resources/dev-tools/xrp-faucets
  const SECRET = `ssXUdvqpJxycxMQJUCr2bvMf4kuvE`;
  const xrplWallet = Wallet.fromSeed(SECRET, {
    algorithm: ECDSA.secp256k1,
  });

  if (xrplWallet.address !== `r3egfoj8QvKHUGMo6WDJ4P3a1kWMqhBBv5`) {
    throw new Error(`Invalid XRPL wallet address`);
  }

  const AMOUNT = "0.00126";
  const EVM_DESTINATION = `8E03c54DD97fa469d0a4f7a15cbc5dDD2Ee5E5C5`;

  const payloadData: Buffer = abi.rawEncode(
    ["bytes", "string"],
    [getBytes("0x1212121233aabb"), "asdfasdfswea"]
  );

  const payloadDataHex = payloadData.toString("hex");

  // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  //
  // One of these two should be used
  //
  // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  // For local relayer
  // const res = await fetch("http://localhost:3000/payload-from-xrpl", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     payload: payloadDataHex,
  //   }),
  // }).then((res) => res.json());

  // For Common Prefix's relayer
  const res = await fetch("http://45.77.227.11:5001/payload", {
    method: "POST",
    headers: {
      Authorization: "Bearer f8a503c8-8d19-43af-9c69-d8357ee66997",
    },
    body: payloadDataHex,
  }).then((res) => res.json());

  console.log(`res: ${res.message}`);

  console.log(`payload data: ${payloadDataHex}`);

  console.log(
    `sending to ${
      relayerConfig.config[`chains`][`xrpl`][`native_gateway_address`]
    }`
  );

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: xrplWallet.address,
    Amount: {
      currency: "ETH",
      value: AMOUNT,
      issuer: xrplWallet.address,
    },
    Fee: xrpToDrops("1"),
    Destination:
      relayerConfig.config[`chains`][`xrpl`][`native_gateway_address`],
    SigningPubKey: xrplWallet.publicKey,
    SourceTag: 8989_8989,
    Memos: [
      {
        Memo: {
          MemoData: EVM_DESTINATION,
          MemoType: Buffer.from("destination_address")
            .toString("hex")
            .toUpperCase(),
        },
      },
      {
        Memo: {
          MemoData: Buffer.from(
            relayerConfig.config[`chains`][`xrpl-evm-sidechain`][`chain_id`]
          )
            .toString("hex")
            .toUpperCase(),
          MemoType: Buffer.from("destination_chain")
            .toString("hex")
            .toUpperCase(),
        },
      },
      {
        Memo: {
          MemoData: createPayloadHash(payloadData),
          MemoType: Buffer.from("payload_hash").toString("hex").toUpperCase(),
        },
      },
    ],
  };

  const provider = new Client(
    relayerConfig.config[`chains`][`xrpl`][`rpc`][`ws`]
  );
  await provider.connect();
  const autoFilledTx = await provider.autofill(paymentTx);

  const signed = xrplWallet.sign(autoFilledTx);
  const txResponse = await provider.submitAndWait(signed.tx_blob, {
    wallet: xrplWallet,
  });

  console.log(`txResponse: ${JSON.stringify(txResponse, null, 2)}`);

  process.exit(0);
}

sendMessageFromXRPLtoEVM();
