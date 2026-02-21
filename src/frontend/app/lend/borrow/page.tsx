'use client';

import { Suspense } from 'react';
import { BorrowTable } from "@/components/BorrowTable";
import { Loader2, Info } from 'lucide-react';

export default function BorrowPage() {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Section Title */}
            <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-white">Available Markets</h2>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-100/80 text-sm leading-relaxed font-medium">
                    You must deposit collateral in the <span className="text-blue-400 font-bold">"Earn"</span> section required by the protocol before you can borrow.
                </p>
            </div>

            {/* Table */}
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                <BorrowTable />
            </Suspense>
        </div>
    );
}
