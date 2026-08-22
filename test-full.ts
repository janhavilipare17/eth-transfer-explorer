import * as dotenv from "dotenv";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

dotenv.config();

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

async function fetchAll(category: AssetTransfersCategory[], direction: "from" | "to", address: string) {
  const all: any[] = [];
  let pageKey: string | undefined = undefined;
  let pageCount = 0;
  do {
    const params: any = {
      category: category,
      [direction === "from" ? "fromAddress" : "toAddress"]: address,
      maxCount: 1000,
      withMetadata: true,
    };
    if (pageKey) params.pageKey = pageKey;
    const r: any = await alchemy.core.getAssetTransfers(params);
    all.push(...r.transfers);
    pageKey = r.pageKey;
    pageCount++;
    console.log(`  Page ${pageCount}: ${r.transfers.length} transfers, pageKey=${r.pageKey}`);
  } while (pageKey);
  return { all, pageCount };
}

async function main() {
  const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const categories: AssetTransfersCategory[] = [
    AssetTransfersCategory.EXTERNAL,
    AssetTransfersCategory.INTERNAL,
    AssetTransfersCategory.ERC20,
    AssetTransfersCategory.ERC721,
    AssetTransfersCategory.ERC1155,
  ];

  for (const cat of categories) {
    const { all, pageCount } = await fetchAll([cat], "from", address);
    console.log(`OUTGOING [${cat}]: ${all.length} transfers across ${pageCount} pages`);
  }

  for (const cat of categories) {
    const { all, pageCount } = await fetchAll([cat], "to", address);
    console.log(`INCOMING [${cat}]: ${all.length} transfers across ${pageCount} pages`);
  }
}

main();