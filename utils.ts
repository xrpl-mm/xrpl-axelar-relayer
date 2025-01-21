import { decodeAccountID, encodeAccountID } from "xrpl";
import { Buffer } from "buffer";
import { keccak256 } from "ethers";
/**
 * Converts an XRPL account to an EVM address.
 * @param account The XRPL account to convert.
 * @returns The EVM address.
 */
export const xrplAccountToEvmAddress = (account: string): string => {
  const accountId = decodeAccountID(account);
  return `0x${Buffer.from(accountId).toString("hex")}`;
};

/**
 * Converts an EVM address to an XRPL account.
 * @param address The EVM address to convert.
 * @returns The XRPL account.
 */
export const evmAddressToXrplAccount = (address: string): string => {
  const accountId = Buffer.from(address.slice(2), "hex");
  return encodeAccountID(accountId);
};

export const uint8ArrToHex = (arr: number[]): string => {
  return arr.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const prepend0x = (hex: string): string => {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
};

export const remove0x = (hex: string): string => {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

export function createPayloadHash(payload: Buffer): string {
  return keccak256(payload).slice(2);
}
