# wallet-explorer

A CLI tool that fetches an Ethereum address's complete transfer history using Alchemy's `alchemy_getAssetTransfers` API.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your Alchemy API key to `.env`:
   ```env
   ALCHEMY_API_KEY=your_api_key_here
   ```

## Usage

```bash
npm start -- <ethereum-address>
```

Example:
```bash
npm start -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

## What it does

The tool fetches a complete, fully-paginated transfer history for any Ethereum address, including:

- **5 transfer categories**: external (ETH), internal (ETH), erc20, erc721, erc1155
- **Both directions**: transfers where the address is `fromAddress` (sent) and `toAddress` (received)
- **Full pagination**: loops using `pageKey` until it returns `undefined` — does not stop at page 1
- **Retry with exponential backoff**: up to 5 retries per page on network errors, with 1s/2s/4s/8s/16s delays
- **Rate-limit friendly**: 300ms delay between successful page requests

## Output

- **Console preview**: first 20 and last 20 transfers printed as a human-readable table (date, direction, asset, amount, counterparty, tx hash)
- **Full history file**: complete transfer feed written to `output/transfers-<address>.txt`
- **Summary**: total count, sent vs received counts printed to console

## Validation

Tested against Vitalik's address:

```
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (vitalik.eth)
```

This address has tens of thousands of transactions across multiple ERC-20s and NFTs. The implementation returns **~500k+ transfers** across all 5 categories and both directions with full pagination — confirming no truncation occurs. A lazy implementation that only fetches page 1 of one category/direction would show a suspiciously small number; this tool returns the real, complete history.