import { useState } from "react"
import { useAccounts } from "@/hooks/queries/useAccounts"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { updateAccount, deleteAccount, getDuplicateAccounts, mergeAccounts } from "@/services/api"
import type { DuplicateGroup } from "@/services/api/accounts"
import type { Account, AccountType } from "@/types"
import { ACCOUNT_TYPE_OPTIONS } from "@/types/api-types"
import { MainLayout } from "@/layouts/MainLayout"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function AccountSettingsPage() {
  const { data: accounts = [] } = useAccounts()
  const { data: duplicates = [] } = useQuery({
    queryKey: ["account-duplicates"],
    queryFn: getDuplicateAccounts,
  })
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [mergeConfirm, setMergeConfirm] = useState<{ source: string; target: string; group: DuplicateGroup } | null>(null)
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(new Set())

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) =>
      updateAccount(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["account-duplicates"] })
      setDeleteConfirm(null)
    },
  })

  const mergeMutation = useMutation({
    mutationFn: mergeAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["account-duplicates"] })
      setMergeConfirm(null)
    },
  })

  const handleUpdate = (id: string, updates: Partial<Account>) => {
    updateMutation.mutate({ id, updates })
  }

  const handleDelete = (id: string) => {
    setDeleteConfirm(id)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm)
    }
  }

  const handleMerge = (source: string, target: string, group: DuplicateGroup) => {
    setMergeConfirm({ source, target, group })
  }

  const confirmMerge = () => {
    if (mergeConfirm) {
      mergeMutation.mutate({
        source_account_id: mergeConfirm.source,
        target_account_id: mergeConfirm.target,
        preserve_categorization: true,
      })
    }
  }

  // Helper to check if account is in a duplicate group
  const isDuplicate = (accountId: string) => {
    return duplicates.some(group =>
      group.accounts.some((acc: any) => acc.id === accountId)
    )
  }

  return (
    <MainLayout title="Account Settings">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <Button
            asChild
            variant="default"
          >
            <a
              href="https://beta-bridge.simplefin.org/my-account/connections/create"
              target="_blank"
              rel="noopener noreferrer"
            >
              Connect Account
            </a>
          </Button>
        </div>

        {/* Duplicate Accounts Warning */}
        {duplicates.length > 0 && (
          <div className="mb-6 space-y-4">
            {duplicates.map((group, idx) => {
              const groupKey = `${group.org_id}-${group.name}`
              if (dismissedGroups.has(groupKey)) return null

              return (
                <div key={idx} className="border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 dark:text-yellow-400 mt-1">⚠️</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Duplicate accounts detected: {group.name} ({group.org_id})
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDismissedGroups(prev => new Set(prev).add(groupKey))}
                          className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 -mt-1 -mr-2"
                        >
                          ✕
                        </Button>
                      </div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                      These accounts appear to be the same. This can happen when SimpleFIN credentials are refreshed.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          What happened:
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          When you refreshed SimpleFIN credentials, it created a new account. Your old account has all your categorization work, but SimpleFIN won't sync to it anymore.
                        </p>
                      </div>

                      {/* Show accounts with merge direction */}
                      <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Accounts to merge:</p>
                        {group.accounts.map((acc: any, accIdx: number) => {
                          const isLast = accIdx === group.accounts.length - 1
                          const displayName = acc.alt_name || acc.name
                          const balance = acc.balance !== null && acc.balance !== undefined
                            ? new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: acc.currency || 'USD'
                              }).format(Number(acc.balance))
                            : 'No balance'
                          const createdDate = acc.created_at
                            ? new Date(acc.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : null

                          return (
                            <div key={acc.account_id} className="flex items-center gap-2 py-1">
                              {!isLast && <span className="text-sm">📦</span>}
                              {isLast && <span className="text-sm">🎯</span>}
                              <span className="text-sm font-medium">{displayName}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">({balance})</span>
                              {createdDate && <span className="text-xs text-gray-500">• Added {createdDate}</span>}
                              {!isLast && <span className="text-xs text-gray-500">← Old (has your data)</span>}
                              {isLast && <span className="text-xs text-green-600 dark:text-green-400">← New (SimpleFIN syncs here)</span>}
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        onClick={() => {
                          // Merge FROM first (old) TO last (new)
                          const oldAccount = group.accounts[0]
                          const newAccount = group.accounts[group.accounts.length - 1]
                          handleMerge(oldAccount.account_id, newAccount.account_id, group)
                        }}
                        className="w-full"
                      >
                        Merge Accounts
                      </Button>
                    </div>
                  </div>
                </div>
                </div>
              )
            })}
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Hidden</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((acct) => {
              const balance = acct.balance !== null && acct.balance !== undefined
                ? new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: acct.currency || 'USD'
                  }).format(Number(acct.balance))
                : '—'
              const createdDate = acct.created_at
                ? new Date(acct.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : '—'

              return (
                <TableRow
                  key={acct.account_id}
                  className={isDuplicate(acct.account_id) ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                >
                  <TableCell>{acct.org_name || "N/A"}</TableCell>
                  <TableCell>{acct.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{balance}</TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">{createdDate}</TableCell>
                  <TableCell>
                    <Input
                      placeholder="Friendly Name"
                      defaultValue={acct.alt_name ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        handleUpdate(acct.account_id, { alt_name: val === "" ? null : val })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={acct.account_type || "other"}
                      onValueChange={(val: AccountType) =>
                        handleUpdate(acct.account_id, { account_type: val })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={acct.is_hidden}
                      onCheckedChange={(checked) =>
                        handleUpdate(acct.account_id, { is_hidden: !!checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(acct.account_id)}
                      disabled={deleteMutation.isPending}
                    >
                      🗑️ Delete
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Delete Account?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this account? This will also delete all associated transactions, holdings, and balances. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      {mergeConfirm && (() => {
        const sourceAccount = mergeConfirm.group.accounts.find(a => a.account_id === mergeConfirm.source)
        const targetAccount = mergeConfirm.group.accounts.find(a => a.account_id === mergeConfirm.target)

        const sourceName = sourceAccount?.alt_name || sourceAccount?.name || mergeConfirm.source
        const targetName = targetAccount?.alt_name || targetAccount?.name || mergeConfirm.target

        const showFriendlyNameTip = !sourceAccount?.alt_name || !targetAccount?.alt_name

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Merge Accounts?</h2>
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 sm:p-3">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">Merging:</p>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
                    "{sourceName}" → "{targetName}"
                  </p>
                </div>

                {showFriendlyNameTip && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2 sm:p-3 text-xs sm:text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">💡 Tip</p>
                    <p className="text-amber-800 dark:text-amber-200">
                      Set friendly "Display Names" for your accounts to make merging easier to understand in the future.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-2 sm:p-3 text-xs sm:text-sm">
                  <p className="font-semibold mb-2">What will happen:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                    <li>Recent transactions will be matched and categorization preserved</li>
                    <li>Old transactions (12+ months) will be reassigned to the target account</li>
                    <li>Holdings will be reassigned to the target account</li>
                    <li>The source account will be deleted</li>
                  </ul>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                  Source: {mergeConfirm.source.slice(0, 24)}...<br />
                  Target: {mergeConfirm.target.slice(0, 24)}...
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <Button variant="outline" onClick={() => setMergeConfirm(null)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={confirmMerge} disabled={mergeMutation.isPending} className="w-full sm:w-auto">
                  {mergeMutation.isPending ? "Merging..." : "Merge Accounts"}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </MainLayout>
  )
}
