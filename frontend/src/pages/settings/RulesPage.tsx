import { MainLayout } from "@/layouts/MainLayout";
import { AsyncRenderer } from "@/components/ui/AsyncRenderer";
import { useGroups } from "@/hooks/queries/useGroups";
import { usePayees } from "@/hooks/queries/usePayees";
import { useUpdatePayee } from "@/hooks/mutations/useUpdatePayee";
import { useNavigate } from "react-router-dom";
import { subMonths, startOfMonth, endOfDay, lastDayOfMonth } from "date-fns";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ArrowUp, ArrowDown, Download, Upload } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import CategoryCombobox from "@/components/ui/CategoryCombobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import MatchFilterInput, { matchesFilter, type MatchType } from "@/components/ui/MatchFilterInput";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { exportPayees, importPayees } from "@/services/api/payee";
import { useQueryClient } from "@tanstack/react-query";

export default function PayeesPage() {
  const navigate = useNavigate();
  const { data: groups, isLoading: loadingGroups } = useGroups();
  const { data: payees, isLoading: loadingPayees } = usePayees({ excludeInvestment: true });
  const updatePayee = useUpdatePayee();
  const queryClient = useQueryClient();

  const [payeeFilter, setPayeeFilter] = useState("");
  const [hideWithCategory, setHideWithCategory] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "count">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [matchType, setMatchType] = useState<MatchType>("contains");

  // Import/Export state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Export handler
  const handleExport = async () => {
    try {
      const blob = await exportPayees();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payees_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Payees exported successfully');
    } catch (error) {
      toast.error('Failed to export payees');
      console.error(error);
    }
  };

  // File selection handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setShowImportDialog(true);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Import handler
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      const result = await importPayees(selectedFile, importMode);

      // Build summary message
      const messages = [];
      if (result.payees_created > 0) {
        messages.push(`Created: ${result.payees_created}`);
      }
      if (result.payees_updated > 0) {
        messages.push(`Updated: ${result.payees_updated}`);
      }
      if (result.payees_skipped > 0) {
        messages.push(`Skipped: ${result.payees_skipped}`);
      }

      toast.success(`Import complete! ${messages.join(', ')}`);

      // Show warnings if any
      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => toast.warning(warning));
      }

      // Show errors if any
      if (result.errors.length > 0) {
        result.errors.forEach(error => toast.error(error));
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['payees'] });

      setShowImportDialog(false);
      setSelectedFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPayees = useMemo(() => {
    if (!payees) return [];

    const filtered = payees.filter((payee) => {
      // Filter by payee name
      if (!matchesFilter(payee.name, payeeFilter, matchType)) {
        return false;
      }

      // Hide if has default category set
      if (hideWithCategory && payee.category_id !== 0) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "count") {
        comparison = (a.transaction_count ?? 0) - (b.transaction_count ?? 0);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [payees, payeeFilter, hideWithCategory, sortBy, sortDirection, matchType]);

  return (
    <MainLayout title="Payees">
      <AsyncRenderer
        isLoading={loadingGroups || loadingPayees}
        error={null}
        noData={
          !loadingGroups && !loadingPayees && !payees?.length
            ? "No payees found."
            : null
        }
        data={payees}
      >
        {() => (
          <div className="space-y-4">
            {/* Import/Export Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <MatchFilterInput
                value={payeeFilter}
                onChange={setPayeeFilter}
                placeholder="Filter by payee name..."
                className="flex-1 max-w-sm"
                matchType={matchType}
                onMatchTypeChange={setMatchType}
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hideWithCategory"
                  checked={hideWithCategory}
                  onCheckedChange={(checked) => setHideWithCategory(checked === true)}
                />
                <Label
                  htmlFor="hideWithCategory"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Hide rows with default category
                </Label>
              </div>
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2/5">
                  <button
                    onClick={() => {
                      if (sortBy === "name") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("name");
                        setSortDirection("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Payee
                    {sortBy === "name" && (
                      sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-1/5">
                  <button
                    onClick={() => {
                      if (sortBy === "count") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("count");
                        setSortDirection("desc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    # Transactions
                    {sortBy === "count" && (
                      sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-2/5">Default Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayees?.map((payee, index) => {
                const currentCategory =
                  groups
                    ?.flatMap((g) => g.categories)
                    .find((c) => c.id === payee.category_id) ?? null;

                return (
                  <TableRow
                    key={payee.id}
                    className={index % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}
                  >
                    <TableCell>
                      <button
                        onClick={() => {
                          const today = new Date();
                          const startDate = startOfMonth(subMonths(today, 11)); // 12 months including current
                          const endDate = endOfDay(lastDayOfMonth(today));
                          navigate(`/transactions?payee_name=${encodeURIComponent(payee.name)}&transacted_start=${startDate.toISOString()}&transacted_end=${endDate.toISOString()}`);
                        }}
                        className="text-left hover:underline hover:text-primary transition-colors cursor-pointer"
                      >
                        {payee.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payee.transaction_count.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <CategoryCombobox
                        //groups={groups ?? []}
                        selectedId={currentCategory?.id ?? null}
                        onChange={(val) =>
                          updatePayee.mutate({
                            id: payee.id,
                            data: { category_id: val },
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Import Dialog */}
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Payees</DialogTitle>
                <DialogDescription>
                  Choose how to handle existing payees with the same name.
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
                          Skip payees that already exist (matched by name, case-insensitive)
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="overwrite">
                      <div className="space-y-1">
                        <div className="font-medium">Update Existing</div>
                        <div className="text-xs text-muted-foreground">
                          Update category for existing payees, create new ones
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
          </div>
        )}
      </AsyncRenderer>
    </MainLayout>
  );
}
