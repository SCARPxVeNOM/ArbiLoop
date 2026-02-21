import Link from 'next/link';
import { LandingCTA } from "@/components/LandingCTA";
import { Button } from "@/components/ui/button";
import { TopLoops } from "@/components/TopLoops";
import { RiskMonitor } from "@/components/RiskMonitor";
import { LiquidationAlerts } from "@/components/LiquidationAlerts";
import { ArrowRight, BarChart3, Bot, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden">

      {/* Background Gradients (Hidden on Mobile) */}
      <div className="fixed inset-0 pointer-events-none hidden md:block">
        {/* Top Right - Primary Lime Glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#CEFF00]/15 rounded-full blur-[120px]"></div>
        {/* Bottom Left - Emerald Glow (Safe Theme) */}
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        {/* Center Left - Subtle Lime/Emerald Mix for depth */}
        <div className="absolute top-[30%] left-[-10%] w-[500px] h-[500px] bg-[#CEFF00]/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 pt-24 md:pt-32 pb-20">
        <div className="container max-w-screen-2xl mx-auto px-3 md:px-16">

          {/* Hero Section */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-16 md:mb-32">
            <div className="space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[#CEFF00]/10 border border-[#CEFF00]/20 text-[#CEFF00] text-xs md:text-sm font-bold tracking-wide">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CEFF00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-[#CEFF00]"></span>
                </span>
                Live on Arbitrum
              </div>

              <h1 className="text-4xl md:text-7xl font-bold font-outfit leading-[1.1]">
                Your Personal <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#CEFF00] to-emerald-400">
                  AI Risk Agent
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                Stop staring at charts. Let our autonomous AI agent monitor your DeFi health 24/7.
                Get "Good Vibes Only" with automated risk alerts and stress-free yield optimization.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <LandingCTA />
              </div>

              <div className="pt-8 flex items-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Powered By</span>
                <div className="h-8 w-auto flex items-center gap-2 font-bold text-xl">Aave</div>
                <div className="h-8 w-auto flex items-center gap-2 font-bold text-xl">Radiant</div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative h-auto lg:h-[400px] perspective-1000 mt-8 lg:mt-0">
              <div className="relative lg:absolute lg:top-10 lg:right-0 w-full max-w-md mx-auto transform hover:scale-105 transition-transform duration-500">
                <RiskMonitor />
              </div>
            </div>
          </div>

          {/* New Interactive Section (Strategy Builder & Top Loops) */}
          <div className="space-y-16 md:space-y-24 mb-16 md:mb-32">

            {/* Top Loops Section */}


            {/* Top Loops */}
            <div>
              <div>
                <TopLoops maxItems={4} showFilters={false} />
              </div>
            </div>

            {/* Risk Management Center */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold tracking-wide">
                  <ShieldCheck size={16} />
                  Advanced Safety Protocols
                </div>
                <h2 className="text-4xl font-bold font-outfit">Never Get Liquidated.</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  ArbiLoop's "God Mode" AI Agent monitors your Health Factor across every protocol in real-time.
                  Sleep soundly knowing an autonomous guardian is watching your positions.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    'Real-time Health Factor monitoring across chains',

                    'Telegram Liquidation Alerts',
                    'Strategy planner to evaluate loop risk before execution'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-bold text-white/80">
                      <div className="h-6 w-6 rounded-full bg-[#CEFF00]/20 flex items-center justify-center text-[#CEFF00]">
                        <Zap size={14} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative">
                {/* Visual Composition */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-purple-500/10 to-blue-500/10 blur-[100px] rounded-full -z-10"></div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2 transform hover:scale-[1.02] transition-transform duration-500">

                  </div>
                  <div className="md:col-span-2 transform hover:scale-[1.02] transition-transform duration-500 delay-100">
                    {/* Placeholder for LiquidationAlerts - need to import it first */}
                    <LiquidationAlerts />
                  </div>
                </div>
              </div>
            </div>

          </div>


          {/* Features Section */}
          <div className="py-16 md:py-32 border-t border-white/5">
            <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
              <h2 className="text-4xl font-bold font-outfit">Good Vibes Only.</h2>
              <p className="text-muted-foreground text-lg">
                We stripped away the complexity of DeFi and built a stress-free interface powered by AI.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'AI Agent Monitoring',
                  desc: 'Our intelligent Telegram bot keeps a 24/7 watch on the blockchain and your portfolio, acting as your personal AI risk manager.',
                  icon: <Bot className="text-[#CEFF00]" size={32} />,
                  bg: 'bg-[#CEFF00]/5'
                },
                {
                  title: 'Real-Time Analytics',
                  desc: 'Track your Net Worth, APY, and Health Factor across all protocols in one unified dashboard.',
                  icon: <BarChart3 className="text-emerald-400" size={32} />,
                  bg: 'bg-emerald-400/5'
                },
                {
                  title: 'Non-Custodial Security',
                  desc: 'You own your keys. Our Smart Wallet architecture gives you power without giving up control.',
                  icon: <ShieldCheck className="text-purple-400" size={32} />,
                  bg: 'bg-purple-400/5'
                }
              ].map((feature, i) => (
                <div key={i} className={`p-8 rounded-3xl border border-white/5 ${feature.bg} hover:bg-white/5 transition-all duration-300 hover:-translate-y-2`}>
                  <div className="h-14 w-14 rounded-2xl bg-[#0B0B0F] border border-white/10 flex items-center justify-center mb-6 shadow-lg">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Steps Section */}
          <div className="py-20 bg-gradient-to-b from-transparent to-[#CEFF00]/5 rounded-[3rem] border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#0B0B0F]/80 backdrop-blur-sm -z-10"></div>
            <div className="container max-w-4xl mx-auto px-8">
              <h2 className="text-4xl font-bold font-outfit text-center mb-16">
                Start Earning in 3 Easy Steps
              </h2>

              <div className="space-y-12 relative">
                {/* Line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#CEFF00] to-transparent md:hidden"></div>

                {[
                  { step: '01', title: 'Connect Wallet', desc: 'Link your MetaMask, TrustWallet, or any Web3 wallet securely.' },
                  { step: '02', title: 'Link Telegram', desc: 'Set up alerts to get notified when your Health Factor drops.' },
                  { step: '03', title: 'Monitor & Manage', desc: 'Track positions across Aave and Radiant. Take action when needed.' }
                ].map((s, i) => (
                  <div key={i} className="flex gap-8 items-start relative">
                    <div className="h-14 w-14 shrink-0 rounded-full bg-[#CEFF00] text-black font-bold text-xl flex items-center justify-center shadow-[0_0_15px_rgba(206,255,0,0.5)] z-10">
                      {s.step}
                    </div>
                    <div className="pt-2">
                      <h3 className="text-2xl font-bold mb-2">{s.title}</h3>
                      <p className="text-muted-foreground text-lg">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="py-16 md:py-32 text-center">
            <h2 className="text-5xl font-bold font-outfit mb-8">Ready to Optimize?</h2>
            <Link href="/dashboard">
              <Button className="h-16 px-12 text-xl font-bold bg-[#CEFF00] text-black hover:bg-[#b8e600] rounded-full shadow-[0_0_30px_rgba(206,255,0,0.4)] transition-all hover:scale-105">
                Launch ArbiLoop <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}

