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
import { X } from "lucide-react";
import { useState, useMemo } from "react";
import CategoryCombobox from "@/components/ui/CategoryCombobox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function PayeesPage() {
  const navigate = useNavigate();
  const { data: groups, isLoading: loadingGroups } = useGroups();
  const { data: payees, isLoading: loadingPayees } = usePayees();
  const updatePayee = useUpdatePayee();

  const [payeeFilter, setPayeeFilter] = useState("");
  const [hideWithCategory, setHideWithCategory] = useState(false);

  const filteredPayees = useMemo(() => {
    if (!payees) return [];

    return payees.filter((payee) => {
      // Filter by payee name
      if (payeeFilter && !payee.name.toLowerCase().includes(payeeFilter.toLowerCase())) {
        return false;
      }

      // Hide if has default category set
      if (hideWithCategory && payee.category_id !== 0) {
        return false;
      }

      return true;
    });
  }, [payees, payeeFilter, hideWithCategory]);

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
            <div className="flex items-center gap-4">
              <div className="flex-1 relative max-w-sm">
                <Input
                  placeholder="Filter by payee name..."
                  value={payeeFilter}
                  onChange={(e) => setPayeeFilter(e.target.value)}
                  className="pr-8"
                />
                {payeeFilter && (
                  <button
                    onClick={() => setPayeeFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear filter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
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
                <TableHead className="w-1/2">Payee</TableHead>
                <TableHead className="w-1/2">Default Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayees?.map((payee) => {
                const currentCategory =
                  groups
                    ?.flatMap((g) => g.categories)
                    .find((c) => c.id === payee.category_id) ?? null;

                return (
                  <TableRow key={payee.id}>
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
          </div>
        )}
      </AsyncRenderer>
    </MainLayout>
  );
}
