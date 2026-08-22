import { Alchemy, Network } from "alchemy-sdk";

export const CATEGORIES: ("external" | "internal" | "erc20" | "erc721" | "erc1155")[] = [
  "external",
  "internal",
  "erc20",
  "erc721",
  "erc1155",
];

export interface RawTransfer {
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

export interface ParsedTransfer {
  blockTimestamp: Date;
  direction: "sent" | "received";
  asset: string;
  amount: string;
  counterparty: string;
  hash: string;
  category: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatForCategory(
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

/**
 * Validate Ethereum address format: 0x followed by exactly 40 hex characters.
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Lazy-Alchemy client singleton.
 * Creates the Alchemy instance on first call (after dotenv.config() has run)
 * and reuses it for all subsequent calls.
 * This ensures process.env.ALCHEMY_API_KEY is read at invocation time,
 * not at module load time.
 */
let alchemyClient: Alchemy | null = null;

export function getAlchemyClient(): Alchemy {
  if (!alchemyClient) {
    if (!process.env.ALCHEMY_API_KEY) {
      throw new Error(
        "ALCHEMY_API_KEY not found in environment. Make sure dotenv.config() has run."
      );
    }
    alchemyClient = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.ETH_MAINNET,
    });
  }
  return alchemyClient;
}

/**
 * Ensures the output directory exists and returns the file path for the
 * transfer history text file. Used by the CLI entry point.
 */
export function ensureOutputDir(address: string): string {
  const safeAddr = address.replace(/[^a-zA-Z0-9]/g, "_");
  const outputDir = require("path").join(__dirname, "output");
  if (!require("fs").existsSync(outputDir)) {
    require("fs").mkdirSync(outputDir, { recursive: true });
  }
  return require("path").join(outputDir, `transfers-${safeAddr}.txt`);
}

export interface WalletHistory {
  transfers: ParsedTransfer[];
  sentCount: number;
  receivedCount: number;
  categoryBreakdown: Record<string, number>;
  topAssets: { asset: string; count: number }[];
  uniqueCounterparties: string[];
}

/**
 * Fetches the complete transfer history for an Ethereum address.
 * Core logic reused by both CLI and Express server.
 * Returns parsed transfers + summary stats. No I/O, no console.log.
 *
 * @param address - Ethereum address string (validated by caller or internally)
 * @returns WalletHistory object with transfers and summary statistics
 */
export async function getWalletHistory(address: string): Promise<WalletHistory> {
  // Internal validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      ` "${address}" is not a valid Ethereum address. Expected format: 0x followed by 40 hex characters.`
    );
  }
  const normalizedAddress = address.toLowerCase();

  // Use the lazy Alchemy client (reads process.env.ALCHEMY_API_KEY on first call)
  const alchemy = getAlchemyClient();

  // Fetch both directions fully paginated
  const categories: any[] = ["external", "internal", "erc20", "erc721", "erc1155"];

  async function fetchAllTransfers(address: string, dir: "from" | "to", quiet: boolean = false): Promise<any[]> {
    const all: any[] = [];
    let pageKey: string | undefined = undefined;
    let pageNum = 1;

    do {
      let attempts = 0;
      let response: any = null;
      while (attempts < 5) {
        attempts++;
        try {
          const params: any = {
            category: categories,
            [dir === "from" ? "fromAddress" : "toAddress"]: address,
            maxCount: 1000,
            withMetadata: true,
          };
          if (pageKey) {
            params.pageKey = pageKey;
          }
          response = await alchemy.core.getAssetTransfers(params);
          break;
        } catch (error: any) {
          if (attempts >= 5) {
            throw new Error(
              `getAssetTransfers failed after 5 attempts for pageKey=${pageKey}. Last error: ${error.message || error}`
            );
          }
          const backoffMs = [1000, 2000, 4000, 8000][attempts - 1] || 16000;
          if (!quiet) {
            console.log(
              `  [warn] request failed (attempt ${attempts}/5), retrying in ${backoffMs}ms: ${error.message || error}`
            );
          }
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }

      if (!response) {
        throw new Error("getAssetTransfers returned no response");
      }

      all.push(...response.transfers);
      if (!quiet) {
        console.log(`  [progress] page ${pageNum} fetched, running total: ${all.length} transfers`);
      }
      pageNum++;
      await sleep(300);

      pageKey = response.pageKey;
    } while (pageKey);

    return all;
  }

  const outgoing = await fetchAllTransfers(normalizedAddress, "from", true);
  const incoming = await fetchAllTransfers(normalizedAddress, "to", true);

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

  // Compute summary stats
  const categoryCounts: Record<string, number> = {
    external: parsed.filter((t) => t.category === "external").length,
    internal: parsed.filter((t) => t.category === "internal").length,
    erc20: parsed.filter((t) => t.category === "erc20").length,
    erc721: parsed.filter((t) => t.category === "erc721").length,
    erc1155: parsed.filter((t) => t.category === "erc1155").length,
  };

  const topAssetsMap: Map<string, number> = new Map();
  for (const t of parsed) {
    if (t.category !== "external" && t.category !== "internal") {
      topAssetsMap.set(t.asset, (topAssetsMap.get(t.asset) || 0) + 1);
    }
  }
  const sortedAssets = Array.from(topAssetsMap.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const topAssets: { asset: string; count: number }[] = sortedAssets.slice(
    0,
    5
  ).map(([asset, count]) => ({ asset, count }));

  const uniqueCounterparties = new Set(parsed.map((t) => t.counterparty));

  return {
    transfers: parsed,
    sentCount: parsed.filter((t) => t.direction === "sent").length,
    receivedCount: parsed.filter((t) => t.direction === "received").length,
    categoryBreakdown: categoryCounts,
    topAssets,
    uniqueCounterparties: Array.from(uniqueCounterparties),
  };
}