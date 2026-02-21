import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';

function loadEnv(file) {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  const env = loadEnv(envPath);
  const vault = env.NEXT_PUBLIC_LOOP_VAULT_ADDRESS;
  const privateKey = env.PRIVATE_KEY;
  const deployHash = env.LOOP_VAULT_DEPLOY_TX_HASH;

  if (!vault || !privateKey) {
    throw new Error('Missing NEXT_PUBLIC_LOOP_VAULT_ADDRESS or PRIVATE_KEY in .env.local');
  }

  const rpcCandidates = [
    env.ARBITRUM_RPC_URL,
    env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
    'https://rpc.ankr.com/arbitrum',
  ].filter(Boolean);

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);

  let publicClient;
  let selectedRpc;
  for (const rpc of rpcCandidates) {
    try {
      const client = createPublicClient({ chain: arbitrum, transport: http(rpc, { timeout: 12_000 }) });
      await client.getBlockNumber();
      publicClient = client;
      selectedRpc = rpc;
      break;
    } catch {}
  }

  if (!publicClient) throw new Error('Could not connect to any Arbitrum RPC');

  const VAULT_ABI = parseAbi([
    'function owner() view returns (address)',
    'function pool() view returns (address)',
    'function leverageAave(address inputToken,address supplyAsset,address borrowAsset,uint256 amount,uint256 legacyExtraAmount,uint256 borrowAmount,address legacyRouteHint) payable',
    'function setOwner(address newOwner)',
  ]);

  const vaultAddr = getAddress(vault);
  const [chainId, code, owner, pool, balance] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBytecode({ address: vaultAddr }),
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'owner' }),
    publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'pool' }),
    publicClient.getBalance({ address: account.address }),
  ]);

  console.log('RPC:', selectedRpc);
  console.log('chainId:', chainId);
  console.log('vault:', vaultAddr);
  console.log('vault bytecode present:', !!code && code !== '0x');
  console.log('owner:', owner);
  console.log('pool:', pool);
  console.log('deployer key matches owner:', owner.toLowerCase() === account.address.toLowerCase());
  console.log('wallet balance ETH:', formatEther(balance));

  if (deployHash) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: deployHash });
      console.log('deploy tx status:', receipt.status);
      console.log('deploy tx contract:', receipt.contractAddress);
    } catch {
      console.log('deploy receipt lookup: skipped/unavailable');
    }
  } else {
    console.log('deploy receipt lookup: skipped (no LOOP_VAULT_DEPLOY_TX_HASH)');
  }

  try {
    await publicClient.estimateContractGas({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: 'leverageAave',
      args: [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
        0n,
        0n,
        0n,
        '0x0000000000000000000000000000000000000000',
      ],
      account: account.address,
      value: 0n,
    });
    console.log('guard check: unexpected success');
  } catch (err) {
    const msg = String(err?.shortMessage || err?.message || err);
    console.log('guard check revert:', msg.includes('bad amount') ? 'bad amount (expected)' : msg.slice(0, 160));
  }

  try {
    await publicClient.simulateContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: 'setOwner',
      args: [owner],
      account,
    });
    console.log('owner-only simulate: ok');
  } catch {
    console.log('owner-only simulate: failed');
  }
}

main().catch((err) => {
  console.error('smoke test failed:', err?.message || err);
  process.exit(1);
});
