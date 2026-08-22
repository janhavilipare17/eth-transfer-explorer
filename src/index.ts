import * as dotenv from "dotenv";
import { Alchemy, Network } from "alchemy-sdk";
import * as fs from "fs";
import * as path from "path";

import { getWalletHistory, ensureOutputDir, isValidEthereumAddress } from "./lib";

dotenv.config();

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npm start -- <ethereum-address>");
    process.exit(1);
  }
  const address = args[0];

  if (!isValidEthereumAddress(address)) {
    console.error(
      `Error: "${address}" is not a valid Ethereum address. Expected format: 0x followed by 40 hex characters.`
    );
    process.exit(1);
  }

  try {
    const history = await getWalletHistory(address);

    // Ensure output directory and file path
    const outputFile = ensureOutputDir(address);

    // Build the full human-readable feed text
    const lines: string[] = [];
    lines.push(`=== Transfer History for ${address} (${history.transfers.length} total) ===`);
    lines.push(
      `Date                              Direction  Asset       Amount   Counterparty       Tx Hash`
    );
    lines.push(
      `---------------------------------------------------------------  ---------------------------------  --------  ----------------  ---------------------------------------`
    );

    for (const t of history.transfers) {
      const dateStr = t.blockTimestamp.toISOString().split("T")[0];
      lines.push(
        `${dateStr.padEnd(15)}  ${t.direction
          .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
      );
    }

    lines.push(
      `\n--- Summary: ${history.transfers.length} transfers total ---`
    );
    lines.push(`  Sent (fromAddress): ${history.sentCount}`);
    lines.push(
      `  Received (toAddress): ${history.receivedCount}`
    );

    // Write full feed to file
    fs.writeFileSync(outputFile, lines.join("\n") + "\n");

    // Print preview: first 20 and last 20 transfers to console
    const previewLines: string[] = [];
    previewLines.push(
      `\n=== Transfer History for ${address} (${history.transfers.length} total) ===`
    );
    previewLines.push(
      `Date                              Direction  Asset       Amount   Counterparty       Tx Hash`
    );
    previewLines.push(
      `---------------------------------------------------------------  ---------------------------------  --------  ----------------  ---------------------------------------`
    );

    // First 20
    for (let i = 0; i < Math.min(20, history.transfers.length); i++) {
      const t = history.transfers[i];
      const dateStr = t.blockTimestamp.toISOString().split("T")[0];
      previewLines.push(
        `${dateStr.padEnd(15)}  ${t.direction
          .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
      );
    }

    // Ellipsis if more than 20
    if (history.transfers.length > 40) {
      previewLines.push(`... (showing first 20 and last 20 of ${history.transfers.length} total) ...`);
    }

    // Last 20
    const startLast = Math.max(history.transfers.length - 20, 0);
    for (let i = startLast; i < history.transfers.length; i++) {
      const t = history.transfers[i];
      const dateStr = t.blockTimestamp.toISOString().split("T")[0];
      previewLines.push(
        `${dateStr.padEnd(15)}  ${t.direction
          .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
      );
    }

    previewLines.push(
      `\n--- Summary: ${history.transfers.length} transfers total ---`
    );
    previewLines.push(`  Sent (fromAddress): ${history.sentCount}`);
    previewLines.push(
      `  Received (toAddress): ${history.receivedCount}`
    );
    previewLines.push(
      `\nFull history written to: ${outputFile}`
    );

    console.log(previewLines.join("\n"));
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main().catch(console.error);