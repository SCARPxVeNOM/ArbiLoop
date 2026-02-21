import { LendInternalNavbar } from "@/components/LendInternalNavbar";

export default function LendLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="pt-20 min-h-screen bg-[#0B0B0F] text-foreground">
            <div className="container pt-0 pb-12 space-y-4 max-w-screen-2xl mx-auto px-3 md:px-16">
                <div className="flex flex-col items-center justify-center text-center">
                    {/* Navigation Tabs */}
                    <LendInternalNavbar />
                </div>

                {/* Page Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </div>
        </div>
    );
}
