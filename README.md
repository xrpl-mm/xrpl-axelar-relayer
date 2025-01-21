# xrpl-axelar-relayer

## Installation

First, install [axelard](https://github.com/axelarnetwork/axelar-core).

Then, create a local test credentials by typing:

```bash
axelard keys add relayer --keyring-backend test --keyring-dir relayer-test.axelar
```

where `relayer-test.axelar` is your local directory that stores keyring.

Fund the account that you just created on Axelarnet for it to pay for gas on relay.

Adjust `relayer_config.ts` as needed. For example, you may want to change `RELAYER_CONFIG['keyring_dir']` if you have a different keyring dir or `RELAYER_CONFIG['wallet_name']` if you have a different wallet name (wallet name is the name of the file that is generated - for example, `wallet.info` means "wallet" is the name of the wallet)

Add `.env` file by copying it from `.env.example`. Set up a funded EVM account on EVM sidechain and write the private key to `.env`.

Finally, run:

```bash
npm run start
```

## Testing

Test EVM to XRPL token transfer with payload:

```bash
npx ts-node ./test/evm_to_xrpl.test.ts
```

Test XRPL to EVM token transfer:

```bash
npx ts-node ./test/xrpl_to_evm.test.ts
```
