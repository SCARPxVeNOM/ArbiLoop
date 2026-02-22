import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseAbiItem,
} from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEPOSIT_EVENT = parseAbiItem(
  'event Deposit(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referral)',
);
const SUPPLY_EVENT = parseAbiItem(
  'event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)',
);
const WITHDRAW_EVENT = parseAbiItem(
  'event Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)',
);
const BORROW_EVENT_V2 = parseAbiItem(
  'event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 interestRateMode, uint256 borrowRate, uint16 indexed referral)',
);
const BORROW_EVENT_V3 = parseAbiItem(
  'event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)',
);
const REPAY_EVENT_V2 = parseAbiItem(
  'event Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount)',
);
const REPAY_EVENT_V3 = parseAbiItem(
  'event Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)',
);

const POOL_EVENTS = [
  DEPOSIT_EVENT,
  SUPPLY_EVENT,
  WITHDRAW_EVENT,
  BORROW_EVENT_V2,
  BORROW_EVENT_V3,
  REPAY_EVENT_V2,
  REPAY_EVENT_V3,
];

const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

const DEFAULTS = {
  aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  radiantPool: '0xE23B4AE3624fB6f7cDEF29bC8EAD912f1Ede6886',
  arbitrumRpc: 'https://arb1.arbitrum.io/rpc',
  arbitrumSepoliaRpc: 'https://sepolia-rollup.arbitrum.io/rpc',
};

const KNOWN_TOKEN_METADATA = {
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH', decimals: 18 },
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', decimals: 6 },
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': { symbol: 'DAI', decimals: 18 },
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { symbol: 'WBTC', decimals: 8 },
};

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDC.E']);

const SYMBOL_TO_COINGECKO_ID = {
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  ETH: 'ethereum',
  WETH: 'weth',
  USDT: 'tether',
  USDC: 'usd-coin',
  'USDC.E': 'usd-coin',
  DAI: 'dai',
  RDNT: 'radiant-capital',
  AAVE: 'aave',
  ARB: 'arbitrum',
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function normalizeAddress(value, fallback = '') {
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return fallback;
  return getAddress(trimmed);
}

function toLowerAddress(value) {
  return getAddress(value).toLowerCase();
}

function parseTargetChain(targetChainRaw) {
  const normalized = (targetChainRaw || 'arbitrum').toLowerCase().trim();
  if (normalized === '421614' || normalized === 'arbitrum-sepolia' || normalized === 'arbitrumsepolia') {
    return 'arbitrum-sepolia';
  }
  return 'arbitrum';
}

function parseIntWithBounds(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function normalizeSymbol(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\0/g, '')
    .replace(/[^a-zA-Z0-9.]/g, '')
    .toUpperCase();
  if (cleaned === 'WEETH') return 'WETH';
  return cleaned || 'UNKNOWN';
}

function formatDateForCoingecko(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}-${month}-${year}`;
}

function toNumeric(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function fetchTokenMeta(publicClient, assetAddress, tokenMetaCache) {
  const key = toLowerAddress(assetAddress);
  const cached = tokenMetaCache.get(key);
  if (cached) return cached;

  if (KNOWN_TOKEN_METADATA[key]) {
    tokenMetaCache.set(key, KNOWN_TOKEN_METADATA[key]);
    return KNOWN_TOKEN_METADATA[key];
  }

  let symbol = 'UNKNOWN';
  let decimals = 18;

  try {
    const [rawSymbol, rawDecimals] = await Promise.all([
      publicClient.readContract({
        address: getAddress(assetAddress),
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: getAddress(assetAddress),
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    symbol = normalizeSymbol(rawSymbol);
    decimals = Number(rawDecimals);
  } catch {
    // Keep defaults.
  }

  const resolved = { symbol, decimals };
  tokenMetaCache.set(key, resolved);
  return resolved;
}

async function fetchHistoricalUsdPrice(symbol, blockTimeIso, priceCache) {
  const normalized = normalizeSymbol(symbol);

  if (STABLE_SYMBOLS.has(normalized)) {
    return 1;
  }

  const coingeckoId = SYMBOL_TO_COINGECKO_ID[normalized];
  if (!coingeckoId) return null;

  const day = formatDateForCoingecko(blockTimeIso);
  const cacheKey = `${coingeckoId}:${day}`;
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey);
  }

  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/history?date=${day}&localization=false`;
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      priceCache.set(cacheKey, null);
      return null;
    }

    const json = await response.json();
    const usdPrice = json?.market_data?.current_price?.usd;
    const numeric = Number.isFinite(Number(usdPrice)) ? Number(usdPrice) : null;
    priceCache.set(cacheKey, numeric);
    return numeric;
  } catch {
    priceCache.set(cacheKey, null);
    return null;
  }
}

async function fetchBlockTimestampIso(publicClient, blockNumber, blockTimeCache) {
  const key = blockNumber.toString();
  if (blockTimeCache.has(key)) {
    return blockTimeCache.get(key);
  }

  const block = await publicClient.getBlock({ blockNumber });
  const iso = new Date(Number(block.timestamp) * 1000).toISOString();
  blockTimeCache.set(key, iso);
  return iso;
}

function mapLogToRawEvent(log) {
  const reserve = log.args?.reserve;
  const amount = log.args?.amount;
  if (!reserve || amount === undefined || amount === null) return null;

  if (log.eventName === 'Deposit' || log.eventName === 'Supply') {
    const wallet = log.args?.onBehalfOf;
    if (!wallet) return null;
    return {
      action: 'deposit',
      walletAddress: getAddress(wallet),
      assetAddress: getAddress(reserve),
      amountRaw: amount,
    };
  }

  if (log.eventName === 'Withdraw') {
    const wallet = log.args?.to;
    if (!wallet) return null;
    return {
      action: 'withdraw',
      walletAddress: getAddress(wallet),
      assetAddress: getAddress(reserve),
      amountRaw: amount,
    };
  }

  if (log.eventName === 'Borrow') {
    const wallet = log.args?.onBehalfOf;
    if (!wallet) return null;
    return {
      action: 'borrow',
      walletAddress: getAddress(wallet),
      assetAddress: getAddress(reserve),
      amountRaw: amount,
    };
  }

  if (log.eventName === 'Repay') {
    const wallet = log.args?.user;
    if (!wallet) return null;
    return {
      action: 'repay',
      walletAddress: getAddress(wallet),
      assetAddress: getAddress(reserve),
      amountRaw: amount,
    };
  }

  return null;
}

async function getOrInitCursor({
  supabase,
  chainId,
  protocol,
  latestSafeBlock,
  lookbackBlocks,
}) {
  const { data, error } = await supabase
    .from('pnl_indexer_state')
    .select('cursor_block')
    .eq('chain_id', chainId)
    .eq('protocol', protocol)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read indexer cursor for ${protocol}: ${error.message}`);
  }

  if (data && data.cursor_block !== null && data.cursor_block !== undefined) {
    const cursor = BigInt(data.cursor_block);
    return cursor + 1n;
  }

  const lookback = BigInt(lookbackBlocks);
  const defaultStart = latestSafeBlock > lookback ? latestSafeBlock - lookback + 1n : 0n;

  const { error: insertError } = await supabase
    .from('pnl_indexer_state')
    .upsert(
      {
        chain_id: chainId,
        protocol,
        cursor_block: defaultStart > 0n ? Number(defaultStart - 1n) : 0,
        last_indexed_block: defaultStart > 0n ? Number(defaultStart - 1n) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chain_id,protocol' },
    );

  if (insertError) {
    throw new Error(`Failed to initialize indexer cursor for ${protocol}: ${insertError.message}`);
  }

  return defaultStart;
}

async function saveCursor({ supabase, chainId, protocol, cursorBlock }) {
  const payload = {
    chain_id: chainId,
    protocol,
    cursor_block: Number(cursorBlock),
    last_indexed_block: Number(cursorBlock),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('pnl_indexer_state')
    .upsert(payload, { onConflict: 'chain_id,protocol' });

  if (error) {
    throw new Error(`Failed to update indexer cursor for ${protocol}: ${error.message}`);
  }
}

async function upsertInBatches(supabase, table, rows, onConflict, batchSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }
  }
}

async function insertInBatches(supabase, table, rows, batchSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`Failed to insert ${table}: ${error.message}`);
    }
  }
}

function buildAssetKey(protocol, assetAddress) {
  return `${protocol}:${assetAddress.toLowerCase()}`;
}

async function rebuildWalletPnl({ supabase, walletAddress, chainId }) {
  const wallet = walletAddress.toLowerCase();
  const { data: events, error } = await supabase
    .from('wallet_activity_events')
    .select('protocol, action, asset_address, asset_symbol, amount_usd, block_time, block_number, log_index')
    .eq('wallet_address', wallet)
    .eq('chain_id', chainId)
    .order('block_number', { ascending: true })
    .order('log_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch wallet events for ${wallet}: ${error.message}`);
  }

  const positionLedger = new Map();
  const dailyLedger = new Map();

  for (const event of events || []) {
    const protocol = String(event.protocol || 'unknown');
    const assetAddress = String(event.asset_address || ZERO_ADDRESS).toLowerCase();
    const assetSymbol = normalizeSymbol(event.asset_symbol || 'UNKNOWN');
    const amountUsd = Math.max(0, toNumeric(event.amount_usd));

    const key = buildAssetKey(protocol, assetAddress);
    const current = positionLedger.get(key) || {
      wallet_address: wallet,
      chain_id: chainId,
      protocol,
      asset_address: assetAddress,
      asset_symbol: assetSymbol,
      principal_usd: 0,
      realized_pnl_usd: 0,
      total_deposit_usd: 0,
      total_withdraw_usd: 0,
      last_event_block: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    let realizedDelta = 0;
    if (event.action === 'deposit') {
      current.principal_usd += amountUsd;
      current.total_deposit_usd += amountUsd;
    } else if (event.action === 'withdraw') {
      current.total_withdraw_usd += amountUsd;
      realizedDelta = Math.max(0, amountUsd - current.principal_usd);
      current.realized_pnl_usd += realizedDelta;
      current.principal_usd = Math.max(0, current.principal_usd - amountUsd);
    }

    current.last_event_block = event.block_number ? Number(event.block_number) : current.last_event_block;
    current.updated_at = new Date().toISOString();
    positionLedger.set(key, current);

    const day = String(event.block_time).slice(0, 10);
    if (day && day.length === 10) {
      const dayEntry = dailyLedger.get(day) || { realized_pnl_usd: 0, event_count: 0 };
      dayEntry.realized_pnl_usd += realizedDelta;
      dayEntry.event_count += 1;
      dailyLedger.set(day, dayEntry);
    }
  }

  const { error: deletePositionsError } = await supabase
    .from('wallet_pnl_positions')
    .delete()
    .eq('wallet_address', wallet)
    .eq('chain_id', chainId);
  if (deletePositionsError) {
    throw new Error(`Failed to clear wallet_pnl_positions for ${wallet}: ${deletePositionsError.message}`);
  }

  const positionRows = Array.from(positionLedger.values())
    .filter((row) => row.total_deposit_usd > 0 || row.total_withdraw_usd > 0 || row.realized_pnl_usd > 0 || row.principal_usd > 0)
    .map((row) => ({
      ...row,
      principal_usd: Number(row.principal_usd.toFixed(8)),
      realized_pnl_usd: Number(row.realized_pnl_usd.toFixed(8)),
      total_deposit_usd: Number(row.total_deposit_usd.toFixed(8)),
      total_withdraw_usd: Number(row.total_withdraw_usd.toFixed(8)),
    }));

  await insertInBatches(supabase, 'wallet_pnl_positions', positionRows, 500);

  const { error: deleteDailyError } = await supabase
    .from('wallet_pnl_daily')
    .delete()
    .eq('wallet_address', wallet)
    .eq('chain_id', chainId);
  if (deleteDailyError) {
    throw new Error(`Failed to clear wallet_pnl_daily for ${wallet}: ${deleteDailyError.message}`);
  }

  const days = Array.from(dailyLedger.keys()).sort();
  let cumulative = 0;
  const dailyRows = days.map((day) => {
    const entry = dailyLedger.get(day);
    const realized = Number((entry?.realized_pnl_usd || 0).toFixed(8));
    cumulative += realized;
    return {
      wallet_address: wallet,
      chain_id: chainId,
      day,
      realized_pnl_usd: realized,
      cumulative_realized_pnl_usd: Number(cumulative.toFixed(8)),
      event_count: entry?.event_count || 0,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  });

  await insertInBatches(supabase, 'wallet_pnl_daily', dailyRows, 500);
}

async function getLogsWithAdaptiveChunk({
  publicClient,
  poolAddress,
  fromBlock,
  toBlock,
  initialChunkSize,
}) {
  let size = initialChunkSize;

  while (size >= 64) {
    const maxTo = fromBlock + BigInt(size - 1);
    const finalTo = maxTo < toBlock ? maxTo : toBlock;
    try {
      const logs = await publicClient.getLogs({
        address: poolAddress,
        fromBlock,
        toBlock: finalTo,
        events: POOL_EVENTS,
      });
      return { logs, chunkToBlock: finalTo };
    } catch (error) {
      size = Math.floor(size / 2);
      if (size < 64) {
        throw error;
      }
    }
  }

  return { logs: [], chunkToBlock: fromBlock };
}

async function processProtocol({
  protocol,
  poolAddress,
  chainId,
  latestSafeBlock,
  lookbackBlocks,
  maxChunkSize,
  publicClient,
  supabase,
  tokenMetaCache,
  priceCache,
  blockTimeCache,
}) {
  const affectedWallets = new Set();
  let fromBlock = await getOrInitCursor({
    supabase,
    chainId,
    protocol,
    latestSafeBlock,
    lookbackBlocks,
  });

  if (fromBlock > latestSafeBlock) {
    console.log(`[${protocol}] up to date at block ${Number(latestSafeBlock)}`);
    return affectedWallets;
  }

  console.log(`[${protocol}] indexing from ${Number(fromBlock)} to ${Number(latestSafeBlock)}`);

  while (fromBlock <= latestSafeBlock) {
    const { logs, chunkToBlock } = await getLogsWithAdaptiveChunk({
      publicClient,
      poolAddress,
      fromBlock,
      toBlock: latestSafeBlock,
      initialChunkSize: maxChunkSize,
    });

    const activityRows = [];
    for (const log of logs) {
      const mapped = mapLogToRawEvent(log);
      if (!mapped) continue;
      if (mapped.walletAddress.toLowerCase() === ZERO_ADDRESS) continue;

      const blockTimeIso = await fetchBlockTimestampIso(publicClient, log.blockNumber, blockTimeCache);
      const tokenMeta = await fetchTokenMeta(publicClient, mapped.assetAddress, tokenMetaCache);
      const amountToken = Number(formatUnits(mapped.amountRaw, tokenMeta.decimals));
      const priceUsd = await fetchHistoricalUsdPrice(tokenMeta.symbol, blockTimeIso, priceCache);
      const amountUsd = Number.isFinite(amountToken) && typeof priceUsd === 'number'
        ? Number((amountToken * priceUsd).toFixed(8))
        : null;

      const wallet = mapped.walletAddress.toLowerCase();
      affectedWallets.add(wallet);

      activityRows.push({
        chain_id: chainId,
        protocol,
        wallet_address: wallet,
        action: mapped.action,
        asset_address: mapped.assetAddress.toLowerCase(),
        asset_symbol: tokenMeta.symbol,
        amount_raw: mapped.amountRaw.toString(),
        amount_token: Number.isFinite(amountToken) ? Number(amountToken.toFixed(12)) : null,
        amount_usd: amountUsd,
        tx_hash: String(log.transactionHash),
        log_index: Number(log.logIndex),
        block_number: Number(log.blockNumber),
        block_time: blockTimeIso,
        updated_at: new Date().toISOString(),
      });
    }

    await upsertInBatches(
      supabase,
      'wallet_activity_events',
      activityRows,
      'chain_id,tx_hash,log_index',
      500,
    );

    await saveCursor({
      supabase,
      chainId,
      protocol,
      cursorBlock: chunkToBlock,
    });

    console.log(`[${protocol}] processed ${Number(fromBlock)} -> ${Number(chunkToBlock)} (events: ${activityRows.length})`);
    fromBlock = chunkToBlock + 1n;
  }

  return affectedWallets;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  const fileEnv = loadEnvFile(envPath);
  const env = { ...fileEnv, ...process.env };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY');
  }

  const targetChain = parseTargetChain(env.NEXT_PUBLIC_TARGET_CHAIN);
  const chain = targetChain === 'arbitrum' ? arbitrum : arbitrumSepolia;
  const chainId = chain.id;

  const rpcUrl = env.ARBITRUM_RPC_URL
    || env.NEXT_PUBLIC_ARBITRUM_RPC_URL
    || (targetChain === 'arbitrum' ? DEFAULTS.arbitrumRpc : DEFAULTS.arbitrumSepoliaRpc);

  const aavePool = normalizeAddress(env.NEXT_PUBLIC_AAVE_POOL_ADDRESS, DEFAULTS.aavePool);
  const radiantPool = normalizeAddress(env.NEXT_PUBLIC_RADIANT_POOL_ADDRESS, DEFAULTS.radiantPool);

  const maxChunkSize = parseIntWithBounds(env.PNL_INDEXER_CHUNK_SIZE, 1_500, 64, 20_000);
  const lookbackBlocks = parseIntWithBounds(env.PNL_INDEXER_LOOKBACK_BLOCKS, 80_000, 1_000, 10_000_000);
  const finalityBlocks = parseIntWithBounds(env.PNL_INDEXER_FINALITY_BLOCKS, 20, 0, 5_000);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 20_000 }),
  });
  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const latestBlock = await publicClient.getBlockNumber();
  const latestSafeBlock = latestBlock > BigInt(finalityBlocks)
    ? latestBlock - BigInt(finalityBlocks)
    : latestBlock;

  const protocols = [
    { protocol: 'aave-v3', poolAddress: aavePool },
    { protocol: 'radiant-v2', poolAddress: radiantPool },
  ].filter((entry) => entry.poolAddress && entry.poolAddress !== ZERO_ADDRESS);

  if (protocols.length === 0) {
    throw new Error('No protocol pool addresses configured for indexing');
  }

  const tokenMetaCache = new Map();
  const priceCache = new Map();
  const blockTimeCache = new Map();
  const affectedWallets = new Set();

  console.log(`Chain: ${chain.name} (${chainId})`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Latest block: ${Number(latestBlock)} (safe: ${Number(latestSafeBlock)})`);
  console.log(`Protocols: ${protocols.map((entry) => entry.protocol).join(', ')}`);

  for (const protocolEntry of protocols) {
    const protocolWallets = await processProtocol({
      ...protocolEntry,
      chainId,
      latestSafeBlock,
      lookbackBlocks,
      maxChunkSize,
      publicClient,
      supabase,
      tokenMetaCache,
      priceCache,
      blockTimeCache,
    });

    for (const wallet of protocolWallets) {
      affectedWallets.add(wallet);
    }
  }

  for (const walletAddress of affectedWallets) {
    await rebuildWalletPnl({
      supabase,
      walletAddress,
      chainId,
    });
    console.log(`[wallet] rebuilt realized pnl: ${walletAddress}`);
  }

  console.log(`Completed. Wallets refreshed: ${affectedWallets.size}`);
}

main().catch((error) => {
  console.error('PnL indexer failed:', error?.message || error);
  process.exit(1);
});
