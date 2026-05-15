import CustomerPaymentMethodsClient from "@/components/ui/CustomerPaymentMethodsClient";
import { CreditCard } from "lucide-react";

export default function CustomerPaymentMethodsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <CreditCard className="w-7 h-7 text-tarea-sky" />
          <h1 className="text-3xl font-extrabold text-white">Payment Methods</h1>
        </div>
        <p className="text-slate-400">
          Save a card for faster checkout when booking handymen.
        </p>
      </div>
      <CustomerPaymentMethodsClient />
    </div>
  );
}
