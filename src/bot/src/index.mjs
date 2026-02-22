import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
  recoverMessageAddress,
} from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const ALLOWED_INTERVALS = new Set([60, 120, 360, 720, 960, 1440]);
const ALERT_MIN = 1.0;
const ALERT_MAX = 2.0;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEFAULT_AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const DEFAULT_RADIANT_POOL = '0xE23B4AE3624fB6f7cDEF29bC8EAD912f1Ede6886';
const DEFAULT_ARB_RPC = 'https://arb1.arbitrum.io/rpc';
const DEFAULT_ARB_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

const MONITOR_TICK_MS = Number(process.env.MONITOR_TICK_MS || 60_000);
const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 60);
const DAILY_REPORT_INTERVAL_MS = Number(process.env.DAILY_REPORT_INTERVAL_MS || 24 * 60 * 60 * 1000);
const ENABLE_PNL_INDEXER = (process.env.ENABLE_PNL_INDEXER || 'true').toLowerCase() !== 'false';
const PNL_INDEXER_INTERVAL_MS = Number(process.env.PNL_INDEXER_INTERVAL_MS || 10 * 60 * 1000);

const envChain = (process.env.NEXT_PUBLIC_TARGET_CHAIN || process.env.TARGET_CHAIN || 'arbitrum').toLowerCase();
const targetChain = (envChain === '421614' || envChain === 'arbitrum-sepolia' || envChain === 'arbitrumsepolia')
  ? arbitrumSepolia
  : arbitrum;

const AAVE_POOL = (process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || DEFAULT_AAVE_POOL).trim();
const RADIANT_POOL = (process.env.NEXT_PUBLIC_RADIANT_POOL_ADDRESS || DEFAULT_RADIANT_POOL).trim();
const RPC_URL = (process.env.ARBITRUM_RPC_URL || process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || (
  targetChain.id === arbitrum.id ? DEFAULT_ARB_RPC : DEFAULT_ARB_SEPOLIA_RPC
)).trim();

const ACCOUNT_DATA_ABI = parseAbi([
  'function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
]);

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createPublicClient({
  chain: targetChain,
  transport: http(RPC_URL, { timeout: 20_000 }),
});

let monitorSweepRunning = false;
let pnlSweepRunning = false;

function toSafeAddress(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) return null;
  return getAddress(normalized).toLowerCase();
}

function parseUserIntervalMinutes(user) {
  const interval = Number(user.polling_interval || 60);
  return ALLOWED_INTERVALS.has(interval) ? interval : 60;
}

function elapsedMs(isoTime) {
  if (!isoTime) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(isoTime);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Date.now() - timestamp;
}

function shouldCheckUserNow(user) {
  const intervalMs = parseUserIntervalMinutes(user) * 60 * 1000;
  return elapsedMs(user.last_checked) >= intervalMs;
}

function shouldSendAlertNow(user) {
  const cooldownMs = ALERT_COOLDOWN_MINUTES * 60 * 1000;
  return elapsedMs(user.last_alert_sent) >= cooldownMs;
}

function shouldSendDailyReportNow(user) {
  return Boolean(user.daily_updates_enabled) && elapsedMs(user.last_daily_report_sent) >= DAILY_REPORT_INTERVAL_MS;
}

function getChatId(ctx) {
  if (!ctx.chat?.id) throw new Error('Chat id unavailable');
  return Number(ctx.chat.id);
}

function getCommandArg(ctx) {
  const text = ctx.message?.text || '';
  const idx = text.indexOf(' ');
  return idx === -1 ? '' : text.slice(idx + 1).trim();
}

function shortWallet(wallet) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatHealth(result) {
  if (!result) {
    return {
      hasPositions: false,
      healthFactor: null,
      collateralUsd: 0,
      debtUsd: 0,
      borrowPowerUsd: 0,
      status: 'inactive',
    };
  }

  const collateralUsd = Number(result[0]) / 1e8;
  const debtUsd = Number(result[1]) / 1e8;
  const availableBorrowsUsd = Number(result[2]) / 1e8;
  const currentThreshold = Number(result[4]) / 10000;
  const healthFactor = Number(result[5]) / 1e18;
  const hasPositions = collateralUsd > 0.001 || debtUsd > 0.001;

  if (!hasPositions) {
    return {
      hasPositions: false,
      healthFactor: null,
      collateralUsd,
      debtUsd,
      borrowPowerUsd: 0,
      status: 'inactive',
    };
  }

  const borrowPowerUsd = Math.max(collateralUsd * currentThreshold, debtUsd + availableBorrowsUsd);
  const status = healthFactor > 1.5 ? 'safe' : (healthFactor > 1.1 ? 'warning' : 'critical');

  return {
    hasPositions,
    healthFactor,
    collateralUsd,
    debtUsd,
    borrowPowerUsd,
    status,
  };
}

async function fetchProtocolHealth(poolAddress, walletAddress) {
  const pool = toSafeAddress(poolAddress);
  if (!pool || pool === ZERO_ADDRESS) {
    return formatHealth(null);
  }

  const result = await publicClient.readContract({
    address: pool,
    abi: ACCOUNT_DATA_ABI,
    functionName: 'getUserAccountData',
    args: [walletAddress],
  });

  return formatHealth(result);
}

async function fetchWalletHealth(walletAddress) {
  const normalizedWallet = toSafeAddress(walletAddress);
  if (!normalizedWallet) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  const [aave, radiant] = await Promise.all([
    fetchProtocolHealth(AAVE_POOL, normalizedWallet),
    fetchProtocolHealth(RADIANT_POOL, normalizedWallet),
  ]);

  const activeHealthFactors = [aave.healthFactor, radiant.healthFactor].filter(
    (value) => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );

  const minHealthFactor = activeHealthFactors.length > 0 ? Math.min(...activeHealthFactors) : null;

  return {
    walletAddress: normalizedWallet,
    aave,
    radiant,
    minHealthFactor,
    totalDebtUsd: (aave.debtUsd || 0) + (radiant.debtUsd || 0),
    totalBorrowPowerUsd: (aave.borrowPowerUsd || 0) + (radiant.borrowPowerUsd || 0),
  };
}

function pickBreachProtocol(snapshot, threshold) {
  const candidates = [
    { protocol: 'aave-v3', ...snapshot.aave },
    { protocol: 'radiant-v2', ...snapshot.radiant },
  ].filter((entry) => entry.hasPositions && typeof entry.healthFactor === 'number' && entry.healthFactor < threshold);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.healthFactor - b.healthFactor);
  return candidates[0];
}

function getSeverityFromHealth(healthFactor, threshold) {
  if (!Number.isFinite(healthFactor)) return 'info';
  if (healthFactor <= 1.0) return 'critical';
  if (healthFactor < threshold) return 'warning';
  return 'info';
}

function buildAlertText(user, protocolLabel, healthFactor, threshold) {
  return (
    `Liquidation risk detected on ${protocolLabel}.\n` +
    `Wallet: ${shortWallet(user.wallet_address)}\n` +
    `Health Factor: ${healthFactor.toFixed(3)}\n` +
    `Your Threshold: ${threshold.toFixed(2)}\n\n` +
    `Action: Add collateral or repay debt now.`
  );
}

function buildDailyBriefText(user, snapshot) {
  const aaveHf = snapshot.aave.healthFactor ? snapshot.aave.healthFactor.toFixed(2) : 'N/A';
  const radiantHf = snapshot.radiant.healthFactor ? snapshot.radiant.healthFactor.toFixed(2) : 'N/A';
  const totalDebt = snapshot.totalDebtUsd.toFixed(2);
  const totalPower = snapshot.totalBorrowPowerUsd.toFixed(2);
  const utilization = snapshot.totalBorrowPowerUsd > 0
    ? ((snapshot.totalDebtUsd / snapshot.totalBorrowPowerUsd) * 100).toFixed(1)
    : '0.0';

  return (
    `ArbiLoop Daily Brief\n\n` +
    `Wallet: ${shortWallet(user.wallet_address)}\n` +
    `Aave HF: ${aaveHf}\n` +
    `Radiant HF: ${radiantHf}\n` +
    `Total Debt: $${totalDebt}\n` +
    `Borrow Power: $${totalPower}\n` +
    `Utilization: ${utilization}%`
  );
}

async function insertLiveAlert({
  chatId,
  walletAddress,
  protocol,
  severity,
  title,
  message,
  healthFactor,
  threshold,
  sentToTelegram,
  telegramError,
  metadata,
}) {
  const payload = {
    chat_id: chatId || null,
    wallet_address: walletAddress,
    chain_id: targetChain.id,
    protocol,
    severity,
    title,
    message,
    health_factor: Number.isFinite(healthFactor) ? Number(healthFactor) : null,
    threshold: Number.isFinite(threshold) ? Number(threshold) : null,
    sent_to_telegram: Boolean(sentToTelegram),
    telegram_error: telegramError || null,
    metadata: metadata || null,
  };

  const { error } = await supabase.from('liquidation_alerts').insert(payload);
  if (error) {
    console.error('insert liquidation_alerts failed:', error.message);
  }
}

async function getUserByChatId(chatId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function requireLinkedUser(ctx) {
  const chatId = getChatId(ctx);
  const user = await getUserByChatId(chatId);
  if (!user) {
    await ctx.reply(
      'No wallet linked yet.\n\nUse /id in this chat, then sign in frontend Settings, and send /verify <signature>.',
    );
    return null;
  }
  return user;
}

async function runMonitoringSweep() {
  if (monitorSweepRunning) return;
  monitorSweepRunning = true;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('chat_id, username, wallet_address, alert_threshold, polling_interval, alerts_enabled, daily_updates_enabled, last_checked, last_alert_sent, last_daily_report_sent')
      .order('chat_id', { ascending: true });

    if (error) throw error;
    if (!users || users.length === 0) return;

    const nowIso = new Date().toISOString();

    for (const user of users) {
      try {
        const wallet = toSafeAddress(user.wallet_address);
        if (!wallet) continue;
        if (!shouldCheckUserNow(user)) continue;

        const snapshot = await fetchWalletHealth(wallet);

        await supabase
          .from('users')
          .update({ last_checked: nowIso, updated_at: nowIso })
          .eq('chat_id', user.chat_id);

        if (shouldSendDailyReportNow(user)) {
          const dailyText = buildDailyBriefText(user, snapshot);
          let dailyError = null;
          try {
            await bot.telegram.sendMessage(user.chat_id, dailyText);
          } catch (error) {
            dailyError = String(error?.message || error);
            console.error(`daily report send failed for ${user.chat_id}:`, dailyError);
          }

          await insertLiveAlert({
            chatId: user.chat_id,
            walletAddress: wallet,
            protocol: 'monitor',
            severity: 'info',
            title: 'Daily Risk Briefing',
            message: dailyText,
            healthFactor: snapshot.minHealthFactor,
            threshold: Number(user.alert_threshold || ALERT_MAX),
            sentToTelegram: !dailyError,
            telegramError: dailyError,
            metadata: {
              kind: 'daily-report',
              aave: snapshot.aave,
              radiant: snapshot.radiant,
              totalDebtUsd: snapshot.totalDebtUsd,
              totalBorrowPowerUsd: snapshot.totalBorrowPowerUsd,
            },
          });

          if (!dailyError) {
            await supabase
              .from('users')
              .update({ last_daily_report_sent: nowIso, updated_at: nowIso })
              .eq('chat_id', user.chat_id);
          }
        }

        if (!user.alerts_enabled) {
          continue;
        }

        const threshold = Number(user.alert_threshold || 1.1);
        const breach = pickBreachProtocol(snapshot, threshold);
        if (!breach) continue;

        const protocolLabel = getProtocolLabel(breach.protocol);
        const severity = getSeverityFromHealth(breach.healthFactor, threshold);
        const title = severity === 'critical' ? 'Critical Liquidation Risk' : 'Liquidation Warning';
        const alertText = buildAlertText(user, protocolLabel, breach.healthFactor, threshold);

        if (!shouldSendAlertNow(user)) {
          await insertLiveAlert({
            chatId: user.chat_id,
            walletAddress: wallet,
            protocol: breach.protocol,
            severity,
            title: `${title} (cooldown)`,
            message: alertText,
            healthFactor: breach.healthFactor,
            threshold,
            sentToTelegram: false,
            telegramError: 'alert cooldown active',
            metadata: { kind: 'cooldown-hit' },
          });
          continue;
        }

        let sendError = null;
        try {
          await bot.telegram.sendMessage(user.chat_id, alertText);
        } catch (error) {
          sendError = String(error?.message || error);
          console.error(`alert send failed for ${user.chat_id}:`, sendError);
        }

        await insertLiveAlert({
          chatId: user.chat_id,
          walletAddress: wallet,
          protocol: breach.protocol,
          severity,
          title,
          message: alertText,
          healthFactor: breach.healthFactor,
          threshold,
          sentToTelegram: !sendError,
          telegramError: sendError,
          metadata: { kind: 'threshold-breach' },
        });

        if (!sendError) {
          await supabase
            .from('users')
            .update({ last_alert_sent: nowIso, updated_at: nowIso })
            .eq('chat_id', user.chat_id);
        }
      } catch (error) {
        console.error(`monitor sweep user error (${user.chat_id}):`, error?.message || error);
      }
    }
  } catch (error) {
    console.error('monitor sweep failed:', error?.message || error);
  } finally {
    monitorSweepRunning = false;
  }
}

async function runPnlIndexerSweep() {
  if (!ENABLE_PNL_INDEXER || pnlSweepRunning) return;
  pnlSweepRunning = true;

  try {
    const module = await import('../../frontend/scripts/pnl-indexer.mjs');
    if (typeof module.runPnlIndexer !== 'function') {
      throw new Error('runPnlIndexer export not found');
    }
    await module.runPnlIndexer();
  } catch (error) {
    console.error('background pnl indexer failed:', error?.message || error);
  } finally {
    pnlSweepRunning = false;
  }
}

function startBackgroundWorkers() {
  console.log(`Monitor worker started: chain=${targetChain.name} rpc=${RPC_URL}`);
  console.log(`Monitor interval=${MONITOR_TICK_MS}ms cooldown=${ALERT_COOLDOWN_MINUTES}m`);

  runMonitoringSweep().catch((error) => {
    console.error('initial monitor sweep failed:', error?.message || error);
  });
  setInterval(() => {
    runMonitoringSweep().catch((error) => {
      console.error('monitor sweep tick failed:', error?.message || error);
    });
  }, MONITOR_TICK_MS);

  if (!ENABLE_PNL_INDEXER) {
    console.log('PnL indexer worker disabled via ENABLE_PNL_INDEXER=false');
    return;
  }

  console.log(`PnL indexer worker started: interval=${PNL_INDEXER_INTERVAL_MS}ms`);
  runPnlIndexerSweep().catch((error) => {
    console.error('initial pnl indexer sweep failed:', error?.message || error);
  });
  setInterval(() => {
    runPnlIndexerSweep().catch((error) => {
      console.error('pnl indexer tick failed:', error?.message || error);
    });
  }, PNL_INDEXER_INTERVAL_MS);
}

function getProtocolLabel(protocol) {
  if (protocol === 'aave-v3') return 'Aave V3';
  if (protocol === 'radiant-v2') return 'Radiant';
  return protocol;
}

bot.start(async (ctx) => {
  const chatId = getChatId(ctx);
  await ctx.reply(
    `Welcome to ArbiLoop Bot.\n\n` +
      `Your chat ID: ${chatId}\n\n` +
      `Commands:\n` +
      `/id - show your Telegram chat id\n` +
      `/verify <signature> - link wallet\n` +
      `/status - show current settings\n` +
      `/setalert <1.0-2.0>\n` +
      `/setinterval <60|120|360|720|960|1440>\n` +
      `/togglealerts\n` +
      `/disconnect`,
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `ArbiLoop Bot Commands\n\n` +
      `/id\n` +
      `/verify <signature>\n` +
      `/status\n` +
      `/setalert <1.0-2.0>\n` +
      `/setinterval <60|120|360|720|960|1440>\n` +
      `/togglealerts\n` +
      `/disconnect`,
  );
});

bot.command('id', async (ctx) => {
  const chatId = getChatId(ctx);
  await ctx.reply(`Your Telegram chat id is: ${chatId}`);
});

bot.command('verify', async (ctx) => {
  const chatId = getChatId(ctx);
  const username = ctx.from?.username || null;
  const signature = getCommandArg(ctx);

  if (!signature) {
    await ctx.reply('Usage: /verify <signature>');
    return;
  }

  if (!/^0x[a-fA-F0-9]{128,130}$/.test(signature)) {
    await ctx.reply('Invalid signature format. It should start with 0x.');
    return;
  }

  const message = `ArbiLoop Auth: ${chatId}`;
  let recoveredWallet;

  try {
    recoveredWallet = getAddress(
      await recoverMessageAddress({
        message,
        signature,
      }),
    ).toLowerCase();
  } catch {
    await ctx.reply(
      'Signature verification failed. Use /id in this same chat, sign in Settings again, then /verify.',
    );
    return;
  }

  try {
    const dedupe = await supabase
      .from('users')
      .delete()
      .eq('wallet_address', recoveredWallet)
      .neq('chat_id', chatId);

    if (dedupe.error) throw dedupe.error;

    const upsertPayload = {
      chat_id: chatId,
      username,
      wallet_address: recoveredWallet,
      alerts_enabled: true,
      daily_updates_enabled: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(upsertPayload, { onConflict: 'chat_id' })
      .select('*')
      .single();

    if (error) throw error;

    await ctx.reply(
      `Wallet linked successfully.\n\n` +
        `Wallet: ${shortWallet(data.wallet_address)}\n` +
        `Alert Threshold: ${Number(data.alert_threshold).toFixed(1)}\n` +
        `Polling: ${data.polling_interval} minutes`,
    );
  } catch (error) {
    console.error('verify error:', error);
    await ctx.reply('Failed to save link in database. Please try again.');
  }
});

bot.command('status', async (ctx) => {
  try {
    const user = await requireLinkedUser(ctx);
    if (!user) return;

    await ctx.reply(
      `Linked Wallet: ${shortWallet(user.wallet_address)}\n` +
        `Alerts: ${user.alerts_enabled ? 'ON' : 'OFF'}\n` +
        `Daily Updates: ${user.daily_updates_enabled ? 'ON' : 'OFF'}\n` +
        `Alert Threshold: ${Number(user.alert_threshold).toFixed(1)}\n` +
        `Polling Interval: ${user.polling_interval} minutes`,
    );
  } catch (error) {
    console.error('status error:', error);
    await ctx.reply('Could not load status right now.');
  }
});

bot.command('setalert', async (ctx) => {
  const arg = getCommandArg(ctx);
  const value = Number(arg);

  if (!Number.isFinite(value) || value < ALERT_MIN || value > ALERT_MAX) {
    await ctx.reply(`Usage: /setalert <${ALERT_MIN}-${ALERT_MAX}>`);
    return;
  }

  try {
    const user = await requireLinkedUser(ctx);
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .update({ alert_threshold: value, updated_at: new Date().toISOString() })
      .eq('chat_id', user.chat_id)
      .select('alert_threshold')
      .single();

    if (error) throw error;

    await ctx.reply(`Alert threshold updated to ${Number(data.alert_threshold).toFixed(1)}.`);
  } catch (error) {
    console.error('setalert error:', error);
    await ctx.reply('Could not update alert threshold.');
  }
});

bot.command('setinterval', async (ctx) => {
  const arg = getCommandArg(ctx);
  const value = Number(arg);

  if (!Number.isInteger(value) || !ALLOWED_INTERVALS.has(value)) {
    await ctx.reply('Usage: /setinterval <60|120|360|720|960|1440>');
    return;
  }

  try {
    const user = await requireLinkedUser(ctx);
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .update({ polling_interval: value, updated_at: new Date().toISOString() })
      .eq('chat_id', user.chat_id)
      .select('polling_interval')
      .single();

    if (error) throw error;

    await ctx.reply(`Polling interval updated to ${data.polling_interval} minutes.`);
  } catch (error) {
    console.error('setinterval error:', error);
    await ctx.reply('Could not update polling interval.');
  }
});

bot.command('togglealerts', async (ctx) => {
  try {
    const user = await requireLinkedUser(ctx);
    if (!user) return;

    const next = !Boolean(user.alerts_enabled);

    const { data, error } = await supabase
      .from('users')
      .update({ alerts_enabled: next, updated_at: new Date().toISOString() })
      .eq('chat_id', user.chat_id)
      .select('alerts_enabled')
      .single();

    if (error) throw error;

    await ctx.reply(`Liquidation alerts are now ${data.alerts_enabled ? 'ON' : 'OFF'}.`);
  } catch (error) {
    console.error('togglealerts error:', error);
    await ctx.reply('Could not toggle alerts right now.');
  }
});

bot.command('disconnect', async (ctx) => {
  try {
    const chatId = getChatId(ctx);

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('chat_id', chatId);

    if (error) throw error;

    await ctx.reply('Wallet disconnected. You can relink any time with /verify.');
  } catch (error) {
    console.error('disconnect error:', error);
    await ctx.reply('Could not disconnect right now.');
  }
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text || '';
  if (text.startsWith('/')) {
    await ctx.reply('Unknown command. Use /help.');
  }
});

bot.catch(async (error, ctx) => {
  console.error('bot caught error:', error);
  try {
    await ctx.reply('Unexpected error. Please retry.');
  } catch {
    // Ignore secondary failures.
  }
});

bot.launch().then(() => {
  console.log('ArbiLoop Telegram bot started.');
  startBackgroundWorkers();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
