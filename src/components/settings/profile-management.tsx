"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useProfileStore } from "@/store/profile-store";
import { cn } from "@/lib/utils";

export function ProfileManagement() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const addProfile = useProfileStore((s) => s.addProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const renameProfile = useProfileStore((s) => s.renameProfile);
  const switchProfile = useProfileStore((s) => s.switchProfile);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProfile(newName.trim());
    setNewName("");
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameProfile(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profiles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New profile name..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button type="button" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
                  isActive
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                {editingId === p.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(p.id)}>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold",
                          isActive
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        )}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className={cn("text-sm font-medium", isActive && "text-emerald-700 dark:text-emerald-400")}>
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-400">{isActive && "Active"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => switchProfile(p.id)}
                        >
                          Switch
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEditing(p.id, p.name)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                      {profiles.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => deleteProfile(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
