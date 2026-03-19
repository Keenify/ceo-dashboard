"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Trash2, Copy, Settings, Pencil, Check, X } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table";
import { TravelTransactionResponse, TravelTransactionPayload } from '@/app/travel-pl/services/useTravelTransaction';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TravelTransactionListProps {
    filteredTransactions: TravelTransactionResponse[];
    originalTransactionCount: number;
    loading: boolean;
    error: string | null;
    apiLoading: boolean;
    handleDelete: (id: string) => Promise<void>;
    handleDuplicate: (transaction: TravelTransactionResponse) => void;
    thClass: string;
    tdClass: string;
    deleteButtonClass: string;
    showActions?: boolean;
    showControls?: boolean;
    showFooter?: boolean;
    updateTravelTransaction: (id: string, userId: string, payload: Partial<TravelTransactionPayload>) => Promise<TravelTransactionResponse | null>;
    loadTransactions: () => void;
    userId: string;
    showTripNameColumn?: boolean;
    showLocationColumn?: boolean;
}

export const TravelTransactionList: React.FC<TravelTransactionListProps> = ({
    filteredTransactions,
    originalTransactionCount,
    loading,
    error,
    apiLoading,
    handleDelete,
    handleDuplicate,
    thClass,
    tdClass,
    deleteButtonClass,
    showActions = true,
    showControls = true,
    showFooter = true,
    updateTravelTransaction,
    loadTransactions,
    userId,
    showTripNameColumn = true,
    showLocationColumn = true,
}) => {
    const [showLocalAmount, setShowLocalAmount] = useState<boolean>(false);
    const [showRate, setShowRate] = useState<boolean>(false);
    const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);

    // --- Editing State ---
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    // Store only the fields we allow editing for simplicity
    // Amounts are stored as strings in edit state to match input field behavior, then parsed on save.
    const [editedRowData, setEditedRowData] = useState<Partial<Pick<TravelTransactionResponse, 'item' | 'trip_name' | 'payment_date'> & {
        amount_sgd: string; // Store as string for input
        amount_local_currency: string; // Store as string for input
        exchange_rate_to_sgd: string; // Store as string for input
    }>>({});
    const [editingTxHasLocal, setEditingTxHasLocal] = useState<boolean>(false); // Track if the row being edited has local currency

    // --- Column Visibility State ---
    const totalSgdAmount = useMemo(() => {
        // Calculate total based on the already fully filtered list passed via props
        return filteredTransactions.reduce((sum, tx) => {
            const amount = typeof tx.amount_sgd === 'number' ? tx.amount_sgd : 0;
            // Calculate net total (Income - Expense)
            // No need for isNaN check as we ensure amount is a number or 0
            return sum + (tx.category === 'income' ? amount : -amount);
        }, 0);
    }, [filteredTransactions]);

    // Calculate colspan dynamically
    // Base columns: Payment Date, Item, Amount (SGD) = 3
    const visibleColumnsBeforeAmount = 
        1 + // Payment Date
        1 + // Item
        (showTripNameColumn ? 1 : 0) + // Trip Name (conditional)
        (showLocationColumn ? 1 : 0) + // Location (conditional)
        (showLocalAmount ? 1 : 0) + 
        (showRate ? 1 : 0);
    const actionColumns = showActions ? 1 : 0;
    const totalColSpan = visibleColumnsBeforeAmount + 1 + actionColumns; // +1 for Amount (SGD)

    // --- Edit Handlers ---
    const handleEditClick = (tx: TravelTransactionResponse) => {
        const hasLocal = !!tx.local_currency;
        setEditingRowId(tx.id);
        setEditingTxHasLocal(hasLocal);
        setEditedRowData({
            payment_date: tx.payment_date,
            item: tx.item,
            trip_name: tx.trip_name ?? '',
            amount_sgd: tx.amount_sgd !== null ? String(tx.amount_sgd) : '',
            amount_local_currency: tx.amount_local_currency !== null ? String(tx.amount_local_currency) : '',
            exchange_rate_to_sgd: tx.exchange_rate_to_sgd !== null ? String(tx.exchange_rate_to_sgd) : '',
        });
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedRowData({});
        setEditingTxHasLocal(false);
    };

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Keep amounts as strings in edit state, will parse on save
        setEditedRowData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editingRowId) return;

        const item = editedRowData.item;
        const trip_name = editedRowData.trip_name === null ? undefined : editedRowData.trip_name;
        const payment_date = editedRowData.payment_date;

        if (!payment_date) {
            console.error("Payment date cannot be empty.");
            // TODO: Show user feedback
            return;
        }

        let payload: Partial<TravelTransactionPayload> = {
            payment_date: payment_date, 
            item: item,
            trip_name: trip_name
        };

        if (editingTxHasLocal) {
            // --- Editing Local Currency Transaction --- Validate local fields
            if (!item || !editedRowData.amount_local_currency || !editedRowData.exchange_rate_to_sgd) {
                console.error("Item, Local Amount, and Rate cannot be empty.");
                return;
            }
            const localAmountNum = parseFloat(editedRowData.amount_local_currency);
            const rateNum = parseFloat(editedRowData.exchange_rate_to_sgd);
            if (isNaN(localAmountNum) || isNaN(rateNum)) {
                console.error("Invalid Local Amount or Rate.");
                return;
            }

            // Find the original transaction to get the currency code
            const originalTx = filteredTransactions.find(tx => tx.id === editingRowId);
            if (!originalTx || !originalTx.local_currency) {
                console.error("Could not find original transaction or its local currency code.");
                return; // Should not happen if editingTxHasLocal is true
            }

            payload = {
                ...payload,
                local_currency: originalTx.local_currency, // Add original currency code
                amount_local_currency: localAmountNum,
                exchange_rate_to_sgd: rateNum,
            };
        } else {
             // --- Editing SGD Only Transaction --- Validate SGD field
            if (!item || !editedRowData.amount_sgd) {
                console.error("Item and Amount (SGD) cannot be empty.");
                // TODO: Show user feedback
                return;
            }
             const amountSgdNum = parseFloat(editedRowData.amount_sgd);
             if (isNaN(amountSgdNum)) {
                 console.error("Invalid Amount (SGD).");
                 // TODO: Show user feedback
                 return;
             }
            payload = {
                ...payload,
                amount_sgd: amountSgdNum,
                // Ensure local fields are undefined/cleared if editing SGD only
                local_currency: undefined,
                amount_local_currency: undefined,
                exchange_rate_to_sgd: undefined,
            };
        }

        console.log("Payload being sent:", JSON.stringify(payload, null, 2)); // Log JSON payload
        console.log("Saving edit for:", editingRowId, "Payload:", payload);
        const result = await updateTravelTransaction(editingRowId, userId, payload);

        if (result) {
            console.log("Update successful");
            handleCancelEdit(); // Exit edit mode
            loadTransactions(); // Refresh the list
        } else {
            console.error("Update failed");
            // TODO: Show user feedback based on API error
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Existing Transactions</h3>
                {/* Settings Popover Trigger (conditional) */}
                {showControls && originalTransactionCount > 0 && (
                    <Popover open={isSettingsPopoverOpen} onOpenChange={setIsSettingsPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-1.5">
                                <Settings className="h-4 w-4 dark:text-gray-400" />
                                <span className="sr-only">Settings</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 mr-4 p-0 dark:bg-gray-900 dark:border-gray-700" align="end">
                             <div className="p-4">
                                  <p className="text-sm font-medium mb-4 dark:text-gray-200">Configure View</p>
                                 <div className="flex gap-6 items-start">

                                      {/* Left Column: Show Columns */}
                                       <div className="flex-1 space-y-3">
                                           <Label className="text-xs font-medium text-gray-600 block dark:text-gray-400">Show Columns:</Label>
                                           <div className="flex items-center space-x-2">
                                               <Checkbox
                                                  id="popover-show-local"
                                                  checked={showLocalAmount}
                                                  onCheckedChange={(checked) => setShowLocalAmount(!!checked)}
                                                  className="dark:border-gray-600 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-600"
                                               />
                                               <Label htmlFor="popover-show-local" className="text-sm font-normal cursor-pointer dark:text-gray-300">Amount (Local)</Label>
                                           </div>
                                           <div className="flex items-center space-x-2">
                                               <Checkbox
                                                  id="popover-show-rate"
                                                  checked={showRate}
                                                  onCheckedChange={(checked) => setShowRate(!!checked)}
                                                  className="dark:border-gray-600 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-600"
                                               />
                                               <Label htmlFor="popover-show-rate" className="text-sm font-normal cursor-pointer dark:text-gray-300">Rate</Label>
                                           </div>
                                       </div>

                                       {/* Removed Date Filter Section - Controlled by Form now */}
                                   </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                )}
            </div>
             {/* Removed old filter/toggle UI */}

             {loading && <p>Loading transactions...</p>}
             {error && <p className="text-red-600 dark:text-red-400">Error: {error}</p>}
             {!loading && !error && (
               <div className="shadow border border-gray-200 sm:rounded-lg dark:border-gray-700">
                   <Table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                       <TableHeader className="bg-gray-50 dark:bg-gray-800">
                           <TableRow>
                               <TableHead className={thClass}>Payment Date</TableHead>
                               {/* <TableHead className={thClass}>Category</TableHead> */}
                               <TableHead className={thClass}>Item</TableHead>
                               {showTripNameColumn && <TableHead className={thClass}>Trip Name</TableHead>} {/* Conditional Trip Name Header */}
                               {showLocationColumn && <TableHead className={thClass}>Label</TableHead>} {/* Conditional Location Header */}
                               {showLocalAmount && <TableHead className={`${thClass} text-right`}>Amount (Local)</TableHead>}
                               {showRate && <TableHead className={thClass}>Rate</TableHead>}
                               <TableHead className={`${thClass} text-right`}>Expenditure (SGD)</TableHead>
                               {showActions && <TableHead className={thClass}>Action</TableHead>}
                            </TableRow>
                       </TableHeader>
                        <TableBody className="bg-white divide-y divide-gray-200 dark:bg-gray-950 dark:divide-gray-700">
                           {filteredTransactions.length === 0 && (
                               <TableRow>
                                   <TableCell colSpan={totalColSpan} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                       {originalTransactionCount === 0 ? 'No transactions found.' : 'No transactions match filters.'}
                                   </TableCell>
                               </TableRow>
                           )}
                           {filteredTransactions.map((tx) => {
                               const isEditing = editingRowId === tx.id;
                               return (
                                   <TableRow key={tx.id}>
                                       <TableCell className={tdClass}>
                                           {isEditing ? (
                                               <Input
                                                   type="date"
                                                   name="payment_date"
                                                   value={editedRowData.payment_date ?? ''}
                                                   onChange={handleEditInputChange}
                                                   className="text-sm dark:bg-gray-700 dark:border-gray-600 w-full"
                                               />
                                           ) : (
                                               tx.payment_date
                                           )}
                                       </TableCell>
                                       {/* <TableCell className={tdClass}>{tx.category}</TableCell> */}
                                       <TableCell className={tdClass}>
                                           {isEditing ? (
                                               <Input
                                                   type="text"
                                                   name="item"
                                                   value={editedRowData.item ?? ''}
                                                   onChange={handleEditInputChange}
                                                   className="text-sm dark:bg-gray-700 dark:border-gray-600 w-full"
                                               />
                                           ) : (
                                               tx.item
                                           )}
                                       </TableCell>
                                       {showTripNameColumn && (
                                         <TableCell className={tdClass}>
                                             {isEditing ? (
                                                 <Input
                                                     type="text"
                                                     name="trip_name"
                                                     value={editedRowData.trip_name ?? ''}
                                                     onChange={handleEditInputChange}
                                                     className="text-sm dark:bg-gray-700 dark:border-gray-600 w-full"
                                                     placeholder="e.g., Bali Trip"
                                                 />
                                             ) : (
                                                 tx.trip_name || '-'
                                             )}
                                         </TableCell>
                                       )}
                                       {showLocationColumn && (
                                         <TableCell className={tdClass}>
                                           {isEditing && false ? ( /* Editing location not implemented here, so always show text */ 
                                             <></> /* Placeholder for potential future location edit input */
                                           ) : (
                                            `${tx.city}, ${tx.country}`
                                           )}
                                         </TableCell>
                                       )}
                                       {showLocalAmount && (
                                           <TableCell className={`${tdClass} text-right`}>
                                               {isEditing && editingTxHasLocal ? (
                                                   <Input
                                                       type="number"
                                                       name="amount_local_currency"
                                                       value={editedRowData.amount_local_currency || ''} // Keep as string for input
                                                       onChange={handleEditInputChange}
                                                       step="0.01"
                                                       className="text-sm text-right dark:bg-gray-700 dark:border-gray-600 w-full"
                                                   />
                                               ) : (
                                                   tx.local_currency ? `${tx.local_currency.toUpperCase()} ${tx.amount_local_currency !== null ? tx.amount_local_currency.toFixed(2) : '-'}` : '-'
                                               )}
                                           </TableCell>
                                       )}
                                       {showRate && (
                                          <TableCell className={`${tdClass} text-right`}>
                                              {isEditing && editingTxHasLocal ? (
                                                  <Input
                                                      type="number"
                                                      name="exchange_rate_to_sgd"
                                                      value={editedRowData.exchange_rate_to_sgd || ''} // Keep as string for input
                                                      onChange={handleEditInputChange}
                                                      step="0.000001"
                                                      className="text-sm text-right dark:bg-gray-700 dark:border-gray-600 w-full"
                                                  />
                                              ) : (
                                                  tx.exchange_rate_to_sgd !== null ? tx.exchange_rate_to_sgd.toFixed(4) : '-'
                                              )}
                                          </TableCell>
                                       )}
                                       <TableCell className={`${tdClass} text-right font-medium`}>
                                           {isEditing ? (
                                               editingTxHasLocal ? (
                                                   <span className="text-sm text-gray-500 dark:text-gray-400">
                                                       SGD {(parseFloat(editedRowData.amount_local_currency || '0') * parseFloat(editedRowData.exchange_rate_to_sgd || '0')).toFixed(2)}
                                                   </span>
                                               ) : (
                                                   <Input
                                                       type="number"
                                                       name="amount_sgd"
                                                       value={editedRowData.amount_sgd || ''} // Keep as string for input
                                                       onChange={handleEditInputChange}
                                                       step="0.01"
                                                       className="text-sm text-right dark:bg-gray-700 dark:border-gray-600 w-full"
                                                   />
                                               )
                                           ) : (
                                               <>
                                                   {tx.category === 'income' && <span className="text-green-600 dark:text-green-400 font-bold mr-1">+</span>}
                                                   SGD {tx.amount_sgd !== null ? tx.amount_sgd.toFixed(2) : '-'}
                                               </>
                                           )}
                                       </TableCell>
                                       {showActions && (
                                           <TableCell className={tdClass}>
                                               {isEditing ? (
                                                   <>
                                                       <Button variant="ghost" size="sm" className="p-1 h-7 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300" onClick={handleSaveEdit} disabled={apiLoading} title="Save">
                                                           <Check size={16}/>
                                                       </Button>
                                                       <Button variant="ghost" size="sm" className="p-1 h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ml-1" onClick={handleCancelEdit} disabled={apiLoading} title="Cancel">
                                                           <X size={16}/>
                                                       </Button>
                                                   </>
                                               ) : (
                                                   <>
                                                       <button
                                                           onClick={() => handleEditClick(tx)}
                                                           className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                                                           title="Edit Transaction"
                                                           disabled={apiLoading || !!editingRowId} // Disable if another row is being edited
                                                       >
                                                           <Pencil size={16} />
                                                       </button>
                                                       <button
                                                           onClick={() => handleDuplicate(tx)}
                                                           className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 ml-2 dark:text-blue-400 dark:hover:text-blue-300"
                                                           title="Duplicate Transaction"
                                                           disabled={apiLoading || !!editingRowId}
                                                       >
                                                           <Copy size={16} />
                                                       </button>
                                                       <button
                                                           onClick={() => handleDelete(tx.id)}
                                                           className={`${deleteButtonClass} dark:text-red-400 dark:hover:text-red-300 ml-2`}
                                                           title="Delete Transaction"
                                                           disabled={apiLoading || !!editingRowId}
                                                       >
                                                           <Trash2 size={16} />
                                                       </button>
                                                   </>
                                               )}
                                           </TableCell>
                                       )}
                                   </TableRow>
                               );
                           })}
                        </TableBody>
                        {/* Conditional Footer Row */}
                        {showFooter && filteredTransactions.length > 0 && (
                           <TableFooter className="bg-gray-50 dark:bg-gray-800">
                               <TableRow>
                                   <TableCell colSpan={visibleColumnsBeforeAmount} className="text-right font-medium pr-4 dark:text-gray-300">Total</TableCell>
                                   <TableCell className="text-right font-bold">
                                       SGD {totalSgdAmount > 0 ? '+' : ''}{Math.abs(totalSgdAmount).toFixed(2)}
                                   </TableCell>
                                   {showActions && <TableCell></TableCell>}
                               </TableRow>
                           </TableFooter>
                        )}
                   </Table>
               </div>
            )}
         </div>
    );
};
