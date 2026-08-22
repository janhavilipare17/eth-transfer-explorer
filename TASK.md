# Task: Wallet Transfer History Tool

## Goal
Build a CLI tool that, given an Ethereum address, prints its complete, correctly-categorized, correctly-paginated transfer history using Alchemy's `alchemy_getAssetTransfers`.

## Requirements
1. Accept an address as CLI input (e.g. `npm start -- 0xADDRESS`).
2. Fetch transfers using `alchemy.core.getAssetTransfers()`, explicitly requesting ALL these categories:
   - external (ETH)
   - internal (ETH)
   - erc20
   - erc721
   - erc1155
3. Capture BOTH directions:
   - transfers where the address is `fromAddress`
   - transfers where the address is `toAddress`
4. Fully paginate: loop using `pageKey` until it's undefined/null for every category+direction combination. Do NOT stop at the first page.
5. Merge all results, sort chronologically (oldest or newest first — pick one and be consistent).
6. Print a clean, human-readable feed: date/block, direction (sent/received), asset + amount, counterparty address. NOT raw JSON.

## Test address
`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (vitalik.eth)
- Has tens of thousands of transactions
- Multiple ERC-20s and NFTs
- Use this to verify the implementation doesn't under-report (a lazy implementation with 1 category/1 direction/1 page will show a suspiciously small number)

## Acceptance criteria
- Paste in a busy wallet address and get its REAL transfer history: every category, both directions, every page.
- No truncation, no silent partial results.

## Tech
- Existing setup: Node.js, TypeScript, alchemy-sdk, dotenv already installed.
- API key is in `.env` as `ALCHEMY_API_KEY`.
- Entry point: `src/index.ts`