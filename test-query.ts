import * as dotenv from "dotenv";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

dotenv.config();

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

async function main() {
  const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const r = await alchemy.core.getAssetTransfers({
    category: [AssetTransfersCategory.EXTERNAL],
    fromAddress: address,
    maxCount: 5,
    withMetadata: true,
  });
  console.log("Page key:", r.pageKey);
  console.log("Count:", r.transfers.length);
  r.transfers.forEach((t: any) => {
    console.log("---", t.hash, t.category, t.from, t.to, t.value);
  });
}

main();