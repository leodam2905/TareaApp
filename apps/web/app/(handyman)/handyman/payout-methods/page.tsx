import PayoutMethodsClient from "@/components/ui/PayoutMethodsClient";
import { Wallet } from "lucide-react";

export default function PayoutMethodsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Wallet className="w-7 h-7 text-tarea-sky" />
          <h1 className="text-3xl font-extrabold text-white">Payout Methods</h1>
        </div>
        <p className="text-slate-400">
          Add your debit card to cash out instantly once a payment clears, and your bank account for weekly automatic transfers.
        </p>
      </div>

      <PayoutMethodsClient />
    </div>
  );
}
