import * as dotenv from "dotenv";
import { Alchemy, Network } from "alchemy-sdk";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

// 5 required categories
const CATEGORIES: ("external" | "internal" | "erc20" | "erc721" | "erc1155")[] = [
  "external",
  "internal",
  "erc20",
  "erc721",
  "erc1155",
];

interface RawTransfer {
  uniqueId: string;
  category: string;
  blockNum: string;
  from: string;
  to: string | null;
  value: number | null;
  erc721TokenId: string | null;
  tokenId: string | null;
  asset: string | null;
  hash: string;
  metadata?: {
    blockTimestamp: string;
    erc1155Metadata?: { tokenId: string; value: string }[];
  };
}

interface ParsedTransfer {
  blockTimestamp: Date;
  direction: "sent" | "received";
  asset: string;
  amount: string;
  counterparty: string;
  hash: string;
  category: string;
}

/**
 * Small helper to resolve after ms milliseconds (avoids hammering the API).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fully paginated fetch for one direction.
 * Loops until pageKey returns undefined, collecting ALL pages.
 * Includes retry with exponential backoff (up to 5 retries).
 * 300ms delay between successful pages to be kind to the API.
 */
async function fetchAllTransfers(
  address: string,
  direction: "from" | "to"
): Promise<RawTransfer[]> {
  const all: RawTransfer[] = [];
  let pageKey: string | undefined = undefined;
  let pageNum = 1;

  do {
    // Retry loop for this specific page
    let attempts = 0;
    let response: any = null;
    while (attempts < 5) {
      attempts++;
      try {
        const params: any = {
          category: CATEGORIES,
          [direction === "from" ? "fromAddress" : "toAddress"]: address,
          maxCount: 1000,
          withMetadata: true,
        };
        if (pageKey) {
          params.pageKey = pageKey;
        }
        response = await alchemy.core.getAssetTransfers(params);
        break; // success, exit retry loop
      } catch (error: any) {
        if (attempts >= 5) {
          // All retries exhausted - rethrow to fail loudly
          throw new Error(
            `getAssetTransfers failed after 5 attempts for pageKey=${pageKey}. ` +
              `Last error: ${error.message || error}`
          );
        }
        const backoffMs = [1000, 2000, 4000, 8000][attempts - 1] || 16000;
        console.log(
          `  [warn] request failed (attempt ${attempts}/5), retrying in ${backoffMs}ms: ${error.message || error}`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    if (!response) {
      // Should not happen since we throw on 5 failures, but safety check
      throw new Error("getAssetTransfers returned no response");
    }

    all.push(...response.transfers);
    console.log(`  [progress] page ${pageNum} fetched, running total: ${all.length} transfers`);
    pageNum++;
    await sleep(300);

    pageKey = response.pageKey;
  } while (pageKey);

  return all;
}

/** Format amount+asset based on category */
function formatForCategory(
  category: string,
  tx: RawTransfer
): { asset: string; amount: string } {
  if (category === "external" || category === "internal") {
    return { asset: "ETH", amount: tx.value !== null ? `${tx.value}` : "0" };
  }
  if (category === "erc20") {
    return {
      asset: tx.asset || "UnknownToken",
      amount: tx.value !== null ? `${tx.value}` : "0",
    };
  }
  if (category === "erc721") {
    return {
      asset: "NFT",
      amount: tx.erc721TokenId || tx.tokenId || "1",
    };
  }
  // erc1155
  if (category === "erc1155") {
    if (
      tx.metadata?.erc1155Metadata &&
      tx.metadata.erc1155Metadata.length > 0
    ) {
      const meta = tx.metadata.erc1155Metadata[0];
      const amt = meta.value !== undefined ? `${meta.value}` : "1";
      return { asset: "NFT", amount: amt };
    }
    return { asset: "NFT", amount: tx.tokenId || "1" };
  }
  return { asset: "?", amount: "0" };
}

function ensureOutputDir(address: string): string {
  const safeAddr = address.replace(/[^a-zA-Z0-9]/g, "_");
  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filePath = path.join(outputDir, `transfers-${safeAddr}.txt`);
  return filePath;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npm start -- <ethereum-address>");
    process.exit(1);
  }
  const address = args[0];
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.error(
      `Error: "${address}" is not a valid Ethereum address. Expected format: 0x followed by 40 hex characters.`
    );
    process.exit(1);
  }
  const normalizedAddress = address.toLowerCase();
  console.log(`Fetching transfer history for ${address}...\n`);

  // Fetch both directions fully paginated
  console.log("Fetching outgoing (fromAddress) transfers...");
  const outgoing = await fetchAllTransfers(normalizedAddress, "from");
  console.log(`  -> ${outgoing.length} transfers found`);

  console.log("Fetching incoming (toAddress) transfers...");
  const incoming = await fetchAllTransfers(normalizedAddress, "to");
  console.log(`  -> ${incoming.length} transfers found`);

  // Parse all transfers into human-readable format
  const parsed: ParsedTransfer[] = [];

  // Outgoing = sent
  for (const tx of outgoing) {
    const { asset, amount } = formatForCategory(tx.category, tx);
    parsed.push({
      blockTimestamp:
        tx.metadata?.blockTimestamp
          ? new Date(tx.metadata.blockTimestamp)
          : new Date(0),
      direction: "sent",
      asset,
      amount,
      counterparty: tx.to || "unknown",
      hash: tx.hash,
      category: tx.category,
    });
  }

  // Incoming = received
  for (const tx of incoming) {
    const { asset, amount } = formatForCategory(tx.category, tx);
    parsed.push({
      blockTimestamp:
        tx.metadata?.blockTimestamp
          ? new Date(tx.metadata.blockTimestamp)
          : new Date(0),
      direction: "received",
      asset,
      amount,
      counterparty: tx.from || "unknown",
      hash: tx.hash,
      category: tx.category,
    });
  }

  // Sort chronologically - oldest first
  parsed.sort((a, b) =>
    a.blockTimestamp.getTime() - b.blockTimestamp.getTime()
  );

  // Ensure output directory and file path
  const outputFile = ensureOutputDir(address);

  // Build the full human-readable feed text
  const lines: string[] = [];
  lines.push(`=== Transfer History for ${address} (${parsed.length} total) ===`);
  lines.push(
    `Date                              Direction  Asset       Amount   Counterparty       Tx Hash`
  );
  lines.push(
    `---------------------------------------------------------------  ---------------------------------  --------  ----------------  ---------------------------------------`
  );

  for (const t of parsed) {
    const dateStr = t.blockTimestamp.toISOString().split("T")[0];
    lines.push(
      `${dateStr.padEnd(15)}  ${t.direction
        .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
    );
  }

  lines.push(
    `\n--- Summary: ${parsed.length} transfers total ---`
  );
  lines.push(`  Sent (fromAddress): ${parsed.filter(
    (t) => t.direction === "sent"
  ).length}`);
  lines.push(
    `  Received (toAddress): ${parsed.filter(
      (t) => t.direction === "received"
    ).length}`
  );

  // Write full feed to file
  fs.writeFileSync(outputFile, lines.join("\n") + "\n");

  // Print preview: first 20 and last 20 transfers to console
  const previewLines: string[] = [];
  previewLines.push(
    `\n=== Transfer History for ${address} (${parsed.length} total) ===`
  );
  previewLines.push(
    `Date                              Direction  Asset       Amount   Counterparty       Tx Hash`
  );
  previewLines.push(
    `---------------------------------------------------------------  ---------------------------------  --------  ----------------  ---------------------------------------`
  );

  // First 20
  for (let i = 0; i < Math.min(20, parsed.length); i++) {
    const t = parsed[i];
    const dateStr = t.blockTimestamp.toISOString().split("T")[0];
    previewLines.push(
      `${dateStr.padEnd(15)}  ${t.direction
        .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
    );
  }

  // Ellipsis if more than 20
  if (parsed.length > 40) {
    previewLines.push(`... (showing first 20 and last 20 of ${parsed.length} total) ...`);
  }

  // Last 20
  const startLast = Math.max(parsed.length - 20, 0);
  for (let i = startLast; i < parsed.length; i++) {
    const t = parsed[i];
    const dateStr = t.blockTimestamp.toISOString().split("T")[0];
    previewLines.push(
      `${dateStr.padEnd(15)}  ${t.direction
        .padEnd(9)}  ${t.asset.padEnd(11)}  ${t.amount.padEnd(8)}  ${t.counterparty.padEnd(20)}  ${t.hash}`
    );
  }

  previewLines.push(
    `\n--- Summary: ${parsed.length} transfers total ---`
  );
  previewLines.push(`  Sent (fromAddress): ${parsed.filter(
    (t) => t.direction === "sent"
  ).length}`);
  previewLines.push(
    `  Received (toAddress): ${parsed.filter(
      (t) => t.direction === "received"
    ).length}`
  );
  previewLines.push(
    `\nFull history written to: ${outputFile}`
  );

  console.log(previewLines.join("\n"));
}

main().catch(console.error);