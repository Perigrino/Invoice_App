"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Copy, GripVertical } from "lucide-react";
import type { LineItem } from "@/types";

interface LineItemRowProps {
  item: LineItem;
  index: number;
  currency: string;
  onUpdate: (id: string, data: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function LineItemRow({
  item,
  index,
  currency,
  onUpdate,
  onRemove,
  onDuplicate,
}: LineItemRowProps) {
  const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
  const formattedTotal =
    lineTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <tr className="group border-b border-gray-100 dark:border-gray-800">
      <td className="hidden px-2 py-2 md:table-cell">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-gray-300 opacity-0 group-hover:opacity-100" />
          <span className="text-sm text-gray-500 w-6">{index + 1}</span>
          <Input
            value={item.description}
            onChange={(e) =>
              onUpdate(item.id, { description: e.target.value })
            }
            placeholder="Item description"
            className="h-8 min-w-[200px]"
          />
        </div>
      </td>
      <td className="hidden px-2 py-2 md:table-cell">
        <Input
          type="number"
          inputMode="decimal"
          value={item.price === 0 ? "" : item.price}
          onChange={(e) =>
            onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })
          }
          placeholder="0.00"
          className="h-8 w-24 text-right"
          min="0"
          step="0.01"
        />
      </td>
      <td className="hidden px-2 py-2 md:table-cell">
        <Input
          type="number"
          inputMode="decimal"
          value={item.quantity === 0 ? "" : item.quantity}
          onChange={(e) =>
            onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })
          }
          placeholder="1"
          className="h-8 w-20 text-right"
          min="1"
          step="1"
        />
      </td>
      <td className="hidden px-2 py-2 text-right md:table-cell">
        <span className="text-sm font-medium">
          {formattedTotal} {currency}
        </span>
      </td>
      <td className="hidden px-2 py-2 md:table-cell">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(item.id)}
            className="h-7 w-7"
            title="Duplicate item"
            aria-label="Duplicate item"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.id)}
            className="h-7 w-7 text-red-500 hover:text-red-600"
            title="Remove item"
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
      <td colSpan={6} className="px-2 py-2 md:hidden">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-sm font-medium text-gray-500">
              {index + 1}
            </span>
            <Input
              value={item.description}
              onChange={(e) =>
                onUpdate(item.id, { description: e.target.value })
              }
              placeholder="Item description"
              className="h-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(item.id)}
              className="h-10 w-10 shrink-0"
              title="Duplicate item"
              aria-label="Duplicate item"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(item.id)}
              className="h-10 w-10 shrink-0 text-red-500 hover:text-red-600"
              title="Remove item"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-gray-400">
                Price
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={item.price === 0 ? "" : item.price}
                onChange={(e) =>
                  onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="h-10 text-right"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-gray-400">
                Qty
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={item.quantity === 0 ? "" : item.quantity}
                onChange={(e) =>
                  onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })
                }
                placeholder="1"
                className="h-10 text-right"
                min="1"
                step="1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-gray-400">
                Total
              </Label>
              <p className="flex h-10 items-center justify-end text-sm font-semibold text-gray-900 dark:text-gray-50">
                {formattedTotal} {currency}
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
