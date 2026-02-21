'use client';

import dynamic from 'next/dynamic';

const Settings = dynamic(() => import("@/components/Settings"), { ssr: false });

export default function SettingsPage() {
    return (
        <div className="pt-20 md:pt-24 min-h-screen bg-[#0B0B0F] text-foreground">
            <div className="container mx-auto px-4 max-w-4xl">
                <Settings />
            </div>
        </div>
    );
}
