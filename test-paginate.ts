import * as dotenv from "dotenv";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

dotenv.config();

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

async function main() {
  const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const all: any[] = [];
  let pageKey: string | undefined = undefined;
  let pageCount = 0;
  do {
    const r: any = await alchemy.core.getAssetTransfers({
      category: [AssetTransfersCategory.EXTERNAL],
      fromAddress: address,
      maxCount: 1000,
      withMetadata: true,
      ...(pageKey ? { pageKey } : {}),
    });
    all.push(...r.transfers);
    pageKey = r.pageKey;
    pageCount++;
    console.log(`Page ${pageCount}: ${r.transfers.length} transfers, pageKey=${r.pageKey}`);
  } while (pageKey);
  console.log(`Total: ${all.length} transfers across ${pageCount} pages`);
}

main();