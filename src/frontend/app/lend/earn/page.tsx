'use client';

import { Suspense } from 'react';
import { EarnTable } from "@/components/EarnTable";
import { LendHeader } from "@/components/LendHeader";
import { Loader2, HelpCircle } from 'lucide-react';
import { InfoModal } from "@/components/InfoModal";
import { useState } from 'react';

export default function EarnPage() {
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Info Modal */}
            <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

            {/* Header / Metrics */}
            <LendHeader />

            {/* Section Title */}
            <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-white">Earn Interest on Your Crypto</h2>
            </div>
            <p className="text-muted-foreground mb-8 flex items-center flex-wrap gap-2 text-sm">
                Passively get yield using ArbiLoop Lend.
                <span
                    onClick={() => setIsInfoModalOpen(true)}
                    className="text-emerald-400 flex items-center gap-1.5 font-bold cursor-pointer hover:underline transition-all"
                >
                    How it works <HelpCircle className="w-4 h-4" />
                </span>
            </p>

            {/* Table */}
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                <EarnTable />
            </Suspense>
        </div>
    );
}

