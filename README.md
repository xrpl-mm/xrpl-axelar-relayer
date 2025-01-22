# xrpl-axelar-relayer

This is a POC relayer that relays messages from XRPL to EVM and vice versa.

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
# or use any other config.json file that conforms to the schema defined in src/relayer_config.ts
npm start -- relayer_config.json
```

## Testing

Test EVM to XRPL token transfer with payload:

```bash
npm run to-xrpl -- relayer_config.json
```

Test XRPL to EVM token transfer:

```bash
npm run to-evm -- relayer_config.json
```
