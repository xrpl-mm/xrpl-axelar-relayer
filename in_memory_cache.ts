import { Buffer } from "node:buffer";
import { createPayloadHash } from "./utils.ts";

type PayloadHashToPayload = {
  // hex payload hash to hex payload
  [payload_hash: string]: string;
};

class InMemoryCache {
  payload_hash_to_payload: PayloadHashToPayload = {};

  /**
   * Payload needs to be added before payment
   */
  getPayload(hex_payload_hash: string): string {
    console.log(JSON.stringify(this.payload_hash_to_payload, null, 2));

    if (hex_payload_hash in this.payload_hash_to_payload) {
      const payload = this.payload_hash_to_payload[hex_payload_hash];
      delete this.payload_hash_to_payload[hex_payload_hash];
      delete this.payload_hash_to_payload[payload];

      return payload;
    } else {
      throw new Error(`Payload with hash ${hex_payload_hash} not found`);
    }
  }

  public addPayloadFromXRPL(payloadHex: string) {
    const buffer: Buffer = Buffer.from(payloadHex, "hex");

    const payloadHash = createPayloadHash(buffer).toUpperCase();

    console.log(`Received payload: ${payloadHex}`);
    console.log(`Created payload hash: ${payloadHash}`);

    this.payload_hash_to_payload[payloadHash] = payloadHex;
  }
}

export const inMemoryCache = new InMemoryCache();
