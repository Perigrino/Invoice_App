"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  return (
    <tr className="group border-b border-gray-100 dark:border-gray-800">
      <td className="px-2 py-2">
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
      <td className="px-2 py-2">
        <Input
          type="number"
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
      <td className="px-2 py-2">
        <Input
          type="number"
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
      <td className="px-2 py-2 text-right">
        <span className="text-sm font-medium">
          {lineTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} {currency}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(item.id)}
            className="h-7 w-7"
            title="Duplicate item"
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
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
