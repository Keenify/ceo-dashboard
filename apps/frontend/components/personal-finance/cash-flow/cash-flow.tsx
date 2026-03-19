"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    CashflowDBRow, 
    CashflowDBInsert, 
    CashflowDBUpdate, 
    useCashflow 
} from '@/app/personal-finance/services/useCashflow'; // Import types and hook
import { CashflowMatrixTable } from './CashflowMatrixTable'; // Import the new component
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CardPayment from "./CardPayment"; // Import the new CardPayment component

// Helper function to format date string to Month-Year (e.g., "May-2024")
// This should ideally be a shared utility or consistently defined.
// Copied from CashflowMatrixTable for now.
const formatMonthYear = (dateString: string): string => {
  try {
    const [year, month] = dateString.split('-');
    const monthIndex = parseInt(month) - 1;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[monthIndex]}-${year}`;
  } catch (e) {
    console.error("Error formatting month-year in cash-flow.tsx:", dateString, e);
    return "Invalid Date";
  }
};

// Define props if needed, e.g., userId
export interface CashFlowSectionProps {
   userId: string; // Make userId mandatory
}

// --- Component ---
export const CashFlowSection: React.FC<CashFlowSectionProps> = ({ userId }) => {
  // --- Sample Data & Local State ---
  const [allCashflows, setAllCashflows] = useState<CashflowDBRow[]>([]);
  const [displayedMonths, setDisplayedMonths] = useState<string[]>([]);

  // --- API Hook Integration (Commented out) ---
  const {
     addCashflow,
     fetchCashflows,
     updateCashflow,
     deleteCashflow,
     loading: apiLoading, // Use distinct name for hook loading
     error: apiError // Use distinct name for hook error
   } = useCashflow();

  // --- Data Fetching ---
  const loadCashflows = useCallback(async (tableIdentifier?: string) => {
    console.log(`Fetching cashflows for user: ${userId}${tableIdentifier ? `, initiated by ${tableIdentifier}` : ''}`);
    
    try {
      const data = await fetchCashflows(userId, 0, 500, undefined, true); // Set limit to 500
      if (data) {
        setAllCashflows(data);
        console.log(`${tableIdentifier || 'Initial load'}: Loaded ${data.length} cashflow entries`);
      } else {
        // Error is handled by the hook's state
        console.error("fetchCashflows returned null or failed");
      }
    } catch (error) {
      console.error("Error loading cashflows:", error);
    }
  }, [userId, fetchCashflows]);

  useEffect(() => {
    loadCashflows();
  }, [loadCashflows]); // Load on mount

  // --- Data Filtering for Tables ---
  const inflows = useMemo(() => allCashflows.filter(cf => cf.flow_type === 'inflow'), [allCashflows]);
  const outflows = useMemo(() => allCashflows.filter(cf => cf.flow_type === 'outflow'), [allCashflows]);

  // Effect to read displayed months from localStorage, similar to CashflowMatrixTable
  useEffect(() => {
    try {
      const storedColumns = window.localStorage.getItem('cashflow-displayed-months');
      if (storedColumns) {
        const parsedColumns = JSON.parse(storedColumns) as string[];
        if (Array.isArray(parsedColumns) && parsedColumns.length > 0) {
          setDisplayedMonths(parsedColumns);
          console.log("CashFlowSection: Loaded displayed months from localStorage:", parsedColumns);
        }
      } else {
        // Fallback or default month calculation if nothing in localStorage
        // This part might need to be more robust based on how initial months are set elsewhere
        const currentMonthYear = formatMonthYear(new Date().toISOString().split('T')[0]);
        if (currentMonthYear !== "Invalid Date") {
            setDisplayedMonths([currentMonthYear]); // Default to current month if nothing stored
        }
      }
    } catch (e) {
      console.error("CashFlowSection: Error reading displayed months from localStorage:", e);
    }
  }, [allCashflows]); // Rerun if allCashflows changes, as it might influence available months

  // Calculate trueNetBalanceByMonth to pass to the Inflow table
  const trueNetBalanceByMonth = useMemo(() => {
    const netBalances: { [monthYear: string]: number } = {};
    const relevantMonths = displayedMonths.length > 0 
        ? displayedMonths 
        : Array.from(new Set(allCashflows.map(cf => formatMonthYear(cf.flow_date))))
               .filter(my => my !== "Invalid Date")
               .sort((a, b) => new Date(a.replace("-", " 1, ")).getTime() - new Date(b.replace("-", " 1, ")).getTime());

    let accumulatingBalance = 0;

    relevantMonths.forEach(monthYear => {
      const monthlyInflowTotal = inflows
        .filter(cf => formatMonthYear(cf.flow_date) === monthYear)
        .reduce((sum, cf) => sum + cf.amount, 0);
      
      const monthlyOutflowTotal = outflows
        .filter(cf => formatMonthYear(cf.flow_date) === monthYear)
        .reduce((sum, cf) => sum + cf.amount, 0);
        
      // Current month's change + previous accumulating balance
      accumulatingBalance += (monthlyInflowTotal - monthlyOutflowTotal);
      netBalances[monthYear] = accumulatingBalance;
    });
    console.log("CashFlowSection: Calculated ACCUMULATING trueNetBalanceByMonth:", netBalances);
    return netBalances;
  }, [inflows, outflows, displayedMonths, allCashflows]);

  // --- Handlers to pass to child (interacting with API hook & state) ---

  const handleAddEntry = useCallback(async (payload: CashflowDBInsert): Promise<CashflowDBRow | null> => {
      console.log("Calling addCashflow with payload:", payload);
      const result = await addCashflow(payload);
      if (result) {
           loadCashflows(); // Reload data on success
           return result;
      } else {
           // Error is handled by the hook's state
           return null;
      }
  }, [userId, addCashflow, loadCashflows]);

  const handleUpdateAmount = useCallback(async (id: string, payload: Partial<CashflowDBUpdate>): Promise<CashflowDBRow | null> => {
      console.log(`Calling updateCashflow for id ${id} with payload:`, payload);
      const result = await updateCashflow(id, userId, payload);

      if (result) {
          // Optimistically update local state 
          setAllCashflows(prev => prev.map(cf =>
              cf.id === id ? { 
                 ...cf, 
                 // Spread all possible fields from payload, which is Partial<CashflowDBUpdate>
                 // Fields in CashflowDBUpdate are already optional or can be null.
                 // The `result` (CashflowDBRow) is the source of truth from backend.
                 // So, we should use `result` to update the state if the API call was successful.
                 ...result // Replace the entire entry with the result from the backend
              } : cf
          ));
          // If not reloading all data via loadCashflows() after update, ensure this optimistic update is correct.
          // For simplicity and correctness, usually good to call loadCashflows() if data structure is complex or side effects exist.
          // However, the current CashflowMatrixTable calls onDataChange which calls loadCashflows,
          // so this optimistic update might be redundant or could be simplified if loadCashflows is always called.
          // For now, keeping it to ensure UI feels responsive even before full reload completes.

          return result;
      } else {
          // Error is handled by hook state
          return null;
      }
  }, [userId, updateCashflow, allCashflows]);

   const handleDeleteRow = useCallback(async (description: string, day: string, flowType: 'inflow' | 'outflow'): Promise<boolean> => {
       const entriesToDelete = allCashflows.filter(
            cf => cf.description === description && getDayOfMonth(cf.flow_date) === day && cf.flow_type === flowType
        );
       if (entriesToDelete.length === 0) return true; // Nothing to delete

       // Consider adding a bulk delete endpoint in the future
       let success = true;
       for (const entry of entriesToDelete) {
           console.log(`Calling deleteCashflow for id ${entry.id}`);
           const deleted = await deleteCashflow(entry.id, userId);
           if (!deleted) {
               success = false;
               break; // Stop on first failure
           }
       }

       if (success) {
           console.log("Row deleted successfully, reloading data...");
           loadCashflows(); // Reload data on success
           return true;
       } else {
           return false;
       }
   }, [allCashflows, userId, deleteCashflow, loadCashflows]);

   // --- Styling Classes ---
    const thClass = "px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap";
    const tdClass = "px-3 py-1 align-middle whitespace-nowrap";
    const inputClass = "h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";
    const actionButtonClass = "p-1 h-7 disabled:opacity-50";

  return (
    <div className="mt-6 space-y-8 px-4 sm:px-6 lg:px-8">
      {apiError && <p className="text-red-500 dark:text-red-400 mb-4">Error: {apiError.message}</p>}
      {apiLoading && !apiError && <p className="dark:text-gray-300 mb-4">Loading...</p>}

      {!apiLoading && !apiError && (
        <Tabs defaultValue="inflow-outflow" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <TabsTrigger 
              value="inflow-outflow" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
            >
              Inflow x Outflow
            </TabsTrigger>
            <TabsTrigger 
              value="card-payment" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
            >
              Card Payment
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inflow-outflow" className="p-1">
            <div className="cashflow-tables space-y-6 overflow-hidden">
              <div className="cashflow-table overflow-x-auto relative isolate">
                <CashflowMatrixTable
                  title="Inflow"
                  userId={userId}
                  cashflows={inflows}
                  flowType="inflow"
                  trueNetBalanceByMonth={trueNetBalanceByMonth}
                  tableIdentifier="inflow-table"
                  onAddEntry={handleAddEntry}
                  onUpdateAmount={handleUpdateAmount}
                  onDeleteRow={handleDeleteRow}
                  onDataChange={loadCashflows}
                  loading={apiLoading}
                  thClass={thClass}
                  tdClass={tdClass}
                  inputClass={inputClass}
                  actionButtonClass={actionButtonClass}
                />
              </div>

              <div className="cashflow-table overflow-x-auto relative isolate">
                <CashflowMatrixTable
                  title="Outflow"
                  userId={userId}
                  cashflows={outflows}
                  inflowCashflows={inflows}
                  flowType="outflow"
                  trueNetBalanceByMonth={trueNetBalanceByMonth}
                  tableIdentifier="outflow-table"
                  onAddEntry={handleAddEntry}
                  onUpdateAmount={handleUpdateAmount}
                  onDeleteRow={handleDeleteRow}
                  onDataChange={loadCashflows}
                  loading={apiLoading}
                  thClass={thClass}
                  tdClass={tdClass}
                  inputClass={inputClass}
                  actionButtonClass={actionButtonClass}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="card-payment" className="p-1">
            <CardPayment userId={userId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CashFlowSection;

// Restore getDayOfMonth as it's used by handleDeleteRow
const getDayOfMonth = (dateString: string): string => {
    try {
        // Extract day directly from date string (format: YYYY-MM-DD)
        const day = dateString.split('-')[2];
        // Remove leading zero if present
        return day.startsWith('0') ? day.substring(1) : day;
    } catch (e) {
        console.error("Error extracting day:", dateString, e);
        return '-';
    }
};
