import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import { getWalletHistory, isValidEthereumAddress } from "./lib";

const app = express();
const PORT = 3001;

// Serve static files from public directory (serves index.html at root)
app.use(express.static('public'));

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// API route for fetching transfer history
app.get('/api/transfers/:address', async (req, res) => {
  const address = req.params.address;

  // Validate address format
  if (!isValidEthereumAddress(address)) {
    return res.status(400).json({
      error: ` "${address}" is not a valid Ethereum address. Expected format: 0x followed by 40 hex characters.`,
    });
  }

  try {
    const history = await getWalletHistory(address);

    // Return the most recent 200 transfers (limited payload) + totalCount
    const recentTransfers = history.transfers.slice(0, 200);

    res.json({
      summary: {
        totalCount: history.transfers.length,
        sentCount: history.sentCount,
        receivedCount: history.receivedCount,
        categoryBreakdown: history.categoryBreakdown,
        topAssets: history.topAssets,
        uniqueCounterparties: history.uniqueCounterparties.length,
      },
      transfers: recentTransfers,
    });
  } catch (error: any) {
    console.error('Error fetching transfer history:', error);
    if (error.message?.includes('not a valid Ethereum address')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
});

// Catch-all route: serve index.html for any non-API routes
// express.static('public') already handles serving index.html
// for the root path GET / automatically

app.listen(PORT, () => {
  console.log(`Transfer history API server running on http://localhost:${PORT}`);
});