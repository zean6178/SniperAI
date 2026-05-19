/**
 * Genesis Token Verification Service
 * 
 * Verifies if a wallet holds a Seeker Genesis Token (SGT) NFT.
 * 
 * SGT Collection Address: Fyr1vDSkABCMRmDAnDK2bsNiCwKWV3ts4FczVEnG6zxA
 * 
 * Verification methods:
 * 1. Helius DAS API (getAssetsByOwner) — recommended, fastest
 * 2. Solana RPC (getTokenAccountsByOwner) — fallback
 * 
 * Example verified holder: wfrE17YFQAMHSTWwUGUSj9pUYi3fQmiULvwj57Wkzng
 */

import axios from 'axios';

const SGT_COLLECTION_ADDRESS = 'Fyr1vDSkABCMRmDAnDK2bsNiCwKWV3ts4FczVEnG6zxA';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

// Cache results for 1 hour (avoid spamming RPC)
const verificationCache = new Map(); // wallet → { result, expiresAt }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if wallet holds Seeker Genesis Token
 * @param {string} walletAddress - Solana wallet public key
 * @returns {Promise<{hasGenesisToken: boolean, mintAddress?: string}>}
 */
export async function verifyGenesisToken(walletAddress) {
  if (!walletAddress) return { hasGenesisToken: false };

  // Check cache first
  const cached = verificationCache.get(walletAddress);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  let result = { hasGenesisToken: false, mintAddress: null };

  // Method 1: Helius DAS API (preferred)
  if (HELIUS_API_KEY) {
    result = await verifyViaHelius(walletAddress);
  }

  // Method 2: Fallback — direct RPC query
  if (!result.hasGenesisToken && !HELIUS_API_KEY) {
    result = await verifyViaRPC(walletAddress);
  }

  // Cache result
  verificationCache.set(walletAddress, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (result.hasGenesisToken) {
    console.log(`[genesis] ✅ Verified SGT holder: ${walletAddress.slice(0, 8)}… (mint: ${result.mintAddress?.slice(0, 8)}…)`);
  }

  return result;
}

/**
 * Method 1: Helius DAS API — getAssetsByOwner
 * Checks if wallet owns any NFT in the SGT collection
 */
async function verifyViaHelius(walletAddress) {
  try {
    const res = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: '2.0',
        id: 'sgt-check',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 100,
          displayOptions: { showCollectionMetadata: true },
        },
      },
      { timeout: 10000 }
    );

    const assets = res.data?.result?.items || [];

    // Find any NFT that belongs to SGT collection
    const sgt = assets.find(asset => {
      // Check collection grouping
      const collection = asset.grouping?.find(g =>
        g.group_key === 'collection' &&
        g.group_value === SGT_COLLECTION_ADDRESS
      );
      if (collection) return true;

      // Also check creators (backup — SGT might use verified creator)
      const creator = asset.creators?.find(c =>
        c.address === SGT_COLLECTION_ADDRESS && c.verified === true
      );
      if (creator) return true;

      // Check authority
      if (asset.authorities?.some(a => a.address === SGT_COLLECTION_ADDRESS)) return true;

      return false;
    });

    if (sgt) {
      return { hasGenesisToken: true, mintAddress: sgt.id || null };
    }

    return { hasGenesisToken: false, mintAddress: null };
  } catch (e) {
    console.warn(`[genesis] Helius verification failed: ${e.message}`);
    return { hasGenesisToken: false, mintAddress: null };
  }
}

/**
 * Method 2: Direct RPC — check token accounts for SGT collection
 * Less reliable but works without Helius API key
 */
async function verifyViaRPC(walletAddress) {
  const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

  try {
    const res = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }, { timeout: 10000 });

    const accounts = res.data?.result?.value || [];

    // Check if any token account holds an NFT (amount = 1, decimals = 0)
    // and matches SGT mint pattern
    // Note: This is less precise than Helius — would need additional metadata fetch
    for (const account of accounts) {
      const parsed = account.account?.data?.parsed?.info;
      if (parsed?.tokenAmount?.decimals === 0 && parsed?.tokenAmount?.uiAmount === 1) {
        // This is an NFT — but we can't easily verify collection without metadata
        // For production, use Helius method instead
        const mint = parsed?.mint;
        if (mint) {
          // Would need to fetch metadata to verify collection
          // For now, mark as unverified
        }
      }
    }

    return { hasGenesisToken: false, mintAddress: null };
  } catch (e) {
    console.warn(`[genesis] RPC verification failed: ${e.message}`);
    return { hasGenesisToken: false, mintAddress: null };
  }
}

/**
 * Clear cache for a specific wallet (e.g., when user requests re-verification)
 */
export function clearGenesisCache(walletAddress) {
  verificationCache.delete(walletAddress);
}

/**
 * Get SGT collection address
 */
export function getSGTCollectionAddress() {
  return SGT_COLLECTION_ADDRESS;
}
