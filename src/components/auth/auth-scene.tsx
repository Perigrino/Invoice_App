import { Send } from "lucide-react";

function ReceiptCard({ className }: { className?: string }) {
  return (
    <div
      className={`auth-receipt absolute w-24 rounded-xl bg-white/75 p-3 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-100 dark:bg-white/10 dark:ring-white/10 ${className ?? ""}`}
    >
      <div className="mb-2 h-1.5 w-10 rounded-full bg-emerald-500/80" />
      <div className="space-y-1">
        <div className="h-1 w-full rounded-full bg-gray-300/80 dark:bg-white/25" />
        <div className="h-1 w-4/5 rounded-full bg-gray-300/80 dark:bg-white/25" />
        <div className="h-1 w-3/5 rounded-full bg-gray-300/80 dark:bg-white/25" />
        <div className="h-1 w-2/5 rounded-full bg-gray-300/80 dark:bg-white/25" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="h-2 w-6 rounded-full bg-violet-500/70" />
        <div className="h-1.5 w-8 rounded-full bg-emerald-500/80" />
      </div>
    </div>
  );
}

function Coin({
  symbol,
  from,
  to,
  ring,
  text,
  size = "h-10 w-10",
  className,
}: {
  symbol: string;
  from: string;
  to: string;
  ring: string;
  text: string;
  size?: string;
  className?: string;
}) {
  return (
    <div
      className={`auth-coin absolute flex items-center justify-center rounded-full bg-gradient-to-br shadow-lg ring-2 ${size} ${from} ${to} ${ring} ${className ?? ""}`}
    >
      <span className={`text-sm font-extrabold ${text}`}>{symbol}</span>
    </div>
  );
}

export function AuthScene() {
  return (
    <div
      aria-hidden
      className="auth-scene pointer-events-none absolute inset-0 z-0 select-none"
    >
      <div
        className="auth-doc-silhouette absolute left-1/2 top-1/2 h-72 w-56 -ml-36 -mt-40 rounded-2xl border-2 border-dashed border-emerald-400/25 bg-emerald-400/10 dark:border-emerald-400/20 dark:bg-emerald-400/5"
      />

      <ReceiptCard className="left-[6%] top-[16%] hidden sm:block" />
      <ReceiptCard className="right-[6%] bottom-[14%] hidden sm:block" />
      <ReceiptCard className="left-[13%] bottom-[24%] hidden sm:block" />
      <ReceiptCard className="right-[9%] top-[8%] hidden lg:block" />

      <Coin
        symbol="$"
        from="from-amber-300/60"
        to="to-amber-500/60"
        ring="ring-amber-200/60 dark:ring-amber-300/30"
        text="text-amber-700 dark:text-amber-300"
        size="h-9 w-9"
        className="left-[8%] top-[26%]"
      />
      <Coin
        symbol="%"
        from="from-violet-400/50"
        to="to-violet-600/50"
        ring="ring-violet-300/50 dark:ring-violet-400/20"
        text="text-violet-800 dark:text-violet-300"
        size="h-10 w-10"
        className="left-[18%] bottom-[10%]"
      />
      <Coin
        symbol="€"
        from="from-emerald-400/50"
        to="to-teal-600/50"
        ring="ring-emerald-300/50 dark:ring-emerald-400/20"
        text="text-emerald-800 dark:text-emerald-300"
        size="h-8 w-8"
        className="right-[6%] bottom-[8%]"
      />
      <Coin
        symbol="¥"
        from="from-teal-400/50"
        to="to-cyan-600/50"
        ring="ring-teal-300/50 dark:ring-teal-400/20"
        text="text-teal-800 dark:text-teal-300"
        size="h-9 w-9"
        className="right-[14%] top-[18%]"
      />

      <span className="auth-glyph absolute left-[22%] top-[6%] hidden text-5xl font-black text-emerald-500/40 dark:text-emerald-400/40 sm:block">
        $
      </span>
      <span className="auth-glyph absolute right-[20%] bottom-[36%] hidden text-4xl font-black text-violet-500/40 dark:text-violet-400/40 sm:block">
        %
      </span>
      <span className="auth-glyph absolute left-[5%] top-[46%] hidden text-3xl font-black text-amber-500/35 dark:text-amber-400/35 sm:block">
        £
      </span>
      <span className="auth-glyph absolute right-[26%] top-[6%] hidden text-3xl font-black text-teal-500/40 dark:text-teal-400/40 sm:block">
        €
      </span>
      <span className="auth-glyph absolute left-[30%] top-[28%] text-2xl font-black text-violet-500/30 dark:text-violet-400/30">
        ¥
      </span>
      <span className="auth-glyph absolute right-[11%] bottom-[42%] text-2xl font-black text-emerald-500/35 dark:text-emerald-400/35">
        ¢
      </span>
      <span className="auth-glyph absolute left-[9%] top-[10%] text-xl font-black text-teal-500/30 dark:text-teal-400/30">
        $
      </span>

      <Send className="auth-paper-plane absolute left-0 top-[28%] h-6 w-6 text-emerald-500/80" />

      <div className="auth-dot absolute left-[28%] top-[72%] h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
      <div className="auth-dot absolute right-[28%] top-[58%] h-1.5 w-1.5 rounded-full bg-violet-500/70" style={{ animationDelay: "2.5s" }} />
      <div className="auth-dot absolute left-[14%] top-[30%] h-1.5 w-1.5 rounded-full bg-amber-500/70" style={{ animationDelay: "5s" }} />
      <div className="auth-dot absolute right-[12%] top-[36%] h-1.5 w-1.5 rounded-full bg-teal-500/70" style={{ animationDelay: "7s" }} />
      <div className="auth-dot absolute left-[36%] top-[18%] h-1.5 w-1.5 rounded-full bg-emerald-500/60" style={{ animationDelay: "9s" }} />
    </div>
  );
}
