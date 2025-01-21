# xrpl-axelar-relayer

## Installation

First, install [axelard](https://github.com/axelarnetwork/axelar-core).

Then, create a local test credentials by typing:

```bash
axelard keys add relayer --keyring-backend test --keyring-dir relayer-test.axelar
```

where `relayer-test.axelar` is your local directory that stores keyring.

Fund the account that you just created on Axelarnet for it to pay for gas on relay.

Adjust `relayer_config.ts` as needed. For example, you may want to change `RELAYER_CONFIG['keyring_dir']` if you have a different keyring dir.

Add `.env` file by copying it from `.env.example`. Set up a funded EVM account on EVM sidechain and write the private key to `.env`.

Finally, run:

```bash
npm run start
```

## Address for testing

https://explorer.xrplevm.org/address/0xb99a45be2e2dcc55a8e25d5ad0eed7ffb45af88e
