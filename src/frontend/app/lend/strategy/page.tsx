'use client';

import { Suspense } from 'react';
import { TopLoops } from "@/components/TopLoops";
import { Loader2 } from 'lucide-react';

function StrategyContent() {
    return (
        <div className="space-y-8">
            {/* Strategy Cards Section */}
            <div className="md:bg-[#0f0f12] md:border md:border-white/5 md:rounded-2xl md:p-6 min-h-[60vh]">
                <TopLoops compact={false} maxItems={20} showFilters={true} />
            </div>
        </div>
    );
}

export default function StrategyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <StrategyContent />
        </Suspense>
    );
}
