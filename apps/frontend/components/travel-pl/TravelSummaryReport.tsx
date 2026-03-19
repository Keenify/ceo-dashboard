"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'; // Icons
import { TravelTransactionList } from './TravelTransactionList'; // Import list component
import { TravelTransactionResponse } from '@/app/travel-pl/services/useTravelTransaction'; // Import type

interface SummaryDataItem {
    monthYear: string;
    tripName: string;
    location: string;
    totalSgd: number;
}

// Function to parse monthYear (e.g., "Apr-2025") into year and month number
const parseMonthYear = (monthYear: string): { year: number; month: number } | null => {
    try {
        const [monthStr, yearStr] = monthYear.split('-');
        const monthMap: { [key: string]: number } = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
        const month = monthMap[monthStr];
        const year = parseInt(yearStr);
        if (month && !isNaN(year)) {
            return { year, month };
        }
    } catch (e) { console.error("Error parsing monthYear:", monthYear, e); }
    return null;
};

// Function to get start and end date strings for a given year/month
const getMonthStartEndDates = (year: number, month: number): { startDate: string; endDate: string } => {
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed
    const endDate = new Date(year, month, 0); // Day 0 of next month gives last day of current month

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
};

interface TravelSummaryReportProps {
    summaryData: SummaryDataItem[];
    loading: boolean;
    error: string | null;
    thClass: string;
    tdClass: string;
    userId: string; // Needed for API calls
    // Pass the fetch function from the hook
    fetchTravelTransactions: (
        userId: string, skip?: number, limit?: number, startDate?: string, endDate?: string, city?: string, country?: string
    ) => Promise<TravelTransactionResponse[] | null>;
    // Pass styling props for nested list
    deleteButtonClass: string;
    apiLoading: boolean; // Pass overall api loading state for nested list actions?
}

export const TravelSummaryReport: React.FC<TravelSummaryReportProps> = ({
    summaryData,
    loading,
    error,
    thClass,
    tdClass,
    userId,
    fetchTravelTransactions,
    deleteButtonClass,
    apiLoading
}) => {
    const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
    const [detailedTransactions, setDetailedTransactions] = useState<TravelTransactionResponse[]>([]);
    const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    // Function to fetch details when a row is expanded
    const fetchDetails = useCallback(async (monthYear: string, tripName: string, location: string) => {
        setDetailsLoading(true);
        console.log(`Fetching details for: ${monthYear}, Trip: ${tripName}, Location: ${location}`);
        setDetailsError(null);
        setDetailedTransactions([]);

        const parsedDate = parseMonthYear(monthYear);
        const [city, country] = location.split(', ').map(s => s.trim());

        if (!parsedDate || !city || !country) {
            setDetailsError("Invalid date or location format.");
            setDetailsLoading(false);
            return;
        }

        const { startDate, endDate } = getMonthStartEndDates(parsedDate.year, parsedDate.month);
        console.log(`Derived API parameters: startDate=${startDate}, endDate=${endDate}, city=${city}, country=${country}`);

        try {
            const data = await fetchTravelTransactions(userId, 0, 500, startDate, endDate, city, country);
            console.log("Received data from fetch:", data);
            if (data) {
                setDetailedTransactions(data);
            } else {
                setDetailsError("Failed to fetch details.");
            }
        } catch (err) {
            console.error("Error fetching details:", err);
            setDetailsError("An error occurred while fetching details.");
        } finally {
            setDetailsLoading(false);
        }
    }, [userId, fetchTravelTransactions]);

    // Handler to toggle expansion and trigger fetch
    const handleExpandClick = (key: string, monthYear: string, tripName: string, location: string) => {
        const newExpandedKey = expandedRowKey === key ? null : key;
        setExpandedRowKey(newExpandedKey);

        // Fetch data only if expanding a new row
        if (newExpandedKey) {
            fetchDetails(monthYear, tripName, location);
        } else {
             // Clear details if collapsing
             setDetailedTransactions([]);
             setDetailsLoading(false);
             setDetailsError(null);
        }
    };

    return (
       <div className="mt-8">
             <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Monthly Summary by Location</h3>
             {/* Show loading/error states consistent with the main table */}
             {loading && <p className="dark:text-gray-300">Loading summary...</p>}
             {error && <p className="text-red-600 dark:text-red-400">Error loading summary data.</p>}
             {!loading && !error && (
                 <div className="shadow border border-gray-200 sm:rounded-lg dark:border-gray-700">
                     <Table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                         <TableHeader className="bg-gray-50 dark:bg-gray-800">
                             <TableRow>
                                 <TableHead className={thClass} style={{ width: '40px' }}></TableHead> {/* Empty header for expand icon */}
                                 <TableHead className={thClass}>Month</TableHead>
                                 <TableHead className={thClass}>Trip Name</TableHead>
                                 <TableHead className={thClass}>Location</TableHead>
                                 <TableHead className={`${thClass} text-right`}>Total Expenditure (SGD)</TableHead>
                             </TableRow>
                         </TableHeader>
                         <TableBody className="bg-white divide-y divide-gray-200 dark:bg-gray-950 dark:divide-gray-700">
                             {summaryData.length === 0 && (
                                 <TableRow>
                                     <TableCell colSpan={5} className="text-center py-4 text-gray-500 dark:text-gray-400">No summary data available.</TableCell>
                                 </TableRow>
                             )}
                             {summaryData.map((item) => {
                                const key = `${item.monthYear}-${item.tripName}-${item.location}`;
                                const isExpanded = expandedRowKey === key;
                                return (
                                    <React.Fragment key={key}>
                                        <TableRow>
                                            <TableCell className={`${tdClass} px-1`}>
                                                 <button
                                                    onClick={() => handleExpandClick(key, item.monthYear, item.tripName, item.location)}
                                                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                    title={isExpanded ? "Collapse" : "Expand"}
                                                 >
                                                     {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                 </button>
                                            </TableCell>
                                            <TableCell className={tdClass}>{item.monthYear}</TableCell>
                                            <TableCell className={tdClass}>{item.tripName}</TableCell>
                                            <TableCell className={tdClass}>{item.location}</TableCell>
                                            <TableCell className={`${tdClass} text-right font-medium`}>
                                                SGD {item.totalSgd > 0
                                                    ? `+${item.totalSgd.toFixed(2)}`
                                                    : `${Math.abs(item.totalSgd).toFixed(2)}`}
                                            </TableCell>
                                        </TableRow>
                                         {/* Detail Row (Conditionally Rendered) */}
                                        {isExpanded && (
                                            <TableRow className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                                                <TableCell colSpan={5} className="p-0"> {/* Span all columns, remove padding */}
                                                    <div className="p-4 border-l-4 border-indigo-400 dark:border-indigo-600">
                                                        {detailsLoading && <div className="flex items-center justify-center p-4"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading details...</div>}
                                                        {detailsError && <p className="text-red-600 p-4 dark:text-red-400">Error loading details: {detailsError}</p>}
                                                        {!detailsLoading && !detailsError && (
                                                            <TravelTransactionList
                                                                // Pass only necessary props for this view
                                                                filteredTransactions={detailedTransactions}
                                                                originalTransactionCount={detailedTransactions.length} // Base message on detail count
                                                                loading={false} // Main loading doesn't apply here
                                                                error={null} // Main error doesn't apply here
                                                                apiLoading={apiLoading} // Pass parent's API loading for delete?
                                                                handleDelete={async () => { console.warn("Delete disabled in summary drilldown"); }} // Disable delete in drilldown
                                                                updateTravelTransaction={async () => { console.warn("Update disabled in summary drilldown"); return null; }} // Disable update
                                                                loadTransactions={() => { console.warn("Load disabled in summary drilldown"); }} // Disable load
                                                                userId={userId} // Pass userId
                                                                handleDuplicate={() => { console.warn("Duplicate disabled in summary drilldown"); }} // Disable duplicate
                                                                thClass={thClass} // Reuse styles
                                                                tdClass={tdClass}
                                                                deleteButtonClass={deleteButtonClass}
                                                                showActions={false} // Hide action buttons
                                                                showControls={false} // Hide settings/filters
                                                                showFooter={false} // Hide total footer
                                                                showTripNameColumn={false} // Do not show Trip Name in sub-table
                                                                showLocationColumn={false} // Do not show Location in sub-table
                                                            />
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                             })}
                         </TableBody>
                     </Table>
                 </div>
             )}
       </div>
    );
}; 