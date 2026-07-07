import type { Metadata } from "next";
import { PublicAskPanel } from "@/components/PublicAskPanel";
import { HeartPulse } from "lucide-react";

export const metadata: Metadata = {
  title: "Citizen Services — SwasthyaGrid AI",
  description:
    "Get instant emergency first-aid guidance (108 routing) and find the nearest PHC or hospital using your GPS coordinates.",
};

export default function CitizenServicesPage() {
  return (
    <div className="flex flex-col h-full bg-paper">
      {/* Header */}
      <div className="px-8 py-6 border-b border-hairline bg-paper-dim">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-clay/10 text-accent-clay rounded-full">
            <HeartPulse size={24} />
          </div>
          <div>
            <h1 className="font-serif-display text-2xl text-ink font-semibold">
              Citizen Services
            </h1>
            <p className="text-ink-soft mt-1">
              Find nearby health centres, get emergency guidance, and check availability.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-8 relative">
        <div className="w-full max-w-3xl flex-1 flex flex-col bg-paper-dim/30 border border-hairline rounded-lg overflow-hidden shadow-sm">
          <PublicAskPanel />
        </div>
      </div>
    </div>
  );
}
