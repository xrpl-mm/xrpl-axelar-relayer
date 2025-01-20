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
    const buffer: Buffer<ArrayBufferLike> = Buffer.from(payloadHex, "hex");

    const payloadHash = createPayloadHash(buffer);

    this.payload_hash_to_payload[payloadHash] = payloadHex;
  }
}

export const inMemoryCache = new InMemoryCache();
