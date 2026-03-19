"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// --- Types ---
import {
  useTravelTransaction,
  // TravelTransactionPayload, // Moved to Form
  TravelTransactionResponse,
  TravelTransactionBulkRenameRequest,
} from "@/app/travel-pl/services/useTravelTransaction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Child Components ---
import { TravelTransactionForm } from "./TravelTransactionForm";
import { TravelTransactionList } from "./TravelTransactionList";
import { TravelSummaryReport } from "./TravelSummaryReport";

// Define props
export interface TravelPLSectionProps {
  userId: string;
}

interface TripCard {
  tripName: string;
  location: string;
  transactionCount: number;
  latestDate: string;
  totalAmount: number;
}

// Removed state structures (moved to Form)
// interface TransactionInputState { ... }
// const initialTransactionState: TransactionInputState = { ... }
// const getTodayDateString = () => { ... };

// Removed Local Storage Helpers (moved to Form)
// const getCachedExchangeRate = (...) => { ... };
// const setCachedExchangeRate = (...) => { ... };

// --- Component ---
export const TravelPLSection: React.FC<TravelPLSectionProps> = (props) => {
  const { userId } = props;
  const inhibitDefaultFiltersRef = useRef(false);
  // Removed transaction state (moved to Form)
  // const [transaction, setTransaction] = useState<TransactionInputState>(initialTransactionState);
  // Removed isSgdMode state (moved to Form)
  // const [isSgdMode, setIsSgdMode] = useState<boolean>(true);
  const [existingTransactions, setExistingTransactions] = useState<
    TravelTransactionResponse[]
  >([]);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(
    null
  );

  // Card-based interface state
  const [selectedCard, setSelectedCard] = useState<{ tripName: string; location: string } | null>(null);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [newTripForm, setNewTripForm] = useState({ tripName: '', city: '', country: '' });
  const [newlyCreatedTrips, setNewlyCreatedTrips] = useState<TripCard[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCard, setEditingCard] = useState<TripCard | null>(null);

  // State to hold data for duplication
  const [duplicateData, setDuplicateData] =
    useState<TravelTransactionResponse | null>(null);

  // Generate trip cards from transactions
  const tripCards = useMemo(() => {
    const cardMap = new Map<string, TripCard>();
    
    // Add existing transactions to cards
    existingTransactions.forEach(tx => {
      if (!tx.trip_name || !tx.city || !tx.country) return;
      
      const key = `${tx.trip_name}-${tx.city}, ${tx.country}`;
      const location = `${tx.city}, ${tx.country}`;
      
      if (cardMap.has(key)) {
        const card = cardMap.get(key)!;
        card.transactionCount += 1;
        // Update latest date if this transaction is newer
        if (new Date(tx.payment_date) > new Date(card.latestDate)) {
          card.latestDate = tx.payment_date;
        }
        // Calculate total amount (income positive, expense negative)
        const amount = typeof tx.amount_sgd === 'number' ? tx.amount_sgd : 0;
        if (tx.category === "income") {
          card.totalAmount += amount;
        } else if (tx.category === "expense") {
          card.totalAmount -= amount;
        }
      } else {
        // Calculate initial total amount (income positive, expense negative)
        const amount = typeof tx.amount_sgd === 'number' ? tx.amount_sgd : 0;
        let initialTotal = 0;
        if (tx.category === "income") {
          initialTotal = amount;
        } else if (tx.category === "expense") {
          initialTotal = -amount;
        }
        
        cardMap.set(key, {
          tripName: tx.trip_name,
          location: location,
          transactionCount: 1,
          latestDate: tx.payment_date,
          totalAmount: initialTotal
        });
      }
    });
    
    // Add newly created trips (that don't have transactions yet) 
    newlyCreatedTrips.forEach(newTrip => {
      const key = `${newTrip.tripName}-${newTrip.location}`;
      if (!cardMap.has(key)) {
        cardMap.set(key, newTrip);
      }
    });
    
    return Array.from(cardMap.values()).sort((a, b) => {
      // Sort by latest date descending
      return new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime();
    });
  }, [existingTransactions, newlyCreatedTrips]);

  // --- Location Filter State & Logic (Lifted) ---
  const { uniqueLocations, defaultLocation } = useMemo(() => {
    // Same calculation as previously in TravelTransactionList
    if (!existingTransactions || existingTransactions.length === 0) {
      return { uniqueLocations: [], defaultLocation: "" };
    }
    const sortedTransactions = [...existingTransactions].sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    const latestTransaction = sortedTransactions[0];
    const defaultLoc = `${latestTransaction.city}, ${latestTransaction.country}`;
    const locations = new Set<string>();
    existingTransactions.forEach((tx) => {
      if (tx.city && tx.country) locations.add(`${tx.city}, ${tx.country}`);
    });
    const sortedLocations = Array.from(locations).sort((a, b) =>
      a.localeCompare(b)
    );
    return {
      uniqueLocations: sortedLocations,
      defaultLocation: defaultLoc,
    };
  }, [existingTransactions]);

  const [filterLocation, setFilterLocation] = useState<string>("--manual--");

  // --- Trip Name Filter State & Logic (New) ---
  const uniqueTripNames = useMemo(() => {
    if (!existingTransactions || existingTransactions.length === 0) {
      return [];
    }
    const tripNames = existingTransactions
      .map(tx => tx.trip_name)
      .filter((name): name is string => typeof name === 'string' && name.trim() !== ''); // Filter out null/undefined/empty and ensure type is string
    return Array.from(new Set(tripNames)).sort((a, b) => a.localeCompare(b));
  }, [existingTransactions]);

  const [currentTripFilter, setCurrentTripFilter] = useState<string>("--manual--");

  // Effect to set initial/default filters once data is loaded or reloaded
  useEffect(() => {
    if (transactionsLoading) return;
    if (inhibitDefaultFiltersRef.current) {
      return;
    }

    // Set Trip Filter
    if (currentTripFilter !== "--manual--") {
      if (uniqueTripNames.length > 0) {
        if (!currentTripFilter || currentTripFilter === "--select-trip--" || !uniqueTripNames.includes(currentTripFilter)) {
          setCurrentTripFilter(uniqueTripNames[0]);
        }
      } else {
        setCurrentTripFilter("--manual--");
      }
    }

    // Set Location Filter
    if (filterLocation !== "--manual--") {
      if (uniqueLocations.length > 0) {
        if (!filterLocation || !uniqueLocations.includes(filterLocation)) {
          if (defaultLocation && uniqueLocations.includes(defaultLocation)) {
            setFilterLocation(defaultLocation);
          } else {
            setFilterLocation(uniqueLocations[0]);
          }
        }
      } else {
        setFilterLocation("--manual--");
      }
    }
  }, [existingTransactions, transactionsLoading, uniqueTripNames, uniqueLocations, defaultLocation, currentTripFilter, filterLocation]);

  // Filter transactions based *only* on location here
  const locationFilteredTransactions = useMemo(() => {
    // If no specific location is selected (or manual entry is chosen), show no results initially.
    if (
      !filterLocation ||
      filterLocation === "" ||
      filterLocation === "--manual--"
    ) {
      return []; // Return empty array
    }
    return existingTransactions.filter((tx) => {
      const location = `${tx.city}, ${tx.country}`;
      return location === filterLocation;
    });
  }, [existingTransactions, filterLocation]);

  // --- Year/Month Filter State (Lifted) ---
  const [selectedYear, setSelectedYear] = useState<string>(""); // Start with no year selected
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // Start with no month selected

  // Get current year/month to pass to form for default filtering on location select
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

  // Filter transactions based on selected card
  const finalFilteredTransactions = useMemo(() => {
    if (!selectedCard) return [];
    
    const [city, country] = selectedCard.location.split(', ');
    return existingTransactions.filter(tx => {
      return tx.trip_name === selectedCard.tripName && 
             tx.city === city &&
             tx.country === country;
    });
  }, [existingTransactions, selectedCard]);

  // --- Initialize Hook ---
  const {
    addTravelTransaction,
    fetchTravelTransactions,
    deleteTravelTransaction,
    loading: apiLoading,
    error: apiError, // Keep apiError for display or handling if needed
    updateTravelTransaction,
    bulkRenameTravelTransactionTrip,
  } = useTravelTransaction();

  // --- Fetch Existing Transactions ---
  const loadTransactions = useCallback(async (): Promise<TravelTransactionResponse[] | null> => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const data = await fetchTravelTransactions(userId); // Add filters later if needed
      if (data) {
        setExistingTransactions(data);
        return data; // Return the fetched data
      } else {
        setTransactionsError("Failed to fetch transactions.");
        return null; // Return null on failure
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactionsError("An error occurred while fetching transactions.");
      return null; // Return null on error
    } finally {
      setTransactionsLoading(false);
    }
  }, [userId, fetchTravelTransactions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]); // Reload when userId changes or loadTransactions is redefined

  // Removed Input Handlers (moved to Form)
  // const handleInputChange = (...) => { ... };
  // const handleCategoryChange = (...) => { ... };
  // const handleModeChange = (...) => { ... };
  // const handleAmountChange = (...) => { ... };

  // Removed Form Submission Logic (moved to Form)
  // const handleSubmit = (...) => { ... };

  // Callback for Form after adding a transaction
  const onTransactionAdded = async () => {
    inhibitDefaultFiltersRef.current = true;
    const freshTransactions = await loadTransactions();

    // Keep newly created trips in the list - they will only be removed by manual deletion

    setTimeout(() => {
      inhibitDefaultFiltersRef.current = false;
    }, 0);
  };

  // --- Delete Handler (Remains in parent) ---
  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?"
    );
    if (!confirmed) return;

    const success = await deleteTravelTransaction(id, userId);
    if (success) {
      console.log("Transaction deleted.");
      loadTransactions(); // Refresh list
    } else {
      console.error("Failed to delete transaction:", apiError?.message);
      // Optionally set an error state specific to deletion if needed
    }
  };

  // --- Duplicate Handler (Triggered from List) ---
  const handleDuplicate = (transaction: TravelTransactionResponse) => {
    console.log("Duplicating transaction data:", transaction);
    setDuplicateData(transaction);
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Callback for Form after handling duplication ---
  const onDuplicateHandledInParent = () => {
    setDuplicateData(null);
  };

  // --- Process Data for Summary Report (Remains in parent) ---
  const summaryData = useMemo(() => {
    // Calculation remains the same
    if (!existingTransactions || existingTransactions.length === 0) {
      return [];
    }
    const summary: {
      [key: string]: { monthYear: string; tripName: string; location: string; totalSgd: number };
    } = {};
    existingTransactions.forEach((tx) => {
      try {
        const date = new Date(tx.payment_date + "T00:00:00");
        if (isNaN(date.getTime())) {
          console.warn(
            `Invalid date format for transaction ID ${tx.id}: ${tx.payment_date}`
          );
          return;
        }
        const monthYear =
          date.toLocaleString("default", { month: "short" }) +
          "-" +
          date.getFullYear();
        const tripName = tx.trip_name || "N/A";
        const location = `${tx.city}, ${tx.country}`;
        const key = `${monthYear}-${tripName}-${location}`;
        if (!summary[key]) {
          summary[key] = { monthYear, tripName, location, totalSgd: 0 };
        }
        // Use tx.amount_sgd directly if it's a number, otherwise treat as 0
        const amount = typeof tx.amount_sgd === 'number' ? tx.amount_sgd : 0;
        // No need for isNaN check as amount is now guaranteed to be a number (or 0 if null)
        if (tx.category === "income") {
          summary[key].totalSgd += amount;
        } else if (tx.category === "expense") {
          summary[key].totalSgd -= amount;
        }
        // Optional: Log if original tx.amount_sgd was null and treated as 0, if needed for debugging
        if (tx.amount_sgd === null && amount === 0) {
          console.warn(
            `SGD amount was null for transaction ID ${tx.id}, treated as 0 in summary.`
          );
        }
      } catch (error) {
        console.error(`Error processing transaction ID ${tx.id}:`, error);
      }
    });
    return Object.values(summary).sort((a, b) => {
      const [aMonth, aYear] = a.monthYear.split("-");
      const [bMonth, bYear] = b.monthYear.split("-");
      const monthMap: { [key: string]: number } = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };
      const dateA = new Date(parseInt(aYear), monthMap[aMonth]);
      const dateB = new Date(parseInt(bYear), monthMap[bMonth]);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      if (a.tripName !== b.tripName) {
        return a.tripName.localeCompare(b.tripName);
      }
      return a.location.localeCompare(b.location);
    });
  }, [existingTransactions]);

  // --- Format date helper ---
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  // --- Shared Styling Classes (Defined in parent) ---
  const thClass =
    "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap dark:text-gray-400";
  const tdClass = "px-3 py-1 align-top dark:text-gray-300";
  const inputBaseClass =
    "block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";
  const buttonClass =
    "p-1 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center";
  const deleteButtonClass =
    "p-1 text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300";

  // Handle card selection
  const handleCardSelect = (card: TripCard) => {
    setSelectedCard({ tripName: card.tripName, location: card.location });
  };

  // Handle card edit
  const handleCardEdit = (card: TripCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setEditingCard(card);
    setNewTripForm({
      tripName: card.tripName,
      city: card.location.split(', ')[0],
      country: card.location.split(', ')[1]
    });
    setIsNewTripModalOpen(true);
  };

  // Handle opening modal for new trip creation
  const handleOpenNewTripModal = () => {
    setIsEditMode(false);
    setEditingCard(null);
    setNewTripForm({ tripName: '', city: '', country: '' });
    setIsNewTripModalOpen(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsNewTripModalOpen(false);
    setIsEditMode(false);
    setEditingCard(null);
    setNewTripForm({ tripName: '', city: '', country: '' });
  };

  // Handle card delete
  const handleCardDelete = async (card: TripCard, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmed = window.confirm(`Are you sure you want to delete all transactions for "${card.tripName}" in ${card.location}?`);
    if (!confirmed) return;

    // Delete all transactions for this trip/location
    const transactionsToDelete = existingTransactions.filter(tx => 
      tx.trip_name === card.tripName && 
      tx.city === card.location.split(', ')[0] &&
      tx.country === card.location.split(', ')[1]
    );

    for (const tx of transactionsToDelete) {
      await deleteTravelTransaction(tx.id, userId);
    }
    
    // Remove from newly created trips if it exists there
    setNewlyCreatedTrips(prev => prev.filter(trip => 
      !(trip.tripName === card.tripName && trip.location === card.location)
    ));
    
    // Clear selection if this card was selected
    if (selectedCard?.tripName === card.tripName && selectedCard?.location === card.location) {
      setSelectedCard(null);
    }
    
    loadTransactions();
  };

  // Handle trip creation or editing
  const handleSaveTrip = async () => {
    if (!newTripForm.tripName.trim() || !newTripForm.city.trim() || !newTripForm.country.trim()) {
      alert('All fields are required');
      return;
    }

    const location = `${newTripForm.city.trim()}, ${newTripForm.country.trim()}`;

    if (isEditMode && editingCard) {
      // Handle edit mode - use bulk rename API
      const oldCity = editingCard.location.split(', ')[0];
      const oldCountry = editingCard.location.split(', ')[1];
      
      // Use bulk rename API to update all transactions for this trip
      const renameRequest: TravelTransactionBulkRenameRequest = {
        user_id: userId,
        old_trip_name: editingCard.tripName,
        old_city: oldCity,
        old_country: oldCountry,
        new_trip_name: newTripForm.tripName.trim(),
        new_city: newTripForm.city.trim(),
        new_country: newTripForm.country.trim(),
      };

      const result = await bulkRenameTravelTransactionTrip(renameRequest);
      
      if (result) {
        console.log(`Successfully updated ${result.updated_count} transactions`);
        
        // Update newly created trips if this card exists there
        setNewlyCreatedTrips(prev => prev.map(trip => 
          trip.tripName === editingCard.tripName && trip.location === editingCard.location
            ? { ...trip, tripName: newTripForm.tripName.trim(), location: location, totalAmount: trip.totalAmount }
            : trip
        ));

        // Update selected card if it matches the edited card
        if (selectedCard?.tripName === editingCard.tripName && selectedCard?.location === editingCard.location) {
          setSelectedCard({ tripName: newTripForm.tripName.trim(), location: location });
        }

        // Reload transactions to reflect changes
        loadTransactions();
      } else {
        console.error("Failed to bulk rename trip transactions");
        // Optionally show error message to user
      }
    } else {
      // Handle create mode
      const newTrip: TripCard = {
        tripName: newTripForm.tripName.trim(),
        location: location,
        transactionCount: 0,
        latestDate: new Date().toISOString().split('T')[0],
        totalAmount: 0
      };

      // Add to newly created trips
      setNewlyCreatedTrips(prev => [...prev, newTrip]);
      
      // Select the new trip
      setSelectedCard({ tripName: newTrip.tripName, location: newTrip.location });
    }
    
    // Reset form and close modal
    handleCloseModal();
  };

  return (
    <Tabs defaultValue="transactions" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <TabsTrigger
          value="transactions"
          className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
        >
          Transactions & Entry
        </TabsTrigger>
        <TabsTrigger
          value="summary"
          className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950 data-[state=active]:shadow-sm data-[state=active]:text-foreground dark:text-gray-300 rounded-md"
        >
          Monthly Summary
        </TabsTrigger>
      </TabsList>

      <TabsContent value="transactions" className="space-y-6">
        {/* Trip Selection Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Select Trip</CardTitle>
            <Button onClick={handleOpenNewTripModal} className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
              <Plus size={16} className="mr-2" />
              Add New Trip
            </Button>
            <Dialog open={isNewTripModalOpen} onOpenChange={handleCloseModal}>
              <DialogContent className="dark:bg-gray-900 dark:border-gray-700">
                <DialogHeader>
                  <DialogTitle className="dark:text-gray-100">
                    {isEditMode ? 'Edit Trip' : 'Create New Trip'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tripName" className="dark:text-gray-300">Trip Name</Label>
                    <Input
                      id="tripName"
                      value={newTripForm.tripName}
                      onChange={(e) => setNewTripForm(prev => ({ ...prev, tripName: e.target.value }))}
                      placeholder="e.g., Summer Vacation"
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city" className="dark:text-gray-300">City</Label>
                    <Input
                      id="city"
                      value={newTripForm.city}
                      onChange={(e) => setNewTripForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="e.g., Tokyo"
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
        <div>
                    <Label htmlFor="country" className="dark:text-gray-300">Country</Label>
                    <Input
                      id="country"
                      value={newTripForm.country}
                      onChange={(e) => setNewTripForm(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="e.g., Japan"
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={handleCloseModal} className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveTrip} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {isEditMode ? 'Save Changes' : 'Create Trip'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, max-content))' }}>
              {tripCards.map((card, index) => (
                <div
                  key={`${card.tripName}-${card.location}`}
                  className={`relative group p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg min-w-[300px] w-fit ${
                    selectedCard?.tripName === card.tripName && selectedCard?.location === card.location
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  } dark:bg-gray-800`}
                  onClick={() => handleCardSelect(card)}
                >
                  {/* Hover buttons */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                    <button
                      onClick={(e) => handleCardEdit(card, e)}
                      className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                      title="Edit Trip"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => handleCardDelete(card, e)}
                      className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                      title="Delete Trip"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate pr-16">{card.tripName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{card.location}</p>
                    <div className="flex justify-between items-center">
                      <div className="px-3 py-1 bg-gray-600 text-white text-sm font-medium rounded-md dark:bg-gray-700">
                        {card.transactionCount} transactions
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(card.latestDate)}</span>
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Total Amount:</span>
                      <span className={`text-lg font-semibold ${card.totalAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        SGD {Math.abs(card.totalAmount).toFixed(2)}
                      </span>
                      <span className={`text-xs ${card.totalAmount >= 0 ? 'text-green-500 dark:text-green-300' : 'text-red-500 dark:text-red-300'}`}>
                        {card.totalAmount >= 0 ? '(net income)' : '(net expense)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>



        {/* Transaction Form - only show if a card is selected */}
        {selectedCard && (
          <TravelTransactionForm
            userId={userId}
            addTravelTransaction={addTravelTransaction}
            apiLoading={apiLoading}
            onTransactionAdded={onTransactionAdded}
            thClass={thClass}
            tdClass={tdClass}
            inputBaseClass={inputBaseClass}
            buttonClass={buttonClass}
            duplicateData={duplicateData}
            onDuplicateHandled={onDuplicateHandledInParent}
            uniqueLocations={uniqueLocations}
            filterLocation={filterLocation}
            setFilterLocation={setFilterLocation}
            setSelectedYear={setSelectedYear}
            setSelectedMonth={setSelectedMonth}
            currentYear={currentYear}
            currentMonth={currentMonth}
            uniqueTripNames={uniqueTripNames}
            currentTripFilter={currentTripFilter}
            setCurrentTripFilter={setCurrentTripFilter}
            selectedCard={selectedCard}
            isNewlyCreatedTrip={newlyCreatedTrips.some(trip => 
              trip.tripName === selectedCard.tripName && trip.location === selectedCard.location
            )}
          />
        )}

        {/* Transaction List - only show if a card is selected */}
        {selectedCard && (
            <TravelTransactionList
              userId={userId}
              filteredTransactions={finalFilteredTransactions}
              originalTransactionCount={existingTransactions.length}
              loading={transactionsLoading}
              error={transactionsError}
              apiLoading={apiLoading}
              handleDelete={handleDelete}
              handleDuplicate={handleDuplicate}
              updateTravelTransaction={updateTravelTransaction}
              loadTransactions={loadTransactions}
              thClass={thClass}
              tdClass={tdClass}
              deleteButtonClass={deleteButtonClass}
            />
          )}

        {/* Message when no card is selected */}
        {!selectedCard && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Select a trip above to view and add transactions</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="summary" className="dark:text-gray-100">
        <TravelSummaryReport
          summaryData={summaryData}
          loading={transactionsLoading}
          error={transactionsError}
          thClass={thClass}
          tdClass={tdClass}
          userId={userId}
          fetchTravelTransactions={fetchTravelTransactions}
          deleteButtonClass={deleteButtonClass}
          apiLoading={apiLoading}
        />
      </TabsContent>
    </Tabs>
  );
};

export default TravelPLSection; // Re-enable default export
