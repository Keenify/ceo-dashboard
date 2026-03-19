"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { HistoryList } from "../../components/five-percent-reviews/HistoryList";
import {
  EditableReviewTable,
  TableReviewData,
  ReviewSectionData,
} from "../../components/five-percent-reviews/EditableReviewTable";
import { supabase } from "@/lib/supabase";
import { useFivePercentReviews, FivePercentReviewResponse } from "./services/useFivePercentReviews";
import { toast, Toaster } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PrinterIcon } from "lucide-react";

const initialReviewData: TableReviewData = {
  Work: { feelings: "", headline: "", significance: "" },
  Family: { feelings: "", headline: "", significance: "" },
  Personal: { feelings: "", headline: "", significance: "" },
  "Next 30-60 days": "", // Simplified to single string
  challenge_or_opportunity: "",
};

export default function FivePercentReviewsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [completedDates, setCompletedDates] = useState<Date[]>([]);
  const [currentReview, setCurrentReview] = useState<FivePercentReviewResponse | null>(null);
  const [editableData, setEditableData] = useState<TableReviewData>(JSON.parse(JSON.stringify(initialReviewData)));
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const {
    createFivePercentReview,
    updateFivePercentReview,
    fetchUserReviews,
    loading: apiLoading,
    error: apiError,
  } = useFivePercentReviews();

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Fetch user and initialize
  useEffect(() => {
    const initialize = async () => {
      setLoadingData(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          router.push("/login");
          return;
        }
        setUser(authData.user);
        
        const reviews = await fetchUserReviews(authData.user.id);
        if (reviews) {
          setCompletedDates(reviews.map(review => new Date(review.review_date)));
        }
        // Trigger initial load for selectedDate
        await loadReviewForDate(selectedDate, authData.user.id, reviews || []);

      } catch (err) {
        setPageError("Failed to load user data or initial reviews.");
        console.error("Initialization error:", err);
      } finally {
        setLoadingData(false);
      }
    };
    initialize();
  }, [router]); // Removed fetchUserReviews and selectedDate from deps to avoid re-triggering from here

  const mapApiResponseToTableData = (review: FivePercentReviewResponse): TableReviewData => ({
    Work: {
      feelings: review.work_feelings || "",
      headline: review.work_headline || "",
      significance: review.work_significance || "",
    },
    Family: {
      feelings: review.family_feelings || "",
      headline: review.family_headline || "",
      significance: review.family_significance || "",
    },
    Personal: {
      feelings: review.personal_feelings || "",
      headline: review.personal_headline || "",
      significance: review.personal_significance || "",
    },
    "Next 30-60 days": review.next_30_60 || "", // Simplified mapping
    challenge_or_opportunity: review.challenge_or_opportunity || "",
  });

  const loadReviewForDate = useCallback(async (date: Date, userId: string, allReviews?: FivePercentReviewResponse[]) => {
    setLoadingData(true);
    setPageError(null);
    setCurrentReview(null); // Reset current review before loading new one
    setEditableData(JSON.parse(JSON.stringify(initialReviewData))); // Reset form

    try {
      const reviewsToSearch = allReviews || await fetchUserReviews(userId);
      if (!reviewsToSearch) {
        setPageError("Could not fetch reviews.");
        setEditableData(JSON.parse(JSON.stringify(initialReviewData)));
        setCurrentReview(null);
        setLoadingData(false);
        return;
      }
      
      if (!completedDates.length && reviewsToSearch.length) { // Populate completed dates if not already done by init
        setCompletedDates(reviewsToSearch.map(r => new Date(r.review_date)));
      }

      const reviewForDate = reviewsToSearch.find(
        (r) => format(new Date(r.review_date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
      );

      if (reviewForDate) {
        setCurrentReview(reviewForDate);
        setEditableData(mapApiResponseToTableData(reviewForDate));
      } else {
        setCurrentReview(null);
        setEditableData(JSON.parse(JSON.stringify(initialReviewData)));
      }
    } catch (err) {
      console.error("Error loading review for date:", err);
      setPageError("Failed to load review for the selected date.");
      setEditableData(JSON.parse(JSON.stringify(initialReviewData)));
      setCurrentReview(null);
    } finally {
      setLoadingData(false);
    }
  }, [fetchUserReviews, completedDates]); // Added completedDates

  // Handle date selection from HistoryList or DatePicker in table
  const handleDateChange = useCallback(async (date: Date) => {
    setSelectedDate(date);
    if (user?.id) {
      await loadReviewForDate(date, user.id);
    }
  }, [user, loadReviewForDate]);

  const handleReviewDataChange = (
    section: keyof TableReviewData,
    field: keyof ReviewSectionData | 'next_30_60',
    value: string
  ) => {
    if (section === "Next 30-60 days") {
      // Handle simplified structure
      setEditableData((prev) => ({
        ...prev,
        [section]: value,
      }));
    } else {
      // Handle standard structure
      setEditableData((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as ReviewSectionData),
          [field]: value,
        },
      }));
    }
  };

  const handleChallengeOpportunityChange = (value: string) => {
    setEditableData((prev) => ({
      ...prev,
      challenge_or_opportunity: value,
    }));
  };

  const handleSubmit = async () => {
    if (!user) {
      setPageError("User not found. Please log in again.");
      return;
    }
    setPageError(null); // Clear previous save errors

    const payload = {
      user_id: user.id,
      review_date: format(selectedDate, "yyyy-MM-dd"),
      personal_feelings: editableData.Personal.feelings,
      personal_headline: editableData.Personal.headline,
      personal_significance: editableData.Personal.significance,
      family_feelings: editableData.Family.feelings,
      family_headline: editableData.Family.headline,
      family_significance: editableData.Family.significance,
      work_feelings: editableData.Work.feelings,
      work_headline: editableData.Work.headline,
      work_significance: editableData.Work.significance,
      next_30_60: editableData["Next 30-60 days"], // Simplified to single field
      challenge_or_opportunity: editableData.challenge_or_opportunity,
    };

    try {
      let result;
      if (currentReview && currentReview.id) {
        result = await updateFivePercentReview(currentReview.id, user.id, payload);
      } else {
        result = await createFivePercentReview(payload);
        if (result) {
          // Add to completed dates if it's a new review and successfully created
          const newDate = new Date(result.review_date);
          if (!completedDates.find(d => format(d, 'yyyy-MM-dd') === format(newDate, 'yyyy-MM-dd'))) {
             setCompletedDates(prev => [...prev, newDate].sort((a,b) => b.getTime() - a.getTime()));
          }
          setCurrentReview(result); // Set the newly created review as current
        }
      }

      if (!result) throw new Error("Failed to save review. Please try again.");
      
      toast.success("Five Percent Review saved successfully!");
      // Optionally, re-fetch or update local state more precisely if needed
      await loadReviewForDate(selectedDate, user.id); // Refresh data for current view

    } catch (err: any) {
      const errorMessage = err.message || "An error occurred while saving the review";
      setPageError(errorMessage);
      toast.error(errorMessage);
      console.error("Submit error:", err);
    }
  };

  if (!user && loadingData) { // Initial loading state for user check
      return <div className="min-h-screen flex items-center justify-center">Loading CEO Dashboard...</div>;
  }
  
  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the review table */
          body * {
            visibility: hidden;
          }
          
          /* Show only the review table and its children */
          #printable-review-table,
          #printable-review-table * {
            visibility: visible;
          }
          
          /* Perfect centering for all content */
          #printable-review-table {
            position: absolute;
            left: 0;
            top: 0;
            width: 100vw;
            min-height: 100vh;
            height: auto;
            margin: 0;
            padding: 15px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
          }
          
          /* Hide save button and error messages in print */
          .no-print {
            display: none !important;
          }
          
          /* Remove container borders in print */
          #printable-review-table .bg-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding: 0 !important;
          }
          
          /* Remove any extra borders from table containers */
          #printable-review-table .overflow-x-auto {
            border: none !important;
          }
          
          /* Container for all content */
          #printable-review-table > div:not(.print-only-header) {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
          }
          
          /* Title header - centered in page */
          #printable-review-table .print-only-header {
            display: block !important;
            width: 100%;
            text-align: center;
            margin-bottom: 15px;
          }
          
          #printable-review-table .print-only-header h1 {
            font-size: 20px !important;
            font-weight: bold !important;
            text-align: center !important;
            margin: 0 0 20px 0 !important;
            padding-bottom: 12px !important;
            border-bottom: 3px solid #333 !important;
            color: #333 !important;
            width: 100% !important;
          }
          
          /* Table container styling */
          #printable-review-table .overflow-x-auto {
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: auto !important;
            display: block;
          }
          
          /* Main table styling - Remove outer table border */
          #printable-review-table table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: auto !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            font-family: 'Arial', sans-serif !important;
            line-height: 1.3 !important;
            border: none !important;
          }
          
          /* Portrait orientation - Default */
          @media print and (orientation: portrait) {
            #printable-review-table {
              padding: 15px;
            }
            
            #printable-review-table table {
              font-size: 11px !important;
            }
            
            /* Column widths for portrait */
            #printable-review-table col:nth-child(1) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; } /* Date */
            #printable-review-table col:nth-child(2) { width: auto !important; min-width: 100px !important; max-width: 120px !important; } /* Feelings */
            #printable-review-table col:nth-child(3) { width: auto !important; min-width: 140px !important; max-width: 160px !important; } /* Headline */
            #printable-review-table col:nth-child(4) { width: auto !important; min-width: 200px !important; max-width: 240px !important; } /* Significance */
            
            #printable-review-table td {
              min-height: 70px !important;
              height: auto !important;
              padding: 8px 6px !important;
            }
            
            #printable-review-table td:first-child {
              padding: 8px 4px !important;
              min-height: 70px !important;
              height: auto !important;
            }
            
            #printable-review-table tbody tr {
              min-height: 70px !important;
              height: auto !important;
            }
            
            #printable-review-table .print-only-header h1 {
              font-size: 20px !important;
            }
          }
          
          /* Landscape orientation */
          @media print and (orientation: landscape) {
            #printable-review-table {
              padding: 10px;
            }
            
            #printable-review-table table {
              font-size: 12px !important;
            }
            
            /* Column widths for landscape - more space available */
            #printable-review-table col:nth-child(1) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; } /* Date */
            #printable-review-table col:nth-child(2) { width: auto !important; min-width: 130px !important; max-width: 150px !important; } /* Feelings */
            #printable-review-table col:nth-child(3) { width: auto !important; min-width: 170px !important; max-width: 190px !important; } /* Headline */
            #printable-review-table col:nth-child(4) { width: auto !important; min-width: 260px !important; max-width: 300px !important; } /* Significance */
            
            /* Ensure all cells have proper borders */
            #printable-review-table td {
              min-height: 80px !important;
              height: auto !important;
              padding: 10px 8px !important;
            }
            
            #printable-review-table td:first-child {
              padding: 10px 6px !important;
              min-height: 80px !important;
              height: auto !important;
            }
            
            /* Ensure all rows have proper spacing */
            #printable-review-table tbody tr {
              min-height: 80px !important;
              height: auto !important;
            }
            
            #printable-review-table .print-only-header h1 {
              font-size: 22px !important;
              margin-bottom: 25px !important;
            }
            
            #printable-review-table .mt-6 {
              margin-top: 15px !important;
            }
          }
          
          /* Column group */
          #printable-review-table colgroup {
            display: table-column-group;
          }
          
          /* Header styling */
          #printable-review-table th {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
            color: #333 !important;
            font-weight: bold !important;
            font-size: 12px !important;
            padding: 10px 8px !important;
            text-align: center !important;
            border: 1px solid #333 !important;
            vertical-align: middle !important;
            height: auto !important;
          }
          
          /* Header text styling */
          #printable-review-table th > div {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 4px !important;
          }
          
          #printable-review-table th span:first-child {
            font-size: 12px !important;
            font-weight: bold !important;
            color: #222 !important;
            line-height: 1.2 !important;
          }
          
          #printable-review-table th span:last-child {
            font-size: 9px !important;
            color: #555 !important;
            font-style: italic !important;
            line-height: 1.2 !important;
            text-align: center !important;
          }
          
          /* Cell styling - ensure all cells have borders */
          #printable-review-table td {
            border: 1px solid #333 !important;
            vertical-align: top !important;
            word-wrap: break-word !important;
            word-break: break-word !important;
            hyphens: auto !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
          }
          
          /* First column (section names) styling */
          #printable-review-table td:first-child {
            background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%) !important;
            font-weight: bold !important;
            font-size: 10px !important;
            text-align: center !important;
            color: #333 !important;
            border: 1px solid #333 !important;
            border-right: 2px solid #333 !important;
            vertical-align: middle !important;
            display: table-cell !important;
            padding: 0px !important;
          }
          
          /* Date cell - special styling to fit content properly */
          #printable-review-table th:first-child {
            background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%) !important;
            border: 1px solid #333 !important;
            border-right: 2px solid #333 !important;
            padding: 8px 4px !important;
          }
          
          /* Date picker button styling */
          #printable-review-table th:first-child button {
            font-size: 10px !important;
            padding: 4px 6px !important;
            width: 100% !important;
            height: auto !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            line-height: 1.2 !important;
          }
          
          #printable-review-table th:first-child button span {
            font-size: 10px !important;
            line-height: 1.2 !important;
          }
          
          /* Content cells */
          #printable-review-table td:not(:first-child) {
            background: white !important;
            color: #333 !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
            text-align: center !important;
            vertical-align: middle !important;
            display: table-cell !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
          }
          
          /* Next 30-60 days row (spans multiple columns) */
          #printable-review-table tbody tr:last-child td[colspan] {
            background: #f8f9ff !important;
            border: 1px solid #333 !important;
            padding: 10px !important;
            font-size: 11px !important;
            vertical-align: middle !important;
            text-align: center !important;
            min-height: 60px !important;
            height: auto !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            line-height: 1.3 !important;
          }
          
          /* Content within Next 30-60 days cell */
          #printable-review-table tbody tr:last-child td[colspan] > div {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            text-align: center !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            line-height: 1.3 !important;
          }
          
          /* Challenge/Opportunity section */
          #printable-review-table .mt-6 {
            margin-top: 12px !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
          }
          
          #printable-review-table .border-dashed {
            border: 2px dashed #3b82f6 !important;
            border-radius: 8px !important;
            background: rgba(59, 130, 246, 0.05) !important;
            padding: 12px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          
          #printable-review-table .border-dashed p {
            color: #333 !important;
            font-weight: bold !important;
            font-size: 11px !important;
            margin-bottom: 8px !important;
            display: flex !important;
            align-items: center !important;
          }
          
          #printable-review-table .border-dashed .ml-9 {
            margin-left: 0 !important;
            padding: 8px !important;
            background: white !important;
            border-radius: 4px !important;
            border: 1px solid #3b82f6 !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
            color: #333 !important;
            min-height: 40px !important;
            height: auto !important;
            width: 100% !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          /* Content within challenge/opportunity section */
          #printable-review-table .border-dashed .ml-9 > div {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            text-align: center !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            line-height: 1.3 !important;
          }
          
          /* Icon styling */
          #printable-review-table .bg-blue-500 {
            background: #3b82f6 !important;
            color: white !important;
            width: 24px !important;
            height: 24px !important;
            border-radius: 50% !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-right: 8px !important;
            font-size: 14px !important;
            flex-shrink: 0 !important;
          }
          
          /* This is now handled above in the main section */
          
          /* Empty cell styling */
          #printable-review-table .text-muted-foreground {
            color: #999 !important;
            font-style: italic !important;
            font-size: 9px !important;
          }
          
          /* Page margins and layout */
          @page {
            margin: 0.4in;
            size: auto;
          }
          
          /* Ensure content doesn't break across pages poorly */
          #printable-review-table table {
            page-break-inside: auto !important;
          }
          
          #printable-review-table thead {
            page-break-after: avoid !important;
          }
          
          #printable-review-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          
          #printable-review-table td {
            page-break-inside: auto !important;
          }
          
          /* Ensure challenge section stays together */
          #printable-review-table .mt-6 {
            page-break-inside: avoid !important;
          }
          
          /* Make sure table cells display properly */
          #printable-review-table td > div {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            line-height: 1.3 !important;
          }
          
          /* Content within cells should be centered */
          #printable-review-table td:not(:first-child) > div {
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100% !important;
            overflow: visible !important;
            max-height: none !important;
            padding: 4px !important;
          }
          
          /* First column content (section names) - the main container */
          #printable-review-table td:first-child > div {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100% !important;
            min-height: 60px !important;
            overflow: visible !important;
            width: 100% !important;
            padding: 4px !important;
            white-space: nowrap !important;
            line-height: 1.2 !important;
            font-size: 10px !important;
          }
          

          
          /* Clean simple borders for first column */
          #printable-review-table table tbody tr td:first-child {
            border: 1px solid #333 !important;
            border-right: 2px solid #333 !important;
          }
          
          /* Hide emoji completely in print mode - clean solution */
          #printable-review-table td:first-child span[role="img"],
          #printable-review-table td:first-child .emoji-section-icon {
            display: none !important;
          }
          
          /* Force all content to stay on one line and align properly */
          #printable-review-table td:first-child,
          #printable-review-table td:first-child > div {
            white-space: nowrap !important;
            word-break: keep-all !important;
          }
          
          /* Text content styling */
          #printable-review-table td:first-child > div > *:not([role="img"]) {
            display: inline-block !important;
            vertical-align: baseline !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
          }
          
          /* Base font size is set above in main first-child rule */
          
          /* Adjust font size for better fit in both orientations */
          @media print and (orientation: portrait) {
            #printable-review-table td:first-child {
              font-size: 9px !important;
            }
            
            #printable-review-table td:first-child span[role="img"] {
              font-size: 10px !important;
            }
            
            #printable-review-table td:first-child > div {
              padding: 4px !important;
            }
          }
          
          @media print and (orientation: landscape) {
            #printable-review-table td:first-child {
              font-size: 10px !important;
            }
            
            #printable-review-table td:first-child span[role="img"] {
              font-size: 11px !important;
            }
            
            #printable-review-table td:first-child > div {
              padding: 4px !important;
            }
          }
          
          /* Ensure all spans within cells can expand */
          #printable-review-table td > div > span {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
          }
          
          /* Hide calendar icon in print */
          #printable-review-table .lucide-calendar {
            display: none !important;
          }
          
          /* Ensure no elements have overflow hidden or height constraints */
          #printable-review-table * {
            overflow: visible !important;
            max-height: none !important;
          }
          
          /* Override any remaining height constraints on text content */
          #printable-review-table .text-xs,
          #printable-review-table .text-sm,
          #printable-review-table .text-base {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
              `}</style>

      {/* Normal view styles for emoji spacing */}
      <style jsx global>{`
        .emoji-section-icon {
          margin-right: 0.25rem;
        }
        
        @media (min-width: 640px) {
          .emoji-section-icon {
            margin-right: 0.5rem;
          }
        }
      `}</style>

      <div className="min-h-screen bg-background p-2 sm:p-4 md:p-8">
        <div className="mx-auto max-w-full">
          {pageError && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive no-print">
              {pageError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
            <div className="lg:col-span-1 flex flex-col gap-4 sm:gap-6">
              {/* Print PDF Button */}
              <div className="no-print">
                <Button 
                  onClick={handlePrint}
                  variant="outline"
                  className="w-full mb-4 flex items-center justify-center gap-2"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print PDF
                </Button>
              </div>
              
              {/* History List */}
              <HistoryList
                completedDates={completedDates}
                onViewDate={handleDateChange}
                selectedDate={selectedDate}
              />
            </div>
            
            <div className="lg:col-span-4" id="printable-review-table" data-date={format(selectedDate, "MMMM do, yyyy")}>
              {/* Print-only header */}
              <div className="print-only-header" style={{ display: 'none' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #333', color: '#333' }}>
                  Five Percent Review - {format(selectedDate, "MMMM do, yyyy")}
                </h1>
              </div>
              
              {loadingData && !apiLoading ? (
                   <div className="flex items-center justify-center h-[300px] sm:h-[400px] bg-card border rounded-lg shadow-sm">
                      <p>Loading review data...</p>
                   </div>
              ) : (
                  <EditableReviewTable
                      selectedDate={selectedDate}
                      onDateChange={handleDateChange}
                      completedDates={completedDates}
                      reviewData={editableData}
                      onReviewDataChange={handleReviewDataChange}
                      onChallengeOpportunityChange={handleChallengeOpportunityChange}
                      onSave={handleSubmit}
                      loadingSave={apiLoading}
                      errorSave={apiError?.message || null}
                  />
              )}
            </div>
          </div>
        </div>
        <Toaster />
      </div>
    </>
  );
}
