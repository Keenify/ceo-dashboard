"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddNetworthEntryDialog, NewNetworthEntryData, ExistingSectionItemCombinations, ExistingEntryWithDate } from './AddNetworthEntryDialog';
import { EditNetWorthValueForm, EditNetWorthValueFormData } from './EditNetWorthValueForm';
import { EditNetWorthItemDialog, EditNetWorthItemData } from './EditNetWorthItemDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { 
    useNetworth, 
    NetworthDBRow, 
    NetworthDBInsert, 
    NetworthDBUpdate 
} from '@/app/personal-finance/services/useNetworth';
import { SectionHeaderRow, SectionItemRows, SectionTotalRow } from "./NetWorthTableSection";

// Define props
export interface NetWorthSectionProps {
  userId: string | undefined; // Allow undefined to handle loading states from parent gracefully
}

// Placeholder types for data structure - will be replaced by NetworthDBRow from useNetworth.ts
interface PlaceholderNetWorthEntry extends NetworthDBRow {}

// Structure for processed data for the table
interface ProcessedTableData {
  [sectionName: string]: {
    items: {
      [itemName: string]: {
        valuesByDate: { [date: string]: number | null };
        // Store original entry IDs for updates/deletes if multiple entries make up one item-date cell (e.g. if name is null initially)
        // For now, assume one entry per item-date cell for simplicity in this placeholder
        originalEntryDetails?: { [date: string]: {id: string} }; 
      };
    };
    // Store section-level totals per date
    totalsByDate?: { [date: string]: number };
  };
}

interface EditingItemDetails {
    sectionName: string;
    itemName: string;
    entryType: "personal" | "business";
    entryCategory: "asset" | "liability";
}

// Example alternating colors for section item rows
const sectionRowColors = [
  'bg-white dark:bg-gray-950',
  'bg-slate-50 dark:bg-slate-900',
];

export const NetWorthSection: React.FC<NetWorthSectionProps> = ({ userId }) => {
  const [allEntries, setAllEntries] = useState<NetworthDBRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [dialogContext, setDialogContext] = useState<{ type: "personal" | "business"; category: "asset" | "liability"; }>({ type: 'personal', category: 'asset' });
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editingItemDetails, setEditingItemDetails] = useState<EditingItemDetails | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const {
    addNetworthEntry: apiAddNetworthEntry,
    fetchNetworthEntries: apiFetchNetworthEntries,
    updateNetworthEntry: apiUpdateNetworthEntry,
    deleteNetworthEntriesByNameAndSection: apiDeleteNetworthEntriesByNameAndSection,
    deleteNetworthEntriesBySection: apiDeleteNetworthEntriesBySection,
    renameSectionEntries: apiRenameSectionEntries,
  } = useNetworth();

  const handleOpenAddDialog = (type: "personal" | "business", category: "asset" | "liability") => {
    if (!userId) {
        alert("User ID is missing. Cannot add entry.");
        return;
    }
    setDialogContext({ type, category });
    setIsAddEntryDialogOpen(true);
  };

  const handleDialogAddEntry = async (payloadFromDialog: NewNetworthEntryData): Promise<boolean> => {
    if (!userId) {
        console.error("Add failed: userId is missing in handleDialogAddEntry");
        return false;
    }
    const apiPayload: NetworthDBInsert = {
        ...payloadFromDialog,
        user_id: userId,
        name: payloadFromDialog.name || null,
        value: payloadFromDialog.value === null || isNaN(payloadFromDialog.value as any) ? null : payloadFromDialog.value,
    };
    const result = await apiAddNetworthEntry(apiPayload);
    if (result) {
        loadNetWorthData();
        return true;
    }
    return false;
  };

  const handleSaveCellValue = async (sectionName: string, itemName: string, snapshotDate: string, newValue: number | null, entryType: "personal" | "business", entryCategory: "asset" | "liability") => {
    if (!userId) return false;
    const categoryKey = entryCategory === 'asset' ? 'assets' : 'liabilities';
    const existingEntryDetail = processedDataForTabs[entryType][categoryKey][sectionName]?.items[itemName]?.originalEntryDetails?.[snapshotDate];
    
    let success = false;
    if (existingEntryDetail?.id) {
        const updatePayload: NetworthDBUpdate = { value: newValue };
        const result = await apiUpdateNetworthEntry(existingEntryDetail.id, userId, updatePayload);
        if (result) success = true;
    } else {
        const insertPayload: NetworthDBInsert = {
            user_id: userId,
            type: entryType,
            category: entryCategory,
            section: sectionName,
            name: itemName === 'Unnamed Item' ? null : itemName,
            snapshot_date: snapshotDate,
            value: newValue,
        };
        const result = await apiAddNetworthEntry(insertPayload);
        if (result) success = true;
    }

    if (success) {
        setEditingCellKey(null);
        loadNetWorthData();
    }
    return success;
  };

  const handleOpenEditItemDialog = (sectionName: string, itemName: string, entryType: "personal" | "business", entryCategory: "asset" | "liability") => {
    if (!userId) {
        alert("User ID is missing. Cannot edit item.");
        return;
    }
    setEditingItemDetails({ sectionName, itemName, entryType, entryCategory });
    setIsEditItemDialogOpen(true);
  };

  const handleSaveItemEdit = async (data: EditNetWorthItemData): Promise<boolean> => {
    if (!editingItemDetails || !userId) return false;
    
    const entriesToUpdate = allEntries.filter(entry => 
        entry.type === editingItemDetails.entryType &&
        entry.category === editingItemDetails.entryCategory &&
        entry.section === data.originalSectionName &&
        (entry.name === data.originalItemName || (data.originalItemName === 'Unnamed Item' && entry.name === null))
    );

    if (entriesToUpdate.length === 0) {
        setIsEditItemDialogOpen(false); 
        return false; 
    }

    const updatePromises = entriesToUpdate.map(entry => 
        apiUpdateNetworthEntry(entry.id, userId, { name: data.newItemName })
    );

    try {
        const results = await Promise.allSettled(updatePromises);
        const allSucceeded = results.every(r => r.status === 'fulfilled' && r.value !== null);
        if (allSucceeded) {
            loadNetWorthData();
            setIsEditItemDialogOpen(false);
            setEditingItemDetails(null);
            return true;
        } else {
            console.error("Some item rename updates failed:", results.filter(r => r.status === 'rejected'));
            loadNetWorthData();
            return false;
        }
    } catch (err) {
        console.error("Error during batch item rename:", err);
        return false;
    }
  };

  const loadNetWorthData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
        const personalAssets = await apiFetchNetworthEntries(userId, undefined, undefined, 'personal', 'asset', undefined, undefined, undefined, true);
        const personalLiabilities = await apiFetchNetworthEntries(userId, undefined, undefined, 'personal', 'liability', undefined, undefined, undefined, true);
        const businessAssets = await apiFetchNetworthEntries(userId, undefined, undefined, 'business', 'asset', undefined, undefined, undefined, true);
        const businessLiabilities = await apiFetchNetworthEntries(userId, undefined, undefined, 'business', 'liability', undefined, undefined, undefined, true);
        
        const combinedEntries = [
            ...(personalAssets || []),
            ...(personalLiabilities || []),
            ...(businessAssets || []),
            ...(businessLiabilities || []),
        ];
        setAllEntries(combinedEntries);
    } catch (e) {
        console.error("Failed to load net worth data in component:", e);
        setAllEntries([]);
    }
    setLoading(false);
  }, [userId, apiFetchNetworthEntries]);

  useEffect(() => {
    if (userId) {
        loadNetWorthData();
    }
  }, [userId, loadNetWorthData]);

  const { processedDataForTabs, allSnapshotDates, uniqueSectionsAndItems } = useMemo(() => {
    const personalEntries = allEntries.filter(e => e.type === 'personal');
    const businessEntries = allEntries.filter(e => e.type === 'business');
    const dates = new Set<string>();
    allEntries.forEach(e => e.snapshot_date && dates.add(e.snapshot_date));
    const sortedDates = Array.from(dates).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    const getUniqueByCategory = (entries: NetworthDBRow[], categoryFilter: 'asset' | 'liability') => {
        const filteredEntries = entries.filter(e => e.category === categoryFilter);
        return {
            sections: Array.from(new Set(filteredEntries.map(e => e.section))).sort(),
            itemNames: Array.from(new Set(filteredEntries.map(e => e.name).filter(name => name !== null) as string[])).sort(),
        };
    };
    
    const processEntriesForTableLocal = (entries: NetworthDBRow[], snapshotDates: string[]): ProcessedTableData => {
        const processed: ProcessedTableData = {};
        entries.forEach(entry => {
            if (!entry.section) return;
            if (!processed[entry.section]) {
                processed[entry.section] = { items: {}, totalsByDate: {} };
                snapshotDates.forEach(date => processed[entry.section].totalsByDate![date] = 0);
            }
            const itemName = entry.name || 'Unnamed Item';
            if (!processed[entry.section].items[itemName]) {
                processed[entry.section].items[itemName] = { valuesByDate: {}, originalEntryDetails: {} };
            }
            if (entry.snapshot_date) {
                processed[entry.section].items[itemName].valuesByDate[entry.snapshot_date] = entry.value;
                if(processed[entry.section].items[itemName].originalEntryDetails && entry.id) { 
                  processed[entry.section].items[itemName].originalEntryDetails![entry.snapshot_date] = { id: entry.id };
                }
                if (entry.value !== null && processed[entry.section].totalsByDate?.[entry.snapshot_date] !== undefined) {
                  processed[entry.section].totalsByDate![entry.snapshot_date] = (processed[entry.section].totalsByDate![entry.snapshot_date] || 0) + entry.value!;
                }
            }
        });
        return processed;
    };

    return {
        processedDataForTabs: {
            personal: {
                assets: processEntriesForTableLocal(personalEntries.filter(e => e.category === 'asset'), sortedDates),
                liabilities: processEntriesForTableLocal(personalEntries.filter(e => e.category === 'liability'), sortedDates),
            },
            business: {
                assets: processEntriesForTableLocal(businessEntries.filter(e => e.category === 'asset'), sortedDates),
                liabilities: processEntriesForTableLocal(businessEntries.filter(e => e.category === 'liability'), sortedDates),
            }
        },
        allSnapshotDates: sortedDates,
        uniqueSectionsAndItems: { 
            personal: {
                assets: getUniqueByCategory(personalEntries, 'asset'),      
                liabilities: getUniqueByCategory(personalEntries, 'liability') 
            },
            business: {
                assets: getUniqueByCategory(businessEntries, 'asset'),      
                liabilities: getUniqueByCategory(businessEntries, 'liability') 
            }
        }
    };
  }, [allEntries]);

  function processEntriesForTable (entries: NetworthDBRow[], snapshotDates: string[]): ProcessedTableData {
    const processed: ProcessedTableData = {};
    entries.forEach(entry => {
        if (!processed[entry.section]) {
            processed[entry.section] = { items: {}, totalsByDate: {} };
            snapshotDates.forEach(date => processed[entry.section].totalsByDate![date] = 0);
        }
        const itemName = entry.name || 'Unnamed Item';
        if (!processed[entry.section].items[itemName]) {
            processed[entry.section].items[itemName] = { valuesByDate: {}, originalEntryDetails: {} };
        }
        processed[entry.section].items[itemName].valuesByDate[entry.snapshot_date] = entry.value;
        if(processed[entry.section].items[itemName].originalEntryDetails && entry.id) { 
          processed[entry.section].items[itemName].originalEntryDetails![entry.snapshot_date] = { id: entry.id };
        }
        if (entry.value !== null) {
          processed[entry.section].totalsByDate![entry.snapshot_date] = (processed[entry.section].totalsByDate![entry.snapshot_date] || 0) + entry.value!;
        }
    });
    return processed;
  };

  const renderNetWorthTabContent = (
    type: 'personal' | 'business',
    categoryData: { assets: ProcessedTableData, liabilities: ProcessedTableData }, 
    snapshotDates: string[]
  ) => {
    const processedAssets = categoryData.assets;
    const processedLiabilities = categoryData.liabilities;

    const calculateOverallTotalsByDate = (sectionsData: ProcessedTableData): { [date: string]: number } => {
        const overallTotals: { [date: string]: number } = {};
        snapshotDates.forEach(date => overallTotals[date] = 0);
        Object.values(sectionsData).forEach(section => {
            snapshotDates.forEach(date => {
                overallTotals[date] += section.totalsByDate?.[date] || 0;
            });
        });
        return overallTotals;
    };

    const overallAssetTotalsByDate = calculateOverallTotalsByDate(processedAssets);
    const overallLiabilityTotalsByDate = calculateOverallTotalsByDate(processedLiabilities);
    
    const netWorthByDate: { [date: string]: number } = {};
    snapshotDates.forEach(date => {
        netWorthByDate[date] = (overallAssetTotalsByDate[date] || 0) - (overallLiabilityTotalsByDate[date] || 0);
    });
    
    const latestDate = snapshotDates[snapshotDates.length -1] || 'N/A';
    const overallTotalAssets = overallAssetTotalsByDate[latestDate] || 0;
    const overallTotalLiabilities = overallLiabilityTotalsByDate[latestDate] || 0;
    const overallNetWorth = overallTotalAssets - overallTotalLiabilities;

    if (loading && allEntries.length === 0) {
      return <p className="text-center py-10 dark:text-gray-400">Loading net worth data...</p>;
    }

    if (!loading && allEntries.length === 0 && error) {
        return <p className="text-center py-10 text-red-500 dark:text-red-400">Error loading data: {error}</p>;
    }
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center mb-4">{type === 'business' ? 'Business Net Worth Statement' : 'Personal Net Worth Statement'}</h2>
        {error && !loading && <p className="text-red-500 dark:text-red-400 mb-4">Error: {error}</p>}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-2 ml-auto">
              <Button onClick={() => handleOpenAddDialog(type, 'asset')} size="sm" disabled={!userId || loading}>
                Add New Asset
              </Button>
              <Button onClick={() => handleOpenAddDialog(type, 'liability')} size="sm" disabled={!userId || loading}>
                Add New Liability
              </Button>
            </div>
          </div>
          <Table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 shadow border border-gray-200 dark:border-gray-700 rounded-md overflow-x-auto mb-8">
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></TableHead>
                {allSnapshotDates.map(date => (
                  <TableHead key={date} className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {new Date(date + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: '2-digit' })}
                  </TableHead>
                ))}
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20 min-w-20 max-w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Assets label row */}
              <TableRow className="bg-green-50 dark:bg-green-900/30">
                <TableCell colSpan={2 + allSnapshotDates.length} className="text-green-600 font-bold text-lg border-2 border-green-600 dark:border-green-400">ASSETS</TableCell>
              </TableRow>
              {/* Asset sections */}
              {Object.entries(processedAssets).map(([sectionName, sectionData], index) => (
                <React.Fragment key={sectionName}>
                  <SectionHeaderRow 
                    sectionName={sectionName} 
                    sectionIndex={index} 
                    snapshotDates={allSnapshotDates} 
                    entryType={type} 
                    entryCategory="asset" 
                    onRenameSection={handleRenameSection}
                    onDeleteSection={handleDeleteSection}
                  />
                  <SectionItemRows
                    sectionName={sectionName}
                    sectionData={sectionData}
                    snapshotDates={allSnapshotDates}
                    sectionIndex={index}
                    entryType={type}
                    entryCategory="asset"
                    onEditItem={handleOpenEditItemDialog}
                    onDeleteItem={handleDeleteItem}
                    onEditValue={handleSaveCellValue}
                    editingCellKey={editingCellKey}
                    setEditingCellKey={setEditingCellKey}
                    hoveredCol={hoveredCol}
                    setHoveredCol={setHoveredCol}
                  />
                  <SectionTotalRow sectionName={sectionName} sectionData={sectionData} snapshotDates={allSnapshotDates} sectionIndex={index} hoveredCol={hoveredCol} setHoveredCol={setHoveredCol} />
                </React.Fragment>
              ))}
              {/* Liabilities label row */}
              <TableRow className="bg-red-50 dark:bg-red-900/30">
                <TableCell colSpan={2 + allSnapshotDates.length} className="text-red-600 font-bold text-lg border-2 border-red-600 dark:border-red-400">LIABILITIES</TableCell>
              </TableRow>
              {/* Liability sections */}
              {Object.entries(processedLiabilities).map(([sectionName, sectionData], index) => (
                <React.Fragment key={sectionName}>
                  <SectionHeaderRow 
                    sectionName={sectionName} 
                    sectionIndex={index} 
                    snapshotDates={allSnapshotDates} 
                    entryType={type} 
                    entryCategory="liability" 
                    onRenameSection={handleRenameSection}
                    onDeleteSection={handleDeleteSection}
                  />
                  <SectionItemRows
                    sectionName={sectionName}
                    sectionData={sectionData}
                    snapshotDates={allSnapshotDates}
                    sectionIndex={index}
                    entryType={type}
                    entryCategory="liability"
                    onEditItem={handleOpenEditItemDialog}
                    onDeleteItem={handleDeleteItem}
                    onEditValue={handleSaveCellValue}
                    editingCellKey={editingCellKey}
                    setEditingCellKey={setEditingCellKey}
                    hoveredCol={hoveredCol}
                    setHoveredCol={setHoveredCol}
                  />
                  <SectionTotalRow sectionName={sectionName} sectionData={sectionData} snapshotDates={allSnapshotDates} sectionIndex={index} hoveredCol={hoveredCol} setHoveredCol={setHoveredCol} />
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <hr className="my-8 border-t-4 border-gray-400 dark:border-gray-600" />
        {/* Analysis Table at the bottom */}
        <Table className="min-w-full mb-8">
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></TableHead>
              {allSnapshotDates.map(date => (
                <TableHead key={date} className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {new Date(date + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: '2-digit' })}
                </TableHead>
              ))}
              <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 min-w-16 max-w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-green-50 dark:bg-green-900/30 font-bold">
              <TableCell className="px-3 py-2 text-green-700 dark:text-green-300">{type === 'business' ? 'Total Business Asset' : 'Total Personal Asset'}</TableCell>
              {allSnapshotDates.map(date => (
                <TableCell key={`asset-total-${date}`} className="px-3 py-2 text-right text-green-700 dark:text-green-300">
                  ${overallAssetTotalsByDate[date]?.toFixed(2) ?? '0.00'}
                </TableCell>
              ))}
              <TableCell className="w-16 min-w-16 max-w-16 px-14"></TableCell>
            </TableRow>
            <TableRow className="bg-red-50 dark:bg-red-900/30 font-bold">
              <TableCell className="px-3 py-2 text-red-700 dark:text-red-300">{type === 'business' ? 'Total Business Liabilities' : 'Total Personal Liabilities'}</TableCell>
              {allSnapshotDates.map(date => (
                <TableCell key={`liab-total-${date}`} className="px-3 py-2 text-right text-red-700 dark:text-red-300">
                  ${overallLiabilityTotalsByDate[date]?.toFixed(2) ?? '0.00'}
                </TableCell>
              ))}
              <TableCell className="w-16 min-w-16 max-w-16 px-14"></TableCell>
            </TableRow>
            <TableRow className="bg-blue-50 dark:bg-blue-900/30 font-bold">
              <TableCell className="px-3 py-2 text-blue-700 dark:text-blue-300">{type === 'business' ? 'Total Business Net Worth' : 'Total Net Worth'}</TableCell>
              {allSnapshotDates.map(date => (
                <TableCell key={`networth-total-${date}`} className="px-3 py-2 text-right text-blue-700 dark:text-blue-300">
                  ${(overallAssetTotalsByDate[date] - overallLiabilityTotalsByDate[date])?.toFixed(2)}
                </TableCell>
              ))}
              <TableCell className="w-16 min-w-16 max-w-16 px-14"></TableCell>
            </TableRow>
            <TableRow className="bg-yellow-50 dark:bg-yellow-900/30 font-bold">
              <TableCell className="px-3 py-2 text-yellow-700 dark:text-yellow-300">D2A Ratio</TableCell>
              {allSnapshotDates.map(date => {
                const asset = overallAssetTotalsByDate[date] || 0;
                const liab = overallLiabilityTotalsByDate[date] || 0;
                const ratio = asset > 0 ? (liab / asset) * 100 : null;
                return (
                  <TableCell key={`d2a-${date}`} className="px-3 py-2 text-right text-yellow-700 dark:text-yellow-300">
                    {asset > 0 && ratio !== null ? `${ratio.toFixed(1)}%` : '-'}
                  </TableCell>
                );
              })}
              <TableCell className="w-16 min-w-16 max-w-16 px-14"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };
  
  if (!userId && !loading && !error) {
    return <p className="p-4 text-orange-600 dark:text-orange-400">User ID is not available. Please ensure you are logged in.</p>;
  }
  if (!userId && loading) {
      return <p className="p-4 dark:text-gray-400">Loading user information...</p>;
  }

  const currentDialogSuggestions = dialogContext.type === 'personal'
    ? uniqueSectionsAndItems.personal[dialogContext.category === 'asset' ? 'assets' : 'liabilities']
    : uniqueSectionsAndItems.business[dialogContext.category === 'asset' ? 'assets' : 'liabilities']; 

  const currentEditItemDialogSuggestions = editingItemDetails ? 
    uniqueSectionsAndItems[editingItemDetails.entryType][editingItemDetails.entryCategory === 'asset' ? 'assets' : 'liabilities'].itemNames.filter(name => name !== editingItemDetails.itemName) 
    : [];

  // Generate existing section-item combinations for duplicate checking
  const currentExistingSectionItemCombinations: ExistingSectionItemCombinations = useMemo(() => {
    const categoryKey = dialogContext.category === 'asset' ? 'assets' : 'liabilities';
    const currentCategoryData = processedDataForTabs[dialogContext.type][categoryKey];
    
    const combinations: ExistingSectionItemCombinations = {};
    Object.entries(currentCategoryData).forEach(([sectionName, sectionData]) => {
      combinations[sectionName] = Object.keys(sectionData.items);
    });
    
    return combinations;
  }, [processedDataForTabs, dialogContext.type, dialogContext.category]);

  // Generate existing entries with dates for duplicate checking
  const currentExistingEntriesWithDates = useMemo(() => {
    return allEntries
      .filter(entry => entry.type === dialogContext.type && entry.category === dialogContext.category)
      .map(entry => ({
        section: entry.section,
        name: entry.name || 'Unnamed Item',
        snapshot_date: entry.snapshot_date
      }))
      .filter(entry => entry.section && entry.name && entry.snapshot_date);
  }, [allEntries, dialogContext.type, dialogContext.category]);

  // Handler for deleting all entries by name and section
  const handleDeleteItem = (
    sectionName: string,
    itemName: string,
    entryType: "personal" | "business",
    entryCategory: "asset" | "liability"
  ) => {
    if (!userId) return;
    
    setConfirmationData({
      title: "Delete Item",
      description: `Are you sure you want to delete all entries for item "${itemName}" in section "${sectionName}"? This action cannot be undone.`,
      onConfirm: async () => {
        const deletedCount = await apiDeleteNetworthEntriesByNameAndSection(userId, itemName, sectionName);
        if (deletedCount !== null && deletedCount > 0) {
          loadNetWorthData();
        } else if (deletedCount === 0) {
          alert("No entries were deleted. They may have already been removed.");
        } else {
          alert("Failed to delete entries. Please try again.");
        }
      }
    });
    setIsConfirmDialogOpen(true);
  };

  // Handler for deleting all entries in a section
  const handleDeleteSection = (
    sectionName: string,
    entryType: "personal" | "business",
    entryCategory: "asset" | "liability"
  ) => {
    if (!userId) return;
    
    setConfirmationData({
      title: "Delete Section",
      description: `Are you sure you want to delete ALL entries in section "${sectionName}"? This will delete all items in this section and cannot be undone.`,
      onConfirm: async () => {
        const deletedCount = await apiDeleteNetworthEntriesBySection(userId, sectionName, entryType, entryCategory);
        if (deletedCount !== null && deletedCount > 0) {
          loadNetWorthData();
        } else if (deletedCount === 0) {
          alert("No entries were deleted. The section may be empty or already removed.");
        } else {
          alert("Failed to delete section entries. Please try again.");
        }
      }
    });
    setIsConfirmDialogOpen(true);
  };

  // Handler for renaming section
  const handleRenameSection = async (
    sectionName: string,
    newSectionName: string,
    entryType: "personal" | "business",
    entryCategory: "asset" | "liability"
  ): Promise<boolean> => {
    if (!userId) return false;
    const updatedCount = await apiRenameSectionEntries(userId, sectionName, newSectionName, entryType, entryCategory);
    if (updatedCount !== null && updatedCount > 0) {
      loadNetWorthData();
      return true;
    } else if (updatedCount === 0) {
      alert("No entries were found to rename in this section.");
      return false;
    } else {
      alert("Failed to rename section. Please try again.");
      return false;
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 shadow-md rounded-lg">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <TabsTrigger 
            value="personal" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
            disabled={!userId}
          >
            Personal
          </TabsTrigger>
          <TabsTrigger 
            value="business" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
            disabled={!userId}
          >
            Business
          </TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="p-1">
          {userId ? renderNetWorthTabContent('personal', processedDataForTabs.personal, allSnapshotDates) : <p className="text-center text-gray-500">User ID not available.</p>}
        </TabsContent>
        <TabsContent value="business" className="p-1">
          {userId ? renderNetWorthTabContent('business', processedDataForTabs.business, allSnapshotDates) : <p className="text-center text-gray-500">User ID not available.</p>}
        </TabsContent>
      </Tabs>

      {userId && (
          <AddNetworthEntryDialog
            open={isAddEntryDialogOpen}
            onOpenChange={setIsAddEntryDialogOpen}
            userId={userId}
            entryType={dialogContext.type}
            entryCategory={dialogContext.category}
            onAddEntry={handleDialogAddEntry}
            loading={loading}
            existingSections={currentDialogSuggestions?.sections || []} 
            existingItemNames={currentDialogSuggestions?.itemNames || []} 
            existingSectionItemCombinations={currentExistingSectionItemCombinations}
            existingEntriesWithDates={currentExistingEntriesWithDates}
          />
      )}

      {userId && editingItemDetails && (
        <EditNetWorthItemDialog
            open={isEditItemDialogOpen}
            onOpenChange={setIsEditItemDialogOpen}
            itemDetails={editingItemDetails}
            onSaveItem={handleSaveItemEdit}
            loading={loading}
            existingItemNamesInSection={currentEditItemDialogSuggestions}
        />
      )}

      {confirmationData && (
        <ConfirmationDialog
          open={isConfirmDialogOpen}
          onOpenChange={(open) => {
            setIsConfirmDialogOpen(open);
            if (!open) {
              setConfirmationData(null);
            }
          }}
          title={confirmationData.title}
          description={confirmationData.description}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmationData.onConfirm}
          variant="destructive"
        />
      )}
    </div>
  );
};

export default NetWorthSection;
