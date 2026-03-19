"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  PlusCircle,
} from "lucide-react";
import type { Database } from '@/lib/database.types'; // Import main DB type
import {
  CashflowDBRow,
  CashflowDBInsert,
  CashflowDBUpdate
} from "@/app/personal-finance/services/useCashflow"; // Import DB-aligned types from the hook
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddCashflowEntryDialog } from "./AddCashflowEntryDialog"; // Import the new dialog component
import { EditCashflowRowDialog, EditDialogRowData } from './EditCashflowRowDialog'; // Import the new Edit Dialog
import { CashflowMatrixRow } from "./CashflowMatrixRow"; // Import the new row component
import { EditCellFormData } from "./EditCellForm"; // Import type from EditCellForm
import {
    PREDEFINED_COLOR_PALETTES,
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_FONT_COLOR,
    getDefaultPalette
} from '@/app/personal-finance/constants/colorPalettes'; // Added

// --- Helper Functions (Copied from cash-flow.tsx) ---
const parseMonthYear = (
  monthYear: string
): { year: number; month: number } | null => {
  try {
    const [monthStr, yearStr] = monthYear.split("-");
    const monthMap: { [key: string]: number } = {
      Jan: 1,
      Feb: 2,
      Mar: 3,
      Apr: 4,
      May: 5,
      Jun: 6,
      Jul: 7,
      Aug: 8,
      Sep: 9,
      Oct: 10,
      Nov: 11,
      Dec: 12,
    };
    const month = monthMap[monthStr];
    const year = parseInt(yearStr);
    if (month && !isNaN(year)) {
      return { year, month };
    }
  } catch (e) {
    console.error("Error parsing monthYear:", monthYear, e);
  }
  return null;
};

const formatMonthYear = (dateString: string): string => {
  try {
    // Safely extract month and year directly from date string to avoid timezone issues
    const [year, month] = dateString.split('-');
    const monthIndex = parseInt(month) - 1;
    
    // Month names array
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return `${monthNames[monthIndex]}-${year}`;
  } catch (e) {
    console.error("Error formatting month-year:", dateString, e);
    return "Invalid Date";
  }
};

const getDayOfMonth = (dateString: string): string => {
  try {
    // Extract day directly from date string (format: YYYY-MM-DD)
    const day = dateString.split('-')[2];
    // Remove leading zero if present
    return day.startsWith('0') ? day.substring(1) : day;
  } catch (e) {
    console.error("Error extracting day:", dateString, e);
    return "-";
  }
};

// --- Types & Interfaces ---
interface ProcessedCellData {
  value: string;
  backgroundColor?: string | null;
  fontColor?: string | null;
}

export interface ProcessedRow {
  description: string;
  day: string;
  amounts: { [monthYear: string]: ProcessedCellData };
  isSystemRow?: boolean;
  note?: string | null; // Added for row-level note
  // Row-level backgroundColor and fontColor are removed as we move to cell-level
}

interface NewRowState { // This matches AddCashflowEntryDialog's NewRowState, used for initial cell colors
  description: string;
  day: string;
  backgroundColor: string; // Initial background for all cells in the new row
  fontColor: string;     // Initial font color for all cells in the new row
}

const initialNewRowState: NewRowState = {
  description: "",
  day: String(new Date().getDate()),
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  fontColor: DEFAULT_FONT_COLOR,
};

// State for the new Edit Dialog
// interface EditingRowData extends CashflowDBUpdate { // Use CashflowDBUpdate as a base
// The EditDialogRowData from EditCashflowRowDialog.tsx will be used directly
//   originalDescription: string;
//   originalDay: string;
//   day: string; // Added to hold the potentially edited day for the dialog
//   // Add other fields from ProcessedRow if needed for the dialog, like current note for display
//   currentNote?: string | null;
// }

interface CashflowMatrixTableProps {
  title: string;
  userId: string;
  cashflows: CashflowDBRow[]; // Use DBRow type
  inflowCashflows?: CashflowDBRow[]; // Use DBRow type
  trueNetBalanceByMonth?: { [monthYear: string]: number }; // Added for Balance B/D
  flowType: "inflow" | "outflow";
  tableIdentifier: string; // Unique identifier for this table instance
  onAddEntry: (payload: CashflowDBInsert) => Promise<CashflowDBRow | null>; // Use DBInsert and DBRow
  onUpdateAmount: (
    id: string,
    payload: Partial<CashflowDBUpdate> // Use DBUpdate
  ) => Promise<CashflowDBRow | null>; // Use DBRow
  onDeleteRow: (description: string, day: string, flowType: "inflow" | "outflow") => Promise<boolean>;
  onDataChange?: (tableIdentifier: string) => Promise<void>; // Optional callback to reload data after significant changes
  loading: boolean; // Pass loading state from parent
  thClass: string;
  tdClass: string;
  inputClass: string;
  actionButtonClass: string;
  // Add error display/handling props if needed
}

// --- Component ---
export const CashflowMatrixTable: React.FC<CashflowMatrixTableProps> = ({
  title,
  userId,
  cashflows,
  inflowCashflows,
  trueNetBalanceByMonth,
  flowType,
  tableIdentifier,
  onAddEntry,
  onUpdateAmount,
  onDeleteRow,
  onDataChange,
  loading,
  thClass,
  tdClass,
  inputClass,
  actionButtonClass,
}) => {
  const [displayedMonthColumns, setDisplayedMonthColumns] = useState<string[]>(
    []
  );
  const [addMonthPopoverOpen, setAddMonthPopoverOpen] = useState(false);
  const [yearToAdd, setYearToAdd] = useState<string>("");
  const [monthToAdd, setMonthToAdd] = useState<string>("");

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRowForDialog, setEditingRowForDialog] = useState<EditDialogRowData | null>(null); // Use EditDialogRowData type

  // Get current month-year for highlighting
  const currentMonthYear = useMemo(() => {
    const now = new Date();
    return (
      now.toLocaleString("default", { month: "short" }) +
      "-" +
      now.getFullYear()
    );
  }, []);

  // --- Process Data for Table ---
  const { processedRows, availableMonthColumns } = useMemo(() => {
    if (cashflows.length === 0 && flowType !== "inflow") {
      return { processedRows: [], availableMonthColumns: [] };
    }

    const monthSet = new Set<string>();
    const processedData: { [key: string]: ProcessedRow } = {};

    cashflows.forEach((cf) => {
      const monthYear = formatMonthYear(cf.flow_date);
      const day = getDayOfMonth(cf.flow_date);
      const key = `${cf.description}_${day}`;
      monthSet.add(monthYear);

      if (!processedData[key]) {
        processedData[key] = {
          description: cf.description || "",
          day: day,
          amounts: {},
          isSystemRow: false,
          note: cf.note, // Populate note from the first cashflow entry for this key
          // No row-level colors here anymore
        };
      }
      // If a note exists on a subsequent cf for the same key, it might overwrite.
      // For simplicity, taking the first one encountered.
      // If specific logic is needed (e.g. concatenate, or prefer non-null), adjust here.
      if (processedData[key].note === null && cf.note !== null) {
        processedData[key].note = cf.note; // Prefer a non-null note if current is null
      }
      
      const currentAmountInCell = parseFloat(
        processedData[key].amounts[monthYear]?.value || "0"
      );
      processedData[key].amounts[monthYear] = {
        value: (currentAmountInCell + (isNaN(cf.amount) ? 0 : cf.amount)).toFixed(2),
        backgroundColor: cf.background_color_code || null,
        fontColor: cf.font_color_code || null,
      };
    });

    let allRows = Object.values(processedData);

    // Sort regular rows
    const sortedRegularRows = allRows.sort((a, b) => {
      const dayA = parseInt(a.day);
      const dayB = parseInt(b.day);
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      return a.description.localeCompare(b.description);
    });

    // Add "Balance B/D (Auto)" row for inflow table if trueNetBalanceByMonth is provided
    let finalProcessedRows: ProcessedRow[] = sortedRegularRows;
    let finalAvailableMonthColumns = Array.from(monthSet);


    if (flowType === "inflow" && trueNetBalanceByMonth) {
      const balanceBdRow: ProcessedRow = {
        description: "Balance B/D",
        day: "-", 
        amounts: {}, // Amounts will be populated below
        isSystemRow: true,
      };

      // Use displayedMonthColumns (if available and populated) or derive from trueNetBalanceByMonth keys for Balance B/D amounts
      // This ensures we use the same columns as the rest of the table for the B/D row.
      // The `displayedMonthColumns` state itself will be populated eventually from `availableMonthColumns` or localStorage.
      // For initial calculation, it's safer to derive relevant months from `trueNetBalanceByMonth` and merge with `monthSet`.
      
      const allRelevantMonthsForBd = new Set<string>([...finalAvailableMonthColumns, ...Object.keys(trueNetBalanceByMonth)]);
      const sortedAllRelevantMonths = Array.from(allRelevantMonthsForBd).sort((a, b) => {
        const dateA = new Date(a.replace("-", " 1, "));
        const dateB = new Date(b.replace("-", " 1, "));
        return dateA.getTime() - dateB.getTime();
      });
      
      // Update monthSet and finalAvailableMonthColumns to include all months from trueNetBalanceByMonth
      sortedAllRelevantMonths.forEach(m => monthSet.add(m));
      finalAvailableMonthColumns = Array.from(monthSet).sort((a, b) => {
        const dateA = new Date(a.replace("-", " 1, "));
        const dateB = new Date(b.replace("-", " 1, "));
        return dateA.getTime() - dateB.getTime();
      });


      sortedAllRelevantMonths.forEach((monthYear, index) => {
        let bdAmount = "0.00";
        if (index === 0) {
          const currentMonthDate = parseMonthYear(monthYear);
          if (currentMonthDate) {
            const prevMonthDate = new Date(currentMonthDate.year, currentMonthDate.month - 2, 1);
            const prevMonthYearKey = formatMonthYear(prevMonthDate.toISOString().split("T")[0]);
            bdAmount = (trueNetBalanceByMonth[prevMonthYearKey] || 0).toFixed(2);
          }
        } else {
          const prevMonthYear = sortedAllRelevantMonths[index - 1];
          bdAmount = (trueNetBalanceByMonth[prevMonthYear] || 0).toFixed(2);
        }
        balanceBdRow.amounts[monthYear] = {
            value: bdAmount,
            backgroundColor: null, // System rows don't have custom colors
            fontColor: null
        };
      });
      finalProcessedRows = [balanceBdRow, ...sortedRegularRows];
    }
    
    // Ensure all rows (including B/D) have entries for all available month columns, defaulting to '-' or '0.00'
    finalProcessedRows.forEach(row => {
      finalAvailableMonthColumns.forEach(month => {
        if (!(month in row.amounts)) {
          row.amounts[month] = {
            value: row.isSystemRow ? "0.00" : "-",
            backgroundColor: null,
            fontColor: null,
          };
        }
      });
    });


    return { processedRows: finalProcessedRows, availableMonthColumns: finalAvailableMonthColumns };
  }, [cashflows, flowType, trueNetBalanceByMonth]); // Added trueNetBalanceByMonth dependency

  // Sync displayed columns with parent component - use localStorage to ensure both tables show the same columns
  useEffect(() => {
    try {
      // On component mount, read the stored columns
      const storedColumns = window.localStorage.getItem('cashflow-displayed-months');
      if (storedColumns) {
        const parsedColumns = JSON.parse(storedColumns) as string[];
        if (Array.isArray(parsedColumns) && parsedColumns.length > 0) {
          console.log(`${tableIdentifier}: Using stored columns:`, parsedColumns);
          setDisplayedMonthColumns(parsedColumns);
          return; // Exit early if we loaded stored columns
        }
      }
      
      // If no stored columns, initialize both tables with the same set on first load
      if (displayedMonthColumns.length === 0) {
        // Combine available columns from data with defaults
        let initialColumns = [...availableMonthColumns];
        
        // Ensure we have at least current month + 5 more
        if (initialColumns.length < 6) {
          const today = new Date();
          for (let i = 0; i < 6; i++) {
            const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthYear = formatMonthYear(targetDate.toISOString().split("T")[0]);
            if (monthYear !== "Invalid Date" && !initialColumns.includes(monthYear)) {
              initialColumns.push(monthYear);
            }
          }
        }
        
        // Sort them
        initialColumns.sort((a, b) => {
          const dateA = new Date(a.replace("-", " 1, "));
          const dateB = new Date(b.replace("-", " 1, "));
          return dateA.getTime() - dateB.getTime();
        });
        
        console.log(`${tableIdentifier}: Initializing with columns:`, initialColumns);
        setDisplayedMonthColumns(initialColumns);
        
        // Store for next time and to sync tables
        window.localStorage.setItem('cashflow-displayed-months', JSON.stringify(initialColumns));
      }
    } catch (e) {
      console.error(`${tableIdentifier}: Error handling columns:`, e);
    }
  }, [availableMonthColumns, tableIdentifier]);  // Run once on mount per table

  // --- Row Editing State (Description/Day) ---
  const [editingRowDescDayKey, setEditingRowDescDayKey] = useState<string | null>(null);
  const [editedRowDescDayData, setEditedRowDescDayData] = useState<{
    description: string;
    day: string;
    backgroundColor: string;
    fontColor: string;
  }>({ description: "", day: "", backgroundColor: DEFAULT_BACKGROUND_COLOR, fontColor: DEFAULT_FONT_COLOR });

  // --- New Row State ---
  const [newRowData, setNewRowData] = useState<NewRowState>(initialNewRowState);
  const [cellError, setCellError] = useState<string | null>(null); // Local error for cell editing
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isProcessingNewRow, setIsProcessingNewRow] = useState(false); // Local loading for new row add

  const [editingCellKeyForPopover, setEditingCellKeyForPopover] = useState<string | null>(null); // New state for popover control

  // --- Add Month Column Handler ---
  const handleAddMonthColumn = async () => {
    const monthYearToAdd = formatMonthYear(`${yearToAdd}-${monthToAdd}-01`);
    if (
      monthYearToAdd !== "Invalid Date" &&
      !displayedMonthColumns.includes(monthYearToAdd)
    ) {
      const newColumns = [...displayedMonthColumns, monthYearToAdd].sort((a, b) => {
        const dateA = new Date(a.replace("-", " 1, "));
        const dateB = new Date(b.replace("-", " 1, "));
        return dateA.getTime() - dateB.getTime();
      });
      
      window.localStorage.setItem('cashflow-displayed-months', JSON.stringify(newColumns));
      setDisplayedMonthColumns(newColumns);
            
      if (processedRows.length > 0) {
        const parsedDateInfo = parseMonthYear(monthYearToAdd);
        if (!parsedDateInfo) {
          console.error("Invalid month year format:", monthYearToAdd);
          return;
        }
        
        const addPromises = processedRows
          .filter(row => !row.isSystemRow)
          .map(row => {
          const dayNum = parseInt(row.day);
          const targetDate = `${parsedDateInfo.year}-${String(parsedDateInfo.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          
          // Try to find an existing cell in the row to copy colors from, otherwise use null
          let existingBgColor = null;
          let existingFontColor = null;
          const firstMonthWithData = Object.keys(row.amounts)[0];
          if(firstMonthWithData && row.amounts[firstMonthWithData]){
            existingBgColor = row.amounts[firstMonthWithData].backgroundColor;
            existingFontColor = row.amounts[firstMonthWithData].fontColor;
          }

          const payload: CashflowDBInsert = {
            description: row.description,
            flow_date: targetDate,
            amount: 0, 
            flow_type: flowType,
            user_id: userId,
            category: "", 
            background_color_code: existingBgColor, 
            font_color_code: existingFontColor,
          };
          return onAddEntry(payload);
        });
        
        try {
          const results = await Promise.allSettled(addPromises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
          console.log(`${tableIdentifier}: Created ${successCount}/${addPromises.length} entries for new month ${monthYearToAdd}`);
          if (onDataChange) {
            await onDataChange(tableIdentifier);
          }
        } catch (error) {
          console.error(`${tableIdentifier}: Error creating entries for new month:`, error);
        }
      }
    }
    setAddMonthPopoverOpen(false);
  };

  // Get available months that aren't already displayed
  const getAvailableMonthsToAdd = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1
    const availableOptions: { year: string; month: string; monthYear: string }[] = [];
    
    // Prioritize current year and future months first, then past months
    const yearsToCheck = [currentYear, currentYear + 1, currentYear + 2, currentYear - 1];
    
    for (const year of yearsToCheck) {
      for (let month = 1; month <= 12; month++) {
        // For current year, prioritize current month and future months
        if (year === currentYear && month < currentMonth) {
          continue; // Skip past months of current year for now
        }
        
        const monthStr = String(month).padStart(2, "0");
        const monthYear = formatMonthYear(`${year}-${monthStr}-01`);
        
        if (monthYear !== "Invalid Date" && !displayedMonthColumns.includes(monthYear)) {
          availableOptions.push({
            year: String(year),
            month: monthStr,
            monthYear: monthYear
          });
        }
      }
    }
    
    // Now add past months of current year if needed
    for (let month = 1; month < currentMonth; month++) {
      const monthStr = String(month).padStart(2, "0");
      const monthYear = formatMonthYear(`${currentYear}-${monthStr}-01`);
      
      if (monthYear !== "Invalid Date" && !displayedMonthColumns.includes(monthYear)) {
        availableOptions.push({
          year: String(currentYear),
          month: monthStr,
          monthYear: monthYear
        });
      }
    }
    
    return availableOptions;
  };

  const availableMonthsToAdd = getAvailableMonthsToAdd();

  // Initialize year and month selection based on available options
  useEffect(() => {
    if (availableMonthsToAdd.length > 0 && (!yearToAdd || !monthToAdd)) {
      const firstAvailable = availableMonthsToAdd[0];
      setYearToAdd(firstAvailable.year);
      setMonthToAdd(firstAvailable.month);
    }
  }, [availableMonthsToAdd, yearToAdd, monthToAdd]);

  // --- Handler for Deleting Row ---
  const handleDeleteRow = async (description: string, day: string, flowType: 'inflow' | 'outflow') => {
    await onDeleteRow(description, day, flowType); // Call parent handler with flowType
  };

  // Close Add Dialog when opening cell edit
  useEffect(() => {
    if (editingCellKeyForPopover) {
      setIsAddDialogOpen(false);
    }
  }, [editingCellKeyForPopover]);

  // *** MODIFIED Add Row Handler (Triggered by Dialog's onAdd) ***
  const handleAddRow = useCallback(
    async (newRowInitialData: NewRowState): Promise<boolean> => { // newRowInitialData has initial BG/Font for all cells
      setIsProcessingNewRow(true);
      setCellError(null);

      const dayNum = parseInt(newRowInitialData.day); 

      const addPromises = displayedMonthColumns.map((monthYear) => {
        const parsedDateInfo = parseMonthYear(monthYear);
        if (!parsedDateInfo) {
          return Promise.reject(new Error("Invalid month column"));
        }
        
        const targetDate = `${parsedDateInfo.year}-${String(parsedDateInfo.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        
        const payload: CashflowDBInsert = {
          description: newRowInitialData.description,
          flow_date: targetDate,
          amount: 0, 
          flow_type: flowType,
          user_id: userId,
          category: "", 
          background_color_code: newRowInitialData.backgroundColor, // Use initial color from dialog
          font_color_code: newRowInitialData.fontColor,         // Use initial color from dialog
        };
        return onAddEntry(payload);
      });

      try {
        const results = await Promise.allSettled(addPromises);
        const allSucceeded = results.every(
          (res) => res.status === "fulfilled" && res.value !== null
        );

        if (allSucceeded) {
          if (onDataChange) {
            await onDataChange(tableIdentifier);
          }
          return true;
        } else {
          const firstError = results.find(
            (res) => res.status === "rejected"
          ) as PromiseRejectedResult | undefined;
          setCellError(
            `Failed to add all entries: ${
              firstError?.reason || "Unknown error"
            }`
          );
          return false;
        }
      } catch (error) {
        console.error("Error in Promise.allSettled for adding row:", error);
        setCellError("An unexpected error occurred while adding entries.");
        return false;
      } finally {
        setIsProcessingNewRow(false);
      }
    },
    [displayedMonthColumns, flowType, userId, onAddEntry, setCellError, onDataChange, tableIdentifier]
  ); 

  // --- Placeholder Handler for Editing Row Description/Day ---
  const handleEditRowClick = (description: string, day: string) => {
    handleCancelRowDescDayEdit(); 
    const key = `${description}_${day}`;
    setEditingRowDescDayKey(key);

    // Find the row in processedRows to get its current representative colors
    const rowBeingEdited = processedRows.find(r => !r.isSystemRow && r.description === description && r.day === day);
    let initialBgColor = DEFAULT_BACKGROUND_COLOR;
    let initialFontColor = DEFAULT_FONT_COLOR;

    if (rowBeingEdited && Object.keys(rowBeingEdited.amounts).length > 0) {
        const firstMonthWithData = Object.keys(rowBeingEdited.amounts)[0];
        const firstCellData = rowBeingEdited.amounts[firstMonthWithData];
        if (firstCellData) {
            initialBgColor = firstCellData.backgroundColor || DEFAULT_BACKGROUND_COLOR;
            initialFontColor = firstCellData.fontColor || DEFAULT_FONT_COLOR;
        }
    }

    setEditedRowDescDayData({ 
        description, 
        day,
        backgroundColor: initialBgColor, // Set initial colors for row edit
        fontColor: initialFontColor,   // Set initial colors for row edit
    });
  };

  const handleCancelRowDescDayEdit = () => {
    setEditingRowDescDayKey(null);
    setEditedRowDescDayData({ description: "", day: "", backgroundColor: DEFAULT_BACKGROUND_COLOR, fontColor: DEFAULT_FONT_COLOR }); 
  };

  const handleRowDescDayInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, // Allow SelectElement for potential future use or consistency
    fieldName?: string // To distinguish direct input vs. color palette selection
  ) => {
    if (fieldName === 'backgroundColor' || fieldName === 'fontColor') {
        // This case handles direct setting of backgroundColor or fontColor, e.g., from a palette selector
        // The event target structure might be different if coming from a custom palette component
        // For now, assuming `e.target.value` holds the color code and `fieldName` is 'backgroundColor' or 'fontColor'
        const { value } = e.target as HTMLSelectElement; // Or appropriate type based on actual event source
        setEditedRowDescDayData((prev) => ({ ...prev, [fieldName]: value }));
    } else {
        const { name, value } = e.target as HTMLInputElement;
        let processedValue = value;
        if (name === "day") {
            const dayNum = parseInt(value);
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                processedValue = String(dayNum);
            } else if (value === "") {
                processedValue = "";
            }
        }
        setEditedRowDescDayData((prev) => ({ ...prev, [name]: processedValue }));
    }
  };

  const handleSaveRowDescDayEdit = async () => {
    if (!editingRowDescDayKey || !editedRowDescDayData) return;

    const [originalDescription, originalDay] = editingRowDescDayKey.split("_");
    const newDescription = editedRowDescDayData.description.trim();
    const newDay = editedRowDescDayData.day.trim();
    const newRowBackgroundColor = editedRowDescDayData.backgroundColor; // Get new row background color
    const newRowFontColor = editedRowDescDayData.fontColor;         // Get new row font color
    const newDayNum = parseInt(newDay);

    if (!newDescription || !newDay) {
      setCellError("Description and Day cannot be empty.");
      return;
    }
    if (isNaN(newDayNum) || newDayNum < 1 || newDayNum > 31) {
      setCellError("Invalid Day (1-31).");
      return;
    }
    setCellError(null);

    const entriesToUpdate = cashflows.filter(
      (cf) =>
        cf.description === originalDescription &&
        getDayOfMonth(cf.flow_date) === originalDay &&
        cf.flow_type === flowType
    );

    if (entriesToUpdate.length === 0) {
      handleCancelRowDescDayEdit();
      return;
    }

    const updatePromises = entriesToUpdate.map(entry => {
      const [year, month, _] = entry.flow_date.split('-');
      const newFlowDate = `${year}-${month}-${String(newDayNum).padStart(2, '0')}`;

      const payload: Partial<CashflowDBUpdate> = {
        description: newDescription,
        flow_date: newFlowDate,
        background_color_code: newRowBackgroundColor, // Apply new row background color to all entries
        font_color_code: newRowFontColor,           // Apply new row font color to all entries
      };
      return onUpdateAmount(entry.id, payload);
    });

    try {
      const results = await Promise.all(updatePromises);
      const allSucceeded = results.every(res => res !== null);

      if (allSucceeded) {
        handleCancelRowDescDayEdit();
        if (onDataChange) {
          await onDataChange(tableIdentifier);
        }
      } else {
        setCellError("Failed to update some entries.");
      }
    } catch (error) {
      console.error("Error updating entries:", error);
      setCellError("Error updating entries.");
    }
  };

  // Calculate monthly totals for the summary footer
  const monthlySums = useMemo(() => {
    const sums: { [monthYear: string]: number } = {};
    displayedMonthColumns.forEach(month => sums[month] = 0);
    
    processedRows.forEach(row => {
      if (flowType === 'inflow') {
        displayedMonthColumns.forEach(month => {
          if (row.amounts[month]?.value && row.amounts[month].value !== '-') {
            sums[month] += parseFloat(row.amounts[month].value);
          }
        });
      } else if (flowType === 'outflow') {
        if (!row.isSystemRow) { 
          displayedMonthColumns.forEach(month => {
            if (row.amounts[month]?.value && row.amounts[month].value !== '-') {
              sums[month] += parseFloat(row.amounts[month].value);
            }
          });
        }
      }
    });
    return sums;
  }, [processedRows, displayedMonthColumns, flowType]);

  // Get inflow sums for net calculation in outflow table
  const getInflowSums = useCallback(() => {
    if (flowType !== 'outflow') return null;
    const sums: { [monthYear: string]: number } = {};
    displayedMonthColumns.forEach(month => sums[month] = 0);
    
    const inflowData = inflowCashflows || [];
    inflowData.forEach(cf => {
      const monthYear = formatMonthYear(cf.flow_date);
      if (displayedMonthColumns.includes(monthYear)) {
        const amount = cf.amount; 
        if (!isNaN(amount)) {
          sums[monthYear] = (sums[monthYear] || 0) + amount;
        }
      }
    });
    return sums;
  }, [inflowCashflows, displayedMonthColumns, flowType]);
  
  // Calculate net values (inflow - outflow) for outflow table
  const netValues = useMemo(() => {
    if (flowType !== 'outflow') return {};

    if (trueNetBalanceByMonth) {
      const result: { [monthYear: string]: number } = {};
      displayedMonthColumns.forEach(month => {
        result[month] = trueNetBalanceByMonth[month] || 0;
      });
      return result;
    }

    const inflows = getInflowSums();
    if (!inflows) return {};
    const result: { [monthYear: string]: number } = {};
    displayedMonthColumns.forEach(month => {
      result[month] = (inflows[month] || 0) - monthlySums[month];
    });
    return result;
  }, [monthlySums, displayedMonthColumns, flowType, getInflowSums, trueNetBalanceByMonth]);

  const handleSaveCellDataFromPopover = async (cellKey: string, updatedData: EditCellFormData) => { 
    if (!cellKey) return;

    const [description, day, monthYear] = cellKey.split("_"); // Parse key passed from row
    
    const amountNum = parseFloat(updatedData.value);
    if (isNaN(amountNum)) {
      console.error("Invalid amount from popover form.");
      // Potentially set an error state to show to the user at table level if needed
      return;
    }

    const parsedDateInfo = parseMonthYear(monthYear);
    if (!parsedDateInfo) {
      console.error("Invalid date column for saving cell edit from popover.");
      return;
    }
    
    const targetDate = `${parsedDateInfo.year}-${String(parsedDateInfo.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find the specific entry for this cell
    const originalEntry = cashflows.find(
      (cf) => cf.description === description && cf.flow_date === targetDate
    );

    // First, update/create the specific cell that was edited
    let result: CashflowDBRow | null = null;
    if (originalEntry) {
      const payload: Partial<CashflowDBUpdate> = { 
        amount: amountNum,
        background_color_code: updatedData.backgroundColor,
        font_color_code: updatedData.fontColor,
      }; 
      result = await onUpdateAmount(originalEntry.id, payload);
    } else {
      const payload: CashflowDBInsert = {
        description,
        flow_date: targetDate,
        amount: amountNum,
        flow_type: flowType,
        user_id: userId,
        category: "", 
        background_color_code: updatedData.backgroundColor, 
        font_color_code: updatedData.fontColor,
      };
      result = await onAddEntry(payload);
    }

    if (result) {
      // Now update ALL other cells in the same row to have the same colors
      const allEntriesInRow = cashflows.filter(
        (cf) => cf.description === description && 
                getDayOfMonth(cf.flow_date) === day && 
                cf.flow_type === flowType &&
                cf.flow_date !== targetDate // Exclude the cell we just updated
      );

      // Update colors for all other cells in the same row
      const colorUpdatePromises = allEntriesInRow.map(entry => {
        const colorPayload: Partial<CashflowDBUpdate> = {
          background_color_code: updatedData.backgroundColor,
          font_color_code: updatedData.fontColor,
        };
        return onUpdateAmount(entry.id, colorPayload);
      });

      // Wait for all color updates to complete
      try {
        await Promise.all(colorUpdatePromises);
        console.log(`Updated colors for ${colorUpdatePromises.length} other cells in the row`);
      } catch (error) {
        console.error("Error updating row colors:", error);
      }

      setEditingCellKeyForPopover(null); // Close popover (CashflowMatrixRow also does this)
      if (onDataChange) {
        await onDataChange(tableIdentifier);
      }
    } else {
      console.error("Failed to save cell changes from popover.");
      // Potentially set a table-level error state here
    }
  };

  // --- Handler to open the Edit Row Dialog ---
  const openEditRowDialog = (row: ProcessedRow) => {
    if (row.isSystemRow) return;
    // Construct the initial data for the dialog
    const dialogData: EditDialogRowData = {
      originalDescription: row.description,
      originalDay: row.day,
      description: row.description,
      day: row.day, 
      note: row.note, 
      currentNote: row.note,
      // Base other fields from CashflowDBUpdate as needed, e.g., user_id, flow_type if they are part of that type definition
      // For fields not directly edited in this dialog but part of CashflowDBUpdate, 
      // they might not need to be explicitly set here if Partial<CashflowDBUpdate> handles it well.
      user_id: userId, // This would be required if EditDialogRowData extends CashflowDBUpdate directly which needs it
      flow_type: flowType,
    };
    setEditingRowForDialog(dialogData);
    setIsEditDialogOpen(true);
  };
  
  // --- Handler for saving from Edit Row Dialog ---
  const handleSaveFromEditDialog = async (updatedData: EditDialogRowData) => { // Parameter type updated
    const { originalDescription, originalDay, description: newDescription, day: newDay, note: newNote } = updatedData;
    
    if (!newDescription || !newDay) {
      setCellError("Description and Day cannot be empty in dialog."); // Or use a dialog-specific error state
      return;
    }
    const newDayNum = parseInt(newDay);
    if (isNaN(newDayNum) || newDayNum < 1 || newDayNum > 31) {
      setCellError("Invalid Day (1-31) in dialog.");
      return;
    }
    setCellError(null);

    const entriesToUpdate = cashflows.filter(
      (cf) =>
        cf.description === originalDescription &&
        getDayOfMonth(cf.flow_date) === originalDay &&
        cf.flow_type === flowType
    );

    if (entriesToUpdate.length === 0) {
      setIsEditDialogOpen(false);
      return;
    }

    const updatePromises = entriesToUpdate.map(entry => {
      const [year, month, _] = entry.flow_date.split('-');
      const newFlowDate = `${year}-${month}-${String(newDayNum).padStart(2, '0')}`;

      const payload: Partial<CashflowDBUpdate> = {
        description: newDescription.trim(),
        flow_date: newFlowDate,
        note: newNote !== undefined && newNote !== null ? newNote.trim() : null, // Handle undefined and null, then trim
        // If colors are part of the dialog, add them here:
        // background_color_code: updatedData.background_color_code,
        // font_color_code: updatedData.font_color_code,
      };
      return onUpdateAmount(entry.id, payload);
    });

    try {
      const results = await Promise.all(updatePromises);
      const allSucceeded = results.every(res => res !== null);

      if (allSucceeded) {
        setIsEditDialogOpen(false);
        setEditingRowForDialog(null);
        if (onDataChange) {
          await onDataChange(tableIdentifier);
        }
      } else {
        setCellError("Failed to update some entries from dialog."); // Or dialog-specific error
      }
    } catch (error) {
      console.error("Error updating entries from dialog:", error);
      setCellError("Error updating entries from dialog."); // Or dialog-specific error
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold dark:text-gray-100">{title}</h3>
        {/* Add Row Button (Triggers Dialog) */}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            setCellError(null);
            setIsAddDialogOpen(true);
          }}
        >
          <PlusCircle size={16} className="mr-1" /> Add {title}
        </Button>
      </div>

      <div className="shadow border border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-x-auto relative isolate">
        <Table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className={`${thClass} sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "220px", width: "220px" }}>Description</TableHead>
              <TableHead className={`${thClass} sticky left-[220px] z-30 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "60px", width: "60px" }}>
                Day
              </TableHead>
              {displayedMonthColumns.map((monthYear) => (
                <TableHead
                  key={monthYear}
                  className={`${thClass} text-center ${
                    monthYear === currentMonthYear
                      ? "bg-blue-50 dark:bg-blue-900/30 font-semibold"
                      : ""
                  }`}
                  style={{ width: "100px" }}
                >
                  {monthYear}
                </TableHead>
              ))}
              <TableHead className={thClass} style={{ width: "40px" }}>
                <Popover
                  open={addMonthPopoverOpen}
                  onOpenChange={setAddMonthPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1" disabled={availableMonthsToAdd.length === 0}>
                      <PlusCircle
                        size={16}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Add Month Column</p>
                      {availableMonthsToAdd.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={yearToAdd} 
                              onValueChange={(value) => {
                                setYearToAdd(value);
                                // Reset month when year changes
                                const monthsForYear = availableMonthsToAdd.filter(opt => opt.year === value);
                                if (monthsForYear.length > 0) {
                                  setMonthToAdd(monthsForYear[0].month);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(new Set(availableMonthsToAdd.map(opt => opt.year)))
                                  .sort()
                                  .map((year) => (
                                    <SelectItem key={year} value={year}>
                                      {year}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={monthToAdd}
                              onValueChange={setMonthToAdd}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Month" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableMonthsToAdd
                                  .filter(opt => opt.year === yearToAdd)
                                  .map((option) => (
                                    <SelectItem key={option.month} value={option.month}>
                                      {option.monthYear}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            className="w-full h-8"
                            onClick={handleAddMonthColumn}
                          >
                            Add Column
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-2">
                          All available months are already displayed
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200 dark:bg-gray-950 dark:divide-gray-700">
            {processedRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2 + displayedMonthColumns.length + 1}
                  className="text-center py-4 text-gray-500 dark:text-gray-400"
                >
                  No {flowType} data available.
                </TableCell>
              </TableRow>
            )}
            {processedRows.map((row, index) => {
              return (
                <CashflowMatrixRow
                  editingCellKeyForPopover={editingCellKeyForPopover}
                  setEditingCellKeyForPopover={setEditingCellKeyForPopover}
                  key={`${row.description}-${row.day}-${index}`}
                  row={row}
                  index={index}
                  displayedMonthColumns={displayedMonthColumns}
                  loading={loading}
                  tdClass={tdClass}
                  inputClass={inputClass}
                  actionButtonClass={actionButtonClass}
                  flowType={flowType}
                  handleSaveCellData={handleSaveCellDataFromPopover}
                  openEditRowDialog={openEditRowDialog}
                  handleDeleteRow={handleDeleteRow}
                />
              );
            })}
          </TableBody>
          {processedRows.length > 0 && (
            <TableFooter className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
              {/* Total Row */}
              <TableRow>
                <TableCell className={`${tdClass} font-semibold sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "220px", width: "220px" }} colSpan={1}>
                  Total {flowType === 'inflow' ? 'Cash Inflow' : 'Cash Outflow'}
                </TableCell>
                <TableCell className={`${tdClass} text-center sticky left-[220px] z-20 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "60px", width: "60px" }}>
                  &nbsp;
                </TableCell>
                {displayedMonthColumns.map(month => (
                  <TableCell 
                    key={`total-${month}`} 
                    className={`${tdClass} text-center font-semibold`} 
                    style={{ width: "100px" }}
                  >
                    {monthlySums[month].toFixed(2)}
                  </TableCell>
                ))}
                <TableCell className={`${tdClass} text-center`} style={{ width: "40px" }}>
                  &nbsp;
                </TableCell>
              </TableRow>
              
              {/* Net Row - Only for Outflow Table */}
              {flowType === 'outflow' && (
                <TableRow className="bg-slate-100 dark:bg-slate-800/60">
                  <TableCell className={`${tdClass} font-semibold text-blue-600 dark:text-blue-400 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800/60 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "220px", width: "220px" }} colSpan={1}>
                    Net Cash Flow
                  </TableCell>
                  <TableCell className={`${tdClass} text-center sticky left-[220px] z-20 bg-slate-100 dark:bg-slate-800/60 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`} style={{ minWidth: "60px", width: "60px" }}>
                    &nbsp;
                  </TableCell>
                  {displayedMonthColumns.map(month => (
                    <TableCell 
                      key={`net-${month}`} 
                      className={`${tdClass} text-center font-semibold ${
                        netValues[month] < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                      style={{ width: "100px" }}
                    >
                      {netValues[month]?.toFixed(2) || '0.00'}
                    </TableCell>
                  ))}
                  <TableCell className={`${tdClass} text-center`} style={{ width: "40px" }}>
                    &nbsp;
                  </TableCell>
                </TableRow>
              )}
            </TableFooter>
          )}
        </Table>
      </div>
      {/* Add New Entry Dialog Render */}
      <AddCashflowEntryDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        userId={userId}
        flowType={flowType}
        displayedMonthColumns={displayedMonthColumns}
        processedRows={processedRows.filter(row => !row.isSystemRow)} // Exclude system rows from being passed to dialog for duplicate check
        onAddEntry={handleAddRow}
        loading={isProcessingNewRow}
        inputClass={inputClass}
      />
      {/* Render EditCashflowRowDialog (to be created) */}
      {editingRowForDialog && (
        <EditCashflowRowDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          rowData={editingRowForDialog}
          onSave={handleSaveFromEditDialog}
          inputClass={inputClass} // Pass inputClass
          // Pass other necessary props like loading state for this dialog
          // loading={isSavingFromDialog} // You might need a specific loading state for this dialog
        />
      )}
    </div>
  );
};
