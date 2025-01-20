# xrpl-axelar-relayer

## Installation

First, install [axelard](https://github.com/axelarnetwork/axelar-core).

Then, create a local test credentials by typing:

```bash
axelard keys add relayer --keyring-backend test --keyring-dir relayer-test.axelar
```

where `relayer-test.axelar` is your local directory that stores keyring.

Then, fund the account that you just created on Axelarnet for it to pay for gas on relay.

Next, adjust `relayer_config.ts` as needed. For example, you may want to change `RELAYER_CONFIG['keyring_dir']` if you have a different keyring dir.

Finally, run:

```bash
npm run start
```
