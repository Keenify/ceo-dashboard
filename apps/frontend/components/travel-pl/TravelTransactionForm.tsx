"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, Calculator, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { TravelTransactionPayload, TravelTransactionResponse } from '@/app/travel-pl/services/useTravelTransaction';

// --- State & Types specific to the Form ---
interface TransactionInputState {
  payment_date: string;
  item: string;
  city: string;
  country: string;
  amount_sgd: string;
  local_currency: string;
  amount_local_currency: string;
  exchange_rate_to_sgd: string;
  trip_name: string; 
}

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialTransactionState: TransactionInputState = {
  payment_date: getTodayDateString(),
  item: '',
  city: '',
  country: '',
  amount_sgd: '',
  local_currency: '',
  amount_local_currency: '',
  exchange_rate_to_sgd: '',
  trip_name: '',
};

// --- Local Storage Helpers ---
const getCachedExchangeRate = (currency: string): string | null => {
    if (!currency) return null;
    return localStorage.getItem(`exchange_rate_${currency.toUpperCase()}`);
};
const setCachedExchangeRate = (currency: string, rate: string) => {
    if (!currency || !rate) return;
    localStorage.setItem(`exchange_rate_${currency.toUpperCase()}`, rate);
};

// --- Props Interface ---
interface TravelTransactionFormProps {
    userId: string;
    addTravelTransaction: (payload: TravelTransactionPayload) => Promise<TravelTransactionResponse | null>;
    apiLoading: boolean;
    onTransactionAdded: () => void;
    thClass: string;
    tdClass: string;
    inputBaseClass: string;
    buttonClass: string;
    duplicateData: TravelTransactionResponse | null;
    onDuplicateHandled: () => void;
    uniqueLocations: string[];
    filterLocation: string; 
    setFilterLocation: React.Dispatch<React.SetStateAction<string>>; 
    setSelectedYear: React.Dispatch<React.SetStateAction<string>>;
    setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
    currentYear: string;
    currentMonth: string;
    uniqueTripNames: string[];
    currentTripFilter: string;
    setCurrentTripFilter: (filter: string) => void;
    selectedCard?: { tripName: string; location: string } | null;
    isNewlyCreatedTrip?: boolean;
}

// Helper Function
const capitalizeFirstLetter = (string: string) => {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// --- Calculator Component ---
interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (value: string) => void;
  position: { top: number; left: number };
}

const SimpleCalculator: React.FC<CalculatorProps> = ({ isOpen, onClose, onResult, position }) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [justCalculated, setJustCalculated] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      
      const key = event.key;
      
      // Handle numbers
      if (key >= '0' && key <= '9') {
        inputDigit(key);
      }
      // Handle decimal point
      else if (key === '.') {
        inputDecimal();
      }
      // Handle operators
      else if (key === '+') {
        performOperation('+');
      }
      else if (key === '-') {
        performOperation('-');
      }
      else if (key === '*') {
        performOperation('*');
      }
      else if (key === '/') {
        performOperation('/');
      }
      // Handle equals/enter
      else if (key === 'Enter' || key === '=') {
        if (justCalculated) {
          handleUse();
        } else {
          handleEquals();
        }
      }
      // Handle clear
      else if (key === 'Escape' || key === 'c' || key === 'C') {
        clear();
      }
      // Handle backspace
      else if (key === 'Backspace') {
        if (display.length > 1) {
          const newDisplay = display.slice(0, -1);
          setDisplay(newDisplay);
          updateExpression(newDisplay);
        } else {
          setDisplay('0');
          setExpression('');
        }
        setJustCalculated(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, display, operation, previousValue, waitingForOperand, justCalculated]);

  const updateExpression = (currentValue: string) => {
    if (previousValue && operation) {
      setExpression(`${previousValue} ${operation} ${currentValue}`);
    } else {
      setExpression(currentValue);
    }
  };

  const inputDigit = (digit: string) => {
    setJustCalculated(false);
    
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      updateExpression(digit);
    } else {
      const newDisplay = display === '0' ? digit : display + digit;
      setDisplay(newDisplay);
      updateExpression(newDisplay);
    }
  };

  const inputDecimal = () => {
    setJustCalculated(false);
    
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      updateExpression('0.');
    } else if (display.indexOf('.') === -1) {
      const newDisplay = display + '.';
      setDisplay(newDisplay);
      updateExpression(newDisplay);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
    setExpression('');
    setJustCalculated(false);
  };

  const performOperation = (nextOperation: string) => {
    setJustCalculated(false);
    
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(display);
      setExpression(`${display} ${nextOperation} `);
    } else if (operation) {
      const currentValue = previousValue || '0';
      const result = calculate(parseFloat(currentValue), inputValue, operation);
      
      setDisplay(String(result));
      setPreviousValue(String(result));
      setExpression(`${result} ${nextOperation} `);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const currentValue = previousValue || '0';
      const result = calculate(parseFloat(currentValue), inputValue, operation);
      
      setDisplay(String(result));
      setExpression(`${previousValue} ${operation} ${display} = ${result}`);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
      setJustCalculated(true);
    }
  };

  const handleUse = () => {
    onResult(display);
    onClose();
    setTimeout(() => {
      const amountField = document.querySelector('input[name="unified_amount"]') as HTMLInputElement;
      if (amountField) {
        amountField.focus();
        const currentValue = amountField.value;
        amountField.value = '';
        amountField.value = currentValue;
      }
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 z-10"
      style={{ 
        top: position.top, 
        left: position.left,
        width: '240px'
      }}
      tabIndex={-1}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Calculator</span>
        <button 
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="mb-2">
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-right text-sm font-mono min-h-[40px] flex flex-col justify-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 min-h-[16px]">
            {expression && expression !== display ? expression : ''}
          </div>
          <div className="text-lg">
            {display}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={clear} className="col-span-2 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 p-2 rounded text-sm font-medium">
          Clear
        </button>
        <button type="button" onClick={() => performOperation('/')} className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 p-2 rounded text-sm font-medium">
          ÷
        </button>
        <button type="button" onClick={() => performOperation('*')} className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 p-2 rounded text-sm font-medium">
          ×
        </button>
        
        {[7, 8, 9].map(num => (
          <button type="button" key={num} onClick={() => inputDigit(String(num))} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded text-sm font-medium">
            {num}
          </button>
        ))}
        <button type="button" onClick={() => performOperation('-')} className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 p-2 rounded text-sm font-medium">
          −
        </button>
        
        {[4, 5, 6].map(num => (
          <button type="button" key={num} onClick={() => inputDigit(String(num))} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded text-sm font-medium">
            {num}
          </button>
        ))}
        <button type="button" onClick={() => performOperation('+')} className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 p-2 rounded text-sm font-medium">
          +
        </button>
        
        {[1, 2, 3].map(num => (
          <button type="button" key={num} onClick={() => inputDigit(String(num))} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded text-sm font-medium">
            {num}
          </button>
        ))}
        <button type="button" onClick={handleEquals} className="row-span-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 p-2 rounded text-sm font-medium">
          =
        </button>
        
        <button type="button" onClick={() => inputDigit('0')} className="col-span-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded text-sm font-medium">
          0
        </button>
        <button type="button" onClick={inputDecimal} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded text-sm font-medium">
          .
        </button>
      </div>
      
      <div className="mt-2 flex gap-1">
        <button 
          type="button"
          onClick={handleUse}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm font-medium"
        >
          Use Result
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center h-8 flex items-center justify-center">
        {justCalculated 
          ? "Press Enter again to use result"
          : "Keyboard: 0-9, +, -, *, /, Enter, Esc"
        }
      </div>
    </div>
  );
};

// --- Component ---
export const TravelTransactionForm: React.FC<TravelTransactionFormProps> = ({
    userId,
    addTravelTransaction,
    apiLoading,
    onTransactionAdded,
    thClass,
    tdClass,
    inputBaseClass,
    buttonClass,
    duplicateData,
    onDuplicateHandled,
    uniqueLocations,
    filterLocation, 
    setFilterLocation,
    setSelectedYear,
    setSelectedMonth,
    currentYear,
    currentMonth,
    uniqueTripNames = [],
    currentTripFilter,
    setCurrentTripFilter,
    selectedCard,
    isNewlyCreatedTrip
}) => {
  const [transaction, setTransaction] = useState<TransactionInputState>(initialTransactionState);
  const [isSgdMode, setIsSgdMode] = useState<boolean>(true);
  const [isIncome, setIsIncome] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [calculatorPosition, setCalculatorPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const amountFieldRef = useRef<HTMLInputElement>(null);

  // Update transaction when selectedCard changes
  useEffect(() => {
    if (selectedCard) {
      const [city, country] = selectedCard.location.split(', ').map(s => s.trim());
      setTransaction(prev => ({
        ...prev,
        trip_name: selectedCard.tripName,
        city: city || '',
        country: country || ''
      }));
    }
  }, [selectedCard]);

  useEffect(() => {
    if (duplicateData) {
      const isSgdDup = !duplicateData.local_currency;
      const incomeDup = duplicateData.category === 'income';
      setIsSgdMode(isSgdDup);
      setIsIncome(incomeDup);

      setTransaction(prev => ({
          ...prev,
          payment_date: getTodayDateString(),
          item: duplicateData.item,
          city: duplicateData.city || '',
          country: duplicateData.country || '',
          amount_sgd: isSgdDup && duplicateData.amount_sgd !== null ? String(duplicateData.amount_sgd) : '',
          local_currency: duplicateData.local_currency || '',
          amount_local_currency: !isSgdDup && duplicateData.amount_local_currency !== null ? String(duplicateData.amount_local_currency) : '',
          exchange_rate_to_sgd: duplicateData.exchange_rate_to_sgd !== null ? String(duplicateData.exchange_rate_to_sgd) : '',
          trip_name: duplicateData.trip_name || '',
      }));
      
      try {
        const dupDate = new Date(duplicateData.payment_date + 'T00:00:00');
        if (!isNaN(dupDate.getTime())) {
            setSelectedYear(String(dupDate.getFullYear()));
            setSelectedMonth(String(dupDate.getMonth() + 1).padStart(2, '0'));
        }
      } catch (e) { console.error("Error parsing duplicated date for year/month filter", e); }

      onDuplicateHandled();
    }
  }, [duplicateData, onDuplicateHandled, setSelectedYear, setSelectedMonth]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let eventValue = value;

    if (name === 'city' || name === 'country') {
      eventValue = capitalizeFirstLetter(value.trim());
    }
    
    if (name === 'payment_date' && eventValue) {
        try {
            const date = new Date(eventValue + 'T00:00:00');
             if (!isNaN(date.getTime())) {
                 setSelectedYear(String(date.getFullYear()));
                 setSelectedMonth(String(date.getMonth() + 1).padStart(2, '0'));
             }
        } catch (e) { console.error("Error parsing payment date for year/month filter", e); }
    }
    setTransaction(prev => ({ ...prev, [name]: eventValue }));
  };

  const handleModeChange = (value: string) => {
    setIsSgdMode(value === 'sgd');
    if (value === 'sgd') {
        setTransaction(prev => ({ ...prev, local_currency: '', amount_local_currency: '', exchange_rate_to_sgd: '' }));
    } else {
        setTransaction(prev => ({ ...prev, amount_sgd: '' }));
        if (transaction.local_currency) {
            const cachedRate = getCachedExchangeRate(transaction.local_currency);
            if (cachedRate) {
                setTransaction(prev => ({ ...prev, exchange_rate_to_sgd: cachedRate }));
            }
        }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedValue = name === 'local_currency' ? value.toUpperCase() : value;
    setTransaction(prev => ({ ...prev, [name]: updatedValue }));

    if (name === 'exchange_rate_to_sgd' && transaction.local_currency && value) {
        setCachedExchangeRate(transaction.local_currency, value);
    } else if (name === 'local_currency' && value && transaction.exchange_rate_to_sgd) {
        setCachedExchangeRate(value.toUpperCase(), transaction.exchange_rate_to_sgd);
    }
  };
  
  const handleUnifiedAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    
    if (value.includes('.')) {
      const decimalPart = value.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        toast.warning("Amount should not exceed 2 decimal places", {
          description: "Please enter amount with maximum 2 decimal places (e.g., 123.45)",
          duration: 3000,
        });
        return;
      }
    }
    
    if (isSgdMode) {
        setTransaction(prev => ({ ...prev, amount_sgd: value, amount_local_currency: '' }));
    } else {
        setTransaction(prev => ({ ...prev, amount_local_currency: value, amount_sgd: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalCity = transaction.city;
    let finalCountry = transaction.country;
    let finalTripName = transaction.trip_name;

    // Use selectedCard data if available
    if (selectedCard) {
      const [city, country] = selectedCard.location.split(', ').map(s => s.trim());
      finalCity = city;
      finalCountry = country;
      finalTripName = selectedCard.tripName;
    }
    
    if (isSgdMode && !transaction.amount_sgd) {
        alert("Amount (SGD) is required."); return;
    }
    if (!isSgdMode && (!transaction.local_currency || !transaction.amount_local_currency || !transaction.exchange_rate_to_sgd)) {
        alert("Local Currency, Amount, and Rate are required."); return;
    }
    if (!transaction.item || !transaction.payment_date) {
        alert("Payment Date and Item are required."); return;
    }
    if (!finalCity || !finalCountry) {
        alert("Location (City and Country) is required."); return;
    }
    if (!finalTripName) {
      alert("Trip Name is required.");
      return;
    }

    const payload: TravelTransactionPayload = {
        payment_date: transaction.payment_date,
        item: transaction.item,
        city: finalCity,
        country: finalCountry,
        category: isIncome ? 'income' : 'expense',
        user_id: userId,
        trip_name: finalTripName,
        description: null, 
        booking_date: null, 
    };

    if (isSgdMode) {
        payload.amount_sgd = parseFloat(transaction.amount_sgd);
    } else {
        payload.local_currency = transaction.local_currency.toUpperCase();
        payload.amount_local_currency = parseFloat(transaction.amount_local_currency);
        payload.exchange_rate_to_sgd = parseFloat(transaction.exchange_rate_to_sgd);
    }

    const result = await addTravelTransaction(payload);
    if (result) {
      setTransaction(prev => ({
          ...initialTransactionState,
          payment_date: prev.payment_date,
          local_currency: !isSgdMode ? prev.local_currency : '',
          exchange_rate_to_sgd: !isSgdMode ? prev.exchange_rate_to_sgd : '',
          trip_name: selectedCard ? selectedCard.tripName : '',
          city: selectedCard ? selectedCard.location.split(', ')[0] : '',
          country: selectedCard ? selectedCard.location.split(', ')[1] : '',
      }));
      
      setIsIncome(false);
      
      setTimeout(() => {
        const itemField = document.querySelector('input[name="item"]') as HTMLInputElement;
        if (itemField) {
          itemField.focus();
        }
      }, 100);
      
      onTransactionAdded();
    } else {
      alert("Failed to add transaction. Check console for errors.");
    }
  };

  const handleCalculatorToggle = () => {
    if (!showCalculator && amountFieldRef.current) {
      const rect = amountFieldRef.current.getBoundingClientRect();
      const formRect = amountFieldRef.current.closest('form')?.getBoundingClientRect();
      if (formRect) {
        setCalculatorPosition({
          top: rect.bottom - formRect.top + 5,
          left: rect.left - formRect.left
        });
      }
    }
    setShowCalculator(!showCalculator);
  };

  const handleCalculatorResult = (value: string) => {
    if (value.includes('.')) {
      const decimalPart = value.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        const roundedValue = parseFloat(value).toFixed(2);
        toast.info("Calculator result rounded to 2 decimal places", {
          description: `Original: ${value}, Rounded: ${roundedValue}`,
          duration: 3000,
        });
        value = roundedValue;
      }
    }
    
    if (isSgdMode) {
      setTransaction(prev => ({ ...prev, amount_sgd: value, amount_local_currency: '' }));
    } else {
      setTransaction(prev => ({ ...prev, amount_local_currency: value, amount_sgd: '' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Currency Mode Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={isSgdMode ? 'sgd' : 'local'} onValueChange={handleModeChange} className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sgd" id="mode-sgd" />
              <Label htmlFor="mode-sgd" className="text-sm font-medium cursor-pointer dark:text-gray-300">SGD</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="mode-local" />
              <Label htmlFor="mode-local" className="text-sm font-medium cursor-pointer dark:text-gray-300">Local Currency</Label>
            </div>
          </RadioGroup>
          
          {!isSgdMode && (
            <div className="flex gap-x-4 flex-wrap items-baseline pt-4">
              <div>
                <Label htmlFor="local_currency" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Currency Code</Label>
                <input
                  id="local_currency" type="text" name="local_currency"
                  value={transaction.local_currency} onChange={handleAmountChange}
                  placeholder="e.g., USD" maxLength={3}
                  className={`${inputBaseClass} w-24 h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`}
                  required={!isSgdMode}
                />
              </div>
              <div>
                <Label htmlFor="exchange_rate_to_sgd" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Exchange Rate (to SGD)</Label>
                <input
                  id="exchange_rate_to_sgd" type="number" name="exchange_rate_to_sgd"
                  value={transaction.exchange_rate_to_sgd} onChange={handleAmountChange}
                  onKeyDown={(e) => {
                    if (e.key === '+' || e.key === '-') {
                      e.preventDefault();
                      toast.info("Invalid character", {
                        description: "Please enter only numbers and decimal points for the exchange rate",
                        duration: 2000,
                      });
                    } else if (e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  step="0.000001" placeholder={`1 ${transaction.local_currency.toUpperCase() || '-'} = ? SGD`}
                  className={`${inputBaseClass} h-9 w-48 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`}
                  required={!isSgdMode}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <form onSubmit={handleSubmit}>
              <div className="shadow border border-gray-200 sm:rounded-lg mb-4 dark:border-gray-700">
                <Table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <TableHeader className="bg-gray-50 dark:bg-gray-800">
                    <TableRow>
                      <TableHead className={thClass}>Payment Date</TableHead>
                      <TableHead className={thClass}>Item</TableHead>
                      <TableHead className={thClass}>Amount</TableHead>
                      <TableHead className={thClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white divide-y divide-gray-200 dark:bg-gray-950 dark:divide-gray-700">
                    <TableRow>
                      <TableCell className={tdClass}>
                        <input
                          title="Payment Date" type="date" name="payment_date"
                          value={transaction.payment_date} onChange={handleInputChange}
                          required className={`${inputBaseClass} h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`}
                        />
                      </TableCell>
                      <TableCell className={tdClass}>
                        <input
                          type="text" name="item" value={transaction.item}
                          onChange={handleInputChange} required
                          className={`${inputBaseClass} h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`}
                          placeholder="Dinner, Hotel"
                        />
                      </TableCell>
                      <TableCell className={tdClass}>
                        <div className="relative">
                          {(isSgdMode || transaction.local_currency) && (
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm pointer-events-none dark:text-gray-400">
                              {isSgdMode ? 'SGD' : transaction.local_currency?.toUpperCase()}
                            </span>
                          )}
                          <input
                            ref={amountFieldRef}
                            type="number" name="unified_amount"
                            value={isSgdMode ? transaction.amount_sgd : transaction.amount_local_currency}
                            onChange={handleUnifiedAmountInputChange}
                            onKeyDown={(e) => {
                              if (e.key === '+' || e.key === '-') {
                                e.preventDefault();
                                toast.info("Use the Expense/Income button", {
                                  description: "Toggle between expense (-) and income (+) using the button below the amount field",
                                  duration: 3000,
                                });
                              } else if (e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            step="0.01" placeholder="0.00"
                            className={`${inputBaseClass} h-9 w-full ${(isSgdMode || transaction.local_currency) ? 'pl-14' : 'pl-3'} pr-12 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`}
                            aria-label="Amount" required
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                            <button
                              type="button" 
                              onClick={handleCalculatorToggle}
                              className="p-1 bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 rounded"
                              title="Open Calculator"
                            >
                              <Calculator size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <button
                            type="button" onClick={() => setIsIncome(prev => !prev)}
                            className={`px-2 py-1 text-xs flex items-center rounded ${isIncome ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                            title={isIncome ? "Mark as Expense" : "Mark as Income"}
                          >
                            <span className={`font-semibold mr-1 ${isIncome ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
                              {isIncome ? '+' : '-'}
                            </span>
                            {isIncome ? 'Income' : 'Expense'}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className={tdClass}>
                        <button type="submit" className={buttonClass} title="Add Transaction" disabled={apiLoading}>
                          {apiLoading ? <Plus size={18} className="animate-spin" /> : <Plus size={18} />}
                        </button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {showCalculator && (
                <SimpleCalculator
                  isOpen={showCalculator}
                  onClose={() => setShowCalculator(false)}
                  onResult={handleCalculatorResult}
                  position={calculatorPosition}
                />
              )}
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
