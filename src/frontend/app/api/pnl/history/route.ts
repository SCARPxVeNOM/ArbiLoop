import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function isValidAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseChainId(value: string | null) {
  if (!value) return 42161;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 42161;
}

function parseDays(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return 30;
  if (parsed < 1) return 1;
  if (parsed > 365) return 365;
  return parsed;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const wallet = (request.nextUrl.searchParams.get('wallet') || '').trim().toLowerCase();
  const chainId = parseChainId(request.nextUrl.searchParams.get('chainId'));
  const days = parseDays(request.nextUrl.searchParams.get('days'));

  if (!wallet || !isValidAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet parameter' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase environment variables are not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const { data: dailyRows, error: dailyError } = await supabase
    .from('wallet_pnl_daily')
    .select('day, realized_pnl_usd, cumulative_realized_pnl_usd, event_count')
    .eq('wallet_address', wallet)
    .eq('chain_id', chainId)
    .gte('day', cutoffDay)
    .order('day', { ascending: true });

  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  const { data: positionRows, error: positionError } = await supabase
    .from('wallet_pnl_positions')
    .select('protocol, asset_address, asset_symbol, principal_usd, realized_pnl_usd, total_deposit_usd, total_withdraw_usd')
    .eq('wallet_address', wallet)
    .eq('chain_id', chainId)
    .order('realized_pnl_usd', { ascending: false });

  if (positionError) {
    return NextResponse.json({ error: positionError.message }, { status: 500 });
  }

  const points = (dailyRows || []).map((row) => ({
    day: String(row.day),
    realizedDailyUsd: toNumber(row.realized_pnl_usd),
    cumulativeRealizedUsd: toNumber(row.cumulative_realized_pnl_usd),
    eventCount: Number(row.event_count || 0),
  }));

  const summary = {
    totalRealizedUsd: (positionRows || []).reduce((sum, row) => sum + toNumber(row.realized_pnl_usd), 0),
    activePrincipalUsd: (positionRows || []).reduce((sum, row) => sum + toNumber(row.principal_usd), 0),
    totalDepositedUsd: (positionRows || []).reduce((sum, row) => sum + toNumber(row.total_deposit_usd), 0),
    totalWithdrawnUsd: (positionRows || []).reduce((sum, row) => sum + toNumber(row.total_withdraw_usd), 0),
    trackedAssets: positionRows?.length || 0,
  };

  return NextResponse.json(
    {
      wallet,
      chainId,
      days,
      points,
      positions: positionRows || [],
      summary,
      indexed: points.length > 0 || (positionRows?.length || 0) > 0,
    },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}
