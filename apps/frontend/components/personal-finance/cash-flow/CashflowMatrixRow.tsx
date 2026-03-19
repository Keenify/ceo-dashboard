"use client";

import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, MessageSquareText } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditCellForm, EditCellFormData } from './EditCellForm';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_FONT_COLOR,
} from '@/app/personal-finance/constants/colorPalettes';
import type { ProcessedRow } from './CashflowMatrixTable';

interface CashflowMatrixRowProps {
    row: ProcessedRow;
    index: number;
    displayedMonthColumns: string[];
    editingCellKeyForPopover: string | null;
    setEditingCellKeyForPopover: (key: string | null) => void;
    loading: boolean;
    tdClass: string;
    inputClass: string;
    actionButtonClass: string;
    flowType: 'inflow' | 'outflow';
    handleSaveCellData: (cellKey: string, data: EditCellFormData) => void;
    openEditRowDialog: (row: ProcessedRow) => void;
    handleDeleteRow: (description: string, day: string, flowType: 'inflow' | 'outflow') => Promise<void>;
}

export const CashflowMatrixRow: React.FC<CashflowMatrixRowProps> = ({
    row,
    index,
    displayedMonthColumns,
    editingCellKeyForPopover,
    setEditingCellKeyForPopover,
    loading,
    tdClass,
    inputClass,
    actionButtonClass,
    flowType,
    handleSaveCellData,
    openEditRowDialog,
    handleDeleteRow,
}) => {

    const isSystemRow = row.isSystemRow === true;

    const getCellKey = (desc: string, rDay: string, mYear: string) => `${desc}_${rDay}_${mYear}`;

    // Get row-level colors from cells with actual color data
    const getRowColors = () => {
        if (isSystemRow) {
            return { backgroundColor: undefined, color: undefined };
        }
        
        // Look for the first cell that has explicit color data
        for (const monthYear of displayedMonthColumns) {
            const cellData = row.amounts[monthYear];
            // Check if we have color data set (even if it's default colors)
            if (cellData && cellData.backgroundColor && cellData.fontColor) {
                return {
                    backgroundColor: cellData.backgroundColor,
                    color: cellData.fontColor
                };
            }
        }
        
        // No colors found, return undefined
        return { backgroundColor: undefined, color: undefined };
    };

    const rowColors = getRowColors();
    
    // Apply colors if they exist (including default colors if explicitly set)
    const rowStyle = rowColors.backgroundColor && rowColors.color ? {
        backgroundColor: rowColors.backgroundColor,
        color: rowColors.color
    } : {};

    // For sticky columns, inherit the same colors as the row
    const stickyColumnStyle = rowColors.backgroundColor && rowColors.color ? {
        backgroundColor: rowColors.backgroundColor,
        color: rowColors.color
    } : {};

    return (
        <TableRow 
            key={`${row.description}-${row.day}-${index}`}
            className={`group hover:relative ${isSystemRow ? 'bg-slate-100 dark:bg-slate-800/60' : ''}`}
            style={rowStyle}
        >
             <TableCell 
                className={`${tdClass} ${isSystemRow ? 'font-semibold' : ''} sticky left-0 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] relative`}
                style={{ 
                    minWidth: "220px", 
                    width: "220px",
                    ...stickyColumnStyle
                }}
             >
                <div className="flex items-center space-x-1.5 overflow-hidden pr-1">
                    {row.note && !isSystemRow && (
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <MessageSquareText size={14} className="flex-shrink-0 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs break-words bg-gray-800 text-white p-2 rounded-md shadow-lg z-50">
                                    <p>{row.note}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <span className="truncate block w-full">{row.description}</span>
                 </div>
                 
                 {/* Hover Actions - positioned absolutely within the description cell */}
                 {!isSystemRow && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 z-30 bg-white dark:bg-gray-950 rounded shadow-sm border border-gray-200 dark:border-gray-700 px-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`${actionButtonClass} text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 h-6 w-6 p-0`} 
                            onClick={() => openEditRowDialog(row)} 
                            disabled={loading || !!editingCellKeyForPopover} 
                            title="Edit Details"
                        >
                            <Pencil size={12} />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`${actionButtonClass} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 h-6 w-6 p-0`} 
                            onClick={() => handleDeleteRow(row.description, row.day, flowType)} 
                            disabled={loading || !!editingCellKeyForPopover} 
                            title="Delete Row"
                        >
                            <Trash2 size={12} />
                        </Button>
                    </div>
                 )}
             </TableCell>
             <TableCell 
                className={`${tdClass} text-center sticky left-[220px] z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]`}
                style={{ 
                    minWidth: "60px", 
                    width: "60px",
                    ...stickyColumnStyle
                }}
            >
                 <span className="inline-block w-full text-center">{row.day}</span>
             </TableCell>
              {displayedMonthColumns.map(monthYear => {
                 const cellData = row.amounts[monthYear];
                 const currentCellKey = getCellKey(row.description, row.day, monthYear);
                 const isThisCellPopoverOpen = editingCellKeyForPopover === currentCellKey;

                 // All month columns have the same basic styling - colors are inherited from row
                 const cellStyle = { width: "100px", textAlign: "center" as "center" };

                 return (
                    <Popover 
                        key={currentCellKey} 
                        open={isThisCellPopoverOpen} 
                        onOpenChange={(open) => {
                            if (open && !isSystemRow) {
                                setEditingCellKeyForPopover(currentCellKey);
                            } else {
                                setEditingCellKeyForPopover(null);
                            }
                        }}
                    >
                        <TableCell 
                            className={`${tdClass} text-center relative group`}
                            style={cellStyle}
                        >
                            <PopoverTrigger asChild disabled={isSystemRow}>
                                <span 
                                    className={`px-1 rounded min-h-[28px] inline-block w-full text-center ${isSystemRow ? '' : 'cursor-pointer'}`}
                                >
                                    {(() => {
                                        if (cellData?.value === undefined || cellData.value === null || cellData.value.trim() === "") return "-";
                                        if (cellData.value === "-") return "-"; 
                                        const num = parseFloat(cellData.value);
                                        if (isNaN(num)) {
                                            return isSystemRow ? "0.00" : "-"; 
                                        }
                                        return num.toFixed(2);
                                    })()}
                                </span>
                            </PopoverTrigger>
                        </TableCell>
                        <PopoverContent 
                            className="p-0 w-auto z-50"
                            side="bottom" 
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            {cellData ? (
                                <EditCellForm 
                                    initialData={{
                                        value: cellData.value === '-' || cellData.value.trim() === '' ? '' : cellData.value,
                                        backgroundColor: cellData.backgroundColor || DEFAULT_BACKGROUND_COLOR,
                                        fontColor: cellData.fontColor || DEFAULT_FONT_COLOR,
                                    }}
                                    onSave={(updatedData) => {
                                        handleSaveCellData(currentCellKey, updatedData);
                                        setEditingCellKeyForPopover(null);
                                    }}
                                    onCancel={() => setEditingCellKeyForPopover(null)}
                                    inputClass={inputClass}
                                />
                            ) : null}
                        </PopoverContent>
                    </Popover>
                          );
                     })}
        </TableRow>
    );
}; 