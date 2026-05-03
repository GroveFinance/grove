import React, { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/layouts/MainLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGroups } from "@/hooks/queries/useGroups";
import { useUpdateCategory } from "@/hooks/mutations/useUpdateCategory";
import { useDeleteCategory } from "@/hooks/mutations/useDeleteCategory";
import { useUpdateGroup } from "@/hooks/mutations/useUpdateGroup";
import { useDeleteGroup } from "@/hooks/mutations/useDeleteGroup";
import { useCreateGroup } from "@/hooks/mutations/useCreateGroup";
import { useCreateCategory } from "@/hooks/mutations/useCreateCategory";
import type { Category, Group } from "@/types";
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCategories, importCategories } from "@/services/api/categories";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

function DraggableCategory({ category }: { category: Category }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `cat-${category.id}`,
    data: category,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [budgetValue, setBudgetValue] = useState(category.budget?.toString() ?? "");
  const [nameValue, setNameValue] = useState(category.name);

  // Sync local state when category prop changes (for optimistic updates)
  useEffect(() => {
    setBudgetValue(category.budget?.toString() ?? "");
  }, [category.budget]);

  useEffect(() => {
    setNameValue(category.name);
  }, [category.name]);

  const handleBudgetBlur = () => {
    const newBudget = budgetValue === "" ? null : parseFloat(budgetValue);

    // Only update if value changed
    if (newBudget !== category.budget) {
      updateCategory.mutate(
        { id: category.id, data: { budget: newBudget } },
        {
          onSuccess: () => {
            toast.success("Budget updated");
          },
          onError: () => {
            toast.error("Failed to update budget");
            // Revert to original value on error
            setBudgetValue(category.budget?.toString() ?? "");
          },
        }
      );
    }
  };

  const handleNameBlur = () => {
    // Only update if value changed
    if (nameValue !== category.name && nameValue.trim() !== "") {
      updateCategory.mutate(
        { id: category.id, data: { name: nameValue.trim() } },
        {
          onSuccess: () => {
            toast.success("Category name updated");
          },
          onError: () => {
            toast.error("Failed to update category name");
            // Revert to original value on error
            setNameValue(category.name);
          },
        }
      );
    } else if (nameValue.trim() === "") {
      // Revert empty names
      setNameValue(category.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-2 border rounded-lg bg-background shadow-sm p-2"
    >
      <GripVertical
        className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing"
        {...listeners}
      />
      <Input
        className="flex-1 min-w-[120px]"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onBlur={handleNameBlur}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <Input
        inputMode="decimal"
        className="w-24 shrink-0"
        value={budgetValue}
        onChange={(e) => setBudgetValue(e.target.value)}
        onBlur={handleBudgetBlur}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="0.00"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
            deleteCategory.mutate(category.id, {
              onSuccess: () => {
                toast.success("Category deleted");
              },
              onError: () => {
                toast.error("Failed to delete category");
              },
            });
          }
        }}
        className="shrink-0"
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

function DroppableGroup({
  group,
  children,
}: {
  group: Group;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: group,
  });
  const [collapsed, setCollapsed] = useState(true); // start collapsed
  const [nameValue, setNameValue] = useState(group.name);

  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createCategory = useCreateCategory();

  useEffect(() => {
    setNameValue(group.name);
  }, [group.name]);

  const handleNameBlur = () => {
    if (nameValue !== group.name && nameValue.trim() !== "") {
      updateGroup.mutate(
        { id: group.id, data: { name: nameValue.trim() } },
        {
          onSuccess: () => {
            toast.success("Group name updated");
          },
          onError: () => {
            toast.error("Failed to update group name");
            setNameValue(group.name);
          },
        }
      );
    } else if (nameValue.trim() === "") {
      setNameValue(group.name);
    }
  };

  const handleAddCategory = () => {
    const categoryName = prompt("Enter category name:");
    if (categoryName && categoryName.trim() !== "") {
      createCategory.mutate(
        { name: categoryName.trim(), group_id: group.id, budget: 0 },
        {
          onSuccess: () => {
            toast.success("Category added");
          },
          onError: () => {
            toast.error("Failed to add category");
          },
        }
      );
    }
  };

  const handleDeleteGroup = () => {
    if (group.categories.length > 0) {
      toast.error("Cannot delete group with categories. Delete all categories first.");
      return;
    }
    if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
      deleteGroup.mutate(group.id, {
        onSuccess: () => {
          toast.success("Group deleted");
        },
        onError: () => {
          toast.error("Failed to delete group");
        },
      });
    }
  };

  return (
    <Card
      ref={setNodeRef}
      className={`transition-colors min-w-[320px] ${
        isOver ? "border-primary border-2" : ""
      }`}
    >
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Input
            className="flex-1 min-w-[150px]"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
          />
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleAddCategory}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDeleteGroup}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="flex flex-col gap-2">{children}</CardContent>
      )}
    </Card>
  );
}

const CATEGORIES_VISITED_KEY = "grove_categories_visited";

export default function SettingsPage() {
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const updateCategory = useUpdateCategory();
  const queryClient = useQueryClient();

  // Import/Export state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Mark categories page as visited for onboarding progress
  useEffect(() => {
    localStorage.setItem(CATEGORIES_VISITED_KEY, "true");
  }, []);

  // Export handler
  const handleExport = async () => {
    try {
      const blob = await exportCategories();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Categories exported successfully');
    } catch (error) {
      toast.error('Failed to export categories');
      console.error(error);
    }
  };

  // File selection handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('Please select a JSON file');
        return;
      }
      setSelectedFile(file);
      setShowImportDialog(true);
    }
    event.target.value = '';
  };

  // Import handler
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      const result = await importCategories(selectedFile, importMode);

      // Build summary message
      const messages = [];
      if (result.groups_created > 0) {
        messages.push(`Groups created: ${result.groups_created}`);
      }
      if (result.categories_created > 0) {
        messages.push(`Categories created: ${result.categories_created}`);
      }
      if (result.categories_updated > 0) {
        messages.push(`Categories updated: ${result.categories_updated}`);
      }
      if (result.categories_skipped > 0) {
        messages.push(`Categories skipped: ${result.categories_skipped}`);
      }

      toast.success(`Import complete! ${messages.join(', ')}`);

      // Show warnings and errors
      result.warnings.forEach(warning => toast.warning(warning));
      result.errors.forEach(error => toast.error(error));

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['groups'] });

      setShowImportDialog(false);
      setSelectedFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (over && active && active.data?.current && over.data?.current) {
      const cat = active.data.current as Category;
      const targetGroup = over.data.current as Group;

      // Only update if the category is being moved to a different group
      if (cat.id && targetGroup.id) {
        updateCategory.mutate(
          { id: cat.id, data: { group_id: targetGroup.id } },
          {
            onSuccess: () => {
              toast.success(`Moved "${cat.name}" to "${targetGroup.name}"`);
            },
            onError: () => {
              toast.error("Failed to move category");
            },
          }
        );
      }
    }
  };

  const handleAddGroup = () => {
    const groupName = prompt("Enter group name:");
    if (groupName && groupName.trim() !== "") {
      createGroup.mutate(
        { name: groupName.trim() },
        {
          onSuccess: () => {
            toast.success("Group added");
          },
          onError: () => {
            toast.error("Failed to add group");
          },
        }
      );
    }
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Group & Category Settings</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={handleAddGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {groups?.map((group) => (
            <DroppableGroup key={group.id} group={group}>
              {group.categories.map((cat) => (
                <DraggableCategory key={cat.id} category={cat} />
              ))}
            </DroppableGroup>
          ))}
        </div>
      </DndContext>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Categories & Groups</DialogTitle>
            <DialogDescription>
              Choose how to handle existing categories and groups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Select value={importMode} onValueChange={(v) => setImportMode(v as 'merge' | 'overwrite')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">
                  <div className="space-y-1">
                    <div className="font-medium">Add New Only</div>
                    <div className="text-xs text-muted-foreground">
                      Skip items that already exist (matched by name, case-insensitive)
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="overwrite">
                  <div className="space-y-1">
                    <div className="font-medium">Update Existing</div>
                    <div className="text-xs text-muted-foreground">
                      Update budgets and group assignments, create new items
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
