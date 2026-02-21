import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import { getAddress, recoverMessageAddress } from 'viem';

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

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
      'No wallet linked yet.\n\nUse /id in this chat, then sign in frontend Settings, and send /verify <signature>.'
    );
    return null;
  }
  return user;
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
      `/disconnect`
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
      `/disconnect`
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
      })
    ).toLowerCase();
  } catch (error) {
    await ctx.reply(
      'Signature verification failed. Use /id in this same chat, sign in Settings again, then /verify.'
    );
    return;
  }

  try {
    // Keep one row per wallet to avoid frontend .single() collisions.
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
        `Polling: ${data.polling_interval} minutes`
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
        `Polling Interval: ${user.polling_interval} minutes`
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
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
