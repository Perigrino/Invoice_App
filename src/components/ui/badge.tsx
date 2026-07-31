import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
        draft: "border-transparent bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 dark:from-gray-700 dark:to-gray-600 dark:text-gray-200",
        pending: "border-transparent bg-gradient-to-r from-amber-200 to-amber-300 text-amber-800 dark:from-amber-800 dark:to-amber-700 dark:text-amber-200",
        paid: "border-transparent bg-gradient-to-r from-emerald-200 to-emerald-300 text-emerald-800 dark:from-emerald-800 dark:to-emerald-700 dark:text-emerald-200",
        overdue: "border-transparent bg-gradient-to-r from-red-200 to-rose-300 text-red-800 dark:from-red-800 dark:to-rose-700 dark:text-red-200",
        cancelled: "border-transparent bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
        outline: "text-gray-950 dark:text-gray-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
