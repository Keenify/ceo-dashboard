"use client";

import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { EditNetWorthValueForm } from "./EditNetWorthValueForm";
import { Pencil, Trash2 } from "lucide-react";

// Types for section data
export interface NetWorthTableSectionProps {
    sectionName: string;
    sectionData: {
        items: {
            [itemName: string]: {
                valuesByDate: { [date: string]: number | null };
                originalEntryDetails?: { [date: string]: { id: string } };
            };
        };
        totalsByDate?: { [date: string]: number };
    };
    snapshotDates: string[];
    sectionIndex: number;
    entryType: "personal" | "business";
    entryCategory: "asset" | "liability";
    onEditItem: (sectionName: string, itemName: string, entryType: "personal" | "business", entryCategory: "asset" | "liability") => void;
    onDeleteItem: (sectionName: string, itemName: string, entryType: "personal" | "business", entryCategory: "asset" | "liability") => void;
    onEditValue: (sectionName: string, itemName: string, snapshotDate: string, newValue: number | null, entryType: "personal" | "business", entryCategory: "asset" | "liability") => Promise<boolean>;
    onRenameSection?: (sectionName: string, newSectionName: string, entryType: "personal" | "business", entryCategory: "asset" | "liability") => Promise<boolean>;
    editingCellKey: string | null;
    setEditingCellKey: (key: string | null) => void;
    hoveredCol: number | null;
    setHoveredCol: (col: number | null) => void;
}

const sectionRowColors = [
    'bg-white dark:bg-gray-950',
    'bg-slate-50 dark:bg-slate-900',
];

export const SectionHeaderRow: React.FC<Pick<NetWorthTableSectionProps, 'sectionName' | 'sectionIndex' | 'snapshotDates' | 'entryType' | 'entryCategory' | 'onRenameSection'> & { onDeleteSection?: (sectionName: string, entryType: "personal" | "business", entryCategory: "asset" | "liability") => void }> = ({ sectionName, sectionIndex, snapshotDates, entryType, entryCategory, onRenameSection, onDeleteSection }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [newSectionName, setNewSectionName] = useState(sectionName);
    
    const sectionBgColor = sectionIndex % 2 === 0 ? 'bg-sky-50 dark:bg-sky-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30';
    const sectionHeaderColor = sectionIndex % 2 === 0 ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300';
    
    const handleRenameClick = () => {
        setIsRenaming(true);
        setNewSectionName(sectionName);
    };
    
    const handleRenameCancel = () => {
        setIsRenaming(false);
        setNewSectionName(sectionName);
    };
    
    const handleRenameSubmit = async () => {
        if (!newSectionName.trim() || newSectionName.trim() === sectionName) {
            setIsRenaming(false);
            return;
        }
        
        if (onRenameSection) {
            const success = await onRenameSection(sectionName, newSectionName.trim(), entryType, entryCategory);
            if (success) {
                setIsRenaming(false);
            }
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            handleRenameCancel();
        }
    };
    
    return (
        <TableRow className="group">
            <TableCell className={`text-lg font-semibold px-2 py-1 rounded-t-md ${sectionBgColor} ${sectionHeaderColor}`}>
                {isRenaming ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            onKeyDown={handleKeyPress}
                            onBlur={handleRenameSubmit}
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRenameCancel}
                            className="text-xs px-2 py-3"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <span>{sectionName}</span>
                )}
            </TableCell>
            {snapshotDates.map((_, colIndex) => (
                <TableCell key={`header-${colIndex}`} className={`${sectionBgColor} col-${colIndex} py-1`}></TableCell>
            ))}
            <TableCell className={`${sectionBgColor} px-2 py-3 text-center`}>
                <div className={`flex gap-2 items-center justify-center ${(onRenameSection || onDeleteSection) && !isRenaming ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-200' : ''}`}>
                    {onRenameSection && !isRenaming && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRenameClick}
                            className="text-blue-600 hover:text-blue-800 p-0 h-7 w-10"
                            title="Rename Section"
                        >
                            <Pencil size={16} />
                        </Button>
                    )}
                    {onDeleteSection && !isRenaming && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteSection(sectionName, entryType, entryCategory)}
                            className="text-red-600 hover:text-red-800 p-0 h-7 w-10"
                            title="Delete Section"
                        >
                            <Trash2 size={16} />
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
};

export const SectionItemRows: React.FC<NetWorthTableSectionProps> = ({
    sectionName,
    sectionData,
    snapshotDates,
    sectionIndex,
    entryType,
    entryCategory,
    onEditItem,
    onDeleteItem,
    onEditValue,
    editingCellKey,
    setEditingCellKey,
    hoveredCol,
    setHoveredCol,
}) => {
    return <>
        {Object.entries(sectionData.items).map(([itemName, itemData], itemIndex) => {
            const itemRowKey = `${sectionName}-${itemName}`;
            return (
                <TableRow key={itemRowKey} className={`group ${itemIndex % 2 === 0 ? sectionRowColors[0] : sectionRowColors[1]}`}>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{itemName}</TableCell>
                    {snapshotDates.map((_, colIndex) => {
                        const cellKey = `${itemRowKey}_${snapshotDates[colIndex]}`;
                        const cellValue = itemData.valuesByDate[snapshotDates[colIndex]];
                        return (
                            <TableCell key={cellKey} className={`px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right col-${colIndex} ${hoveredCol === colIndex ? 'networth-col-hover' : ''}`}
                                onMouseEnter={() => setHoveredCol(colIndex)}
                                onMouseLeave={() => setHoveredCol(null)}>
                                <Popover open={editingCellKey === cellKey} onOpenChange={(open) => {
                                    if (open) setEditingCellKey(cellKey); else setEditingCellKey(null);
                                }}>
                                    <PopoverTrigger asChild>
                                        <span className="w-full h-full block cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                                            {cellValue !== undefined && cellValue !== null
                                                ? `$${cellValue.toFixed(2)}`
                                                : '-'}
                                        </span>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <EditNetWorthValueForm
                                            initialValue={cellValue}
                                            onSave={(formData) => onEditValue(sectionName, itemName, snapshotDates[colIndex], formData.value, entryType, entryCategory)}
                                            onCancel={() => setEditingCellKey(null)}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </TableCell>
                        );
                    })}
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm">
                        <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-blue-600 hover:text-blue-800 p-1"
                                onClick={() => onEditItem(sectionName, itemName, entryType, entryCategory)}
                                title="Edit Item"
                            >
                                <Pencil size={16} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-800 p-1"
                                onClick={() => onDeleteItem(sectionName, itemName, entryType, entryCategory)}
                                title="Delete All Entries for Item"
                            >
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
            );
        })}
    </>;
};

export const SectionTotalRow: React.FC<Pick<NetWorthTableSectionProps, 'sectionName' | 'sectionData' | 'snapshotDates' | 'sectionIndex'> & { hoveredCol: number | null; setHoveredCol: (col: number | null) => void }> = ({ sectionName, sectionData, snapshotDates, sectionIndex, hoveredCol, setHoveredCol }) => {
    const sectionBgColor = sectionIndex % 2 === 0 ? 'bg-sky-50 dark:bg-sky-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30';
    const sectionHeaderColor = sectionIndex % 2 === 0 ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300';
    return (
        <TableRow className={`border-t-2 ${sectionBgColor} font-semibold ${sectionHeaderColor}`}>
            <TableCell className="px-3 py-2 text-sm">Total {sectionName}</TableCell>
            {snapshotDates.map((_, colIndex) => (
                <TableCell key={`total-${colIndex}`} className={`px-3 py-2 text-sm text-right col-${colIndex} ${hoveredCol === colIndex ? 'networth-col-hover' : ''}`}
                    onMouseEnter={() => setHoveredCol(colIndex)}
                    onMouseLeave={() => setHoveredCol(null)}>
                    ${(sectionData.totalsByDate?.[snapshotDates[colIndex]] || 0).toFixed(2)}
                </TableCell>
            ))}
            <TableCell></TableCell>
        </TableRow>
    );
};

<style jsx global>{`
  .networth-col-hover {
    background-color: #e0f2fe !important; /* Tailwind sky-100 */
    transition: background 0.15s;
  }
  .dark .networth-col-hover {
    background-color: #0c4a6e !important; /* Tailwind sky-900 */
  }
`}</style> 