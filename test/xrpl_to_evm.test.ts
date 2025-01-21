import abi from "ethereumjs-abi";
import { getBytes } from "ethers";
import { Client, Payment, Wallet, xrpToDrops } from "xrpl";
import { RELAYER_CONFIG } from "../relayer_config.ts";
import { Buffer } from "node:buffer";
import { createPayloadHash } from "../utils.ts";

async function sendMessageFromXRPLtoEVM() {
  // Can always get a new one from https://xrpl.org/resources/dev-tools/xrp-faucets
  const SECRET = `sEd7bNqUNqBF1Mh3Vs1hgbk5hr7Ciis`;
  const xrplWallet = Wallet.fromSeed(SECRET);
  const AMOUNT = xrpToDrops("0.00125");
  const EVM_DESTINATION = `8E03c54DD97fa469d0a4f7a15cbc5dDD2Ee5E5C5`;

  const payloadData: Buffer = abi.rawEncode(
    ["bytes", "string"],
    [getBytes("0x1212"), "asdfasdfswea"],
  );

  const payloadDataHex = payloadData.toString("hex");

  // Post to localhost:8001
  const res = await fetch("http://localhost:3000/payload-from-xrpl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload: payloadDataHex,
    }),
  }).then((res) => res.json());

  console.log(`res: ${res.message}`);

  console.log(`payload data: ${payloadDataHex}`);

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: xrplWallet.address,
    Amount: AMOUNT,
    Fee: xrpToDrops("1"),
    Destination: RELAYER_CONFIG[`chains`][`xrpl`][`native_gateway_address`],
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
            RELAYER_CONFIG[`chains`][`xrpl-evm-sidechain`][`chain_id`],
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

  const provider = new Client(RELAYER_CONFIG[`chains`][`xrpl`][`rpc`][`ws`]);
  await provider.connect();
  const autoFilledTx = await provider.autofill(paymentTx);

  const signed = xrplWallet.sign(autoFilledTx);
  const txResponse = await provider.submitAndWait(signed.tx_blob, {
    wallet: xrplWallet,
  });

  console.log(`txResponse: ${JSON.stringify(txResponse, null, 2)}`);
}

sendMessageFromXRPLtoEVM();
