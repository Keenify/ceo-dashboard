/**
 * Payment reset utilities for individual card-based reset system
 * Each card resets automatically the day after its payment due date passes
 */

import type { Database } from '@/lib/database.types';

// Use the proper database type instead of custom interface
export type CreditCard = Database['public']['Tables']['credit_card_instructions']['Row'];

/**
 * Determines if a specific credit card should be reset based on its individual payment day
 * Cards reset the day after their payment due date passes
 */
export function shouldResetCard(card: CreditCard): {
  shouldReset: boolean;
  nextResetDate: Date;
  daysSinceLastReset: number;
  reasonCode: string;
} {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Calculate this month's due date
  let thisMonthDueDate: Date;
  try {
    thisMonthDueDate = new Date(currentYear, currentMonth, card.payment_day);
  } catch (error) {
    // Handle invalid dates (e.g., Feb 30th)
    thisMonthDueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
  }

  // Calculate this month's reset date (day after due date)
  const thisMonthResetDate = new Date(thisMonthDueDate);
  thisMonthResetDate.setDate(thisMonthResetDate.getDate() + 1);
  
  // Calculate next month's due date
  let nextMonthDueDate: Date;
  try {
    nextMonthDueDate = new Date(currentYear, currentMonth + 1, card.payment_day);
  } catch (error) {
    // Handle invalid dates
    nextMonthDueDate = new Date(currentYear, currentMonth + 2, 0); // Last day of next month
  }

  // Calculate next month's reset date (day after next month's due date)
  const nextMonthResetDate = new Date(nextMonthDueDate);
  nextMonthResetDate.setDate(nextMonthResetDate.getDate() + 1);

  // Determine which reset date to show as "next"
  let nextResetDate: Date;
  if (today < thisMonthResetDate) {
    // This month's reset hasn't happened yet
    nextResetDate = thisMonthResetDate;
  } else {
    // This month's reset has passed, show next month's
    nextResetDate = nextMonthResetDate;
  }

  // Calculate days since last reset
  let daysSinceLastReset = 0;
  if (card.last_reset_date) {
    const lastReset = new Date(card.last_reset_date);
    daysSinceLastReset = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Check if we should reset this card
  let shouldReset = false;
  let reasonCode = "no_reset_needed";

  // Case 1: Due date has passed and we haven't reset yet this cycle
  if (today > thisMonthDueDate) {
    const dayAfterDue = new Date(thisMonthDueDate);
    dayAfterDue.setDate(dayAfterDue.getDate() + 1);

    // If today is day after due date or later, check if we need to reset
    if (today >= dayAfterDue) {
      // Check if we've already reset this cycle
      const lastReset = card.last_reset_date ? new Date(card.last_reset_date) : null;
      
      // We should reset if:
      // 1. We've never reset before, OR
      // 2. The last reset was BEFORE this month's due date (meaning it was for a previous cycle)
      if (!lastReset) {
        shouldReset = true;
        reasonCode = "never_reset_before";
      } else {
        // If we reset AFTER the due date this month, we don't need to reset again
        // If we reset BEFORE the due date this month, it was for a previous cycle
        if (lastReset >= thisMonthDueDate) {
          shouldReset = false;
          reasonCode = "already_reset_this_cycle";
        } else {
          shouldReset = true;
          reasonCode = "due_date_passed";
        }
      }
    } else {
      reasonCode = "waiting_for_day_after_due";
    }
  } else {
    reasonCode = "due_date_not_reached";
  }

  return {
    shouldReset,
    nextResetDate,
    daysSinceLastReset,
    reasonCode
  };
}

/**
 * Checks all cards for a user and returns which ones need to be reset
 */
export function getCardsToReset(cards: CreditCard[]): {
  cardsToReset: CreditCard[];
  resetInfo: Array<{
    card: CreditCard;
    resetCheck: ReturnType<typeof shouldResetCard>;
  }>;
} {
  const cardsToReset: CreditCard[] = [];
  const resetInfo: Array<{
    card: CreditCard;
    resetCheck: ReturnType<typeof shouldResetCard>;
  }> = [];

  for (const card of cards) {
    const resetCheck = shouldResetCard(card);
    
    resetInfo.push({
      card,
      resetCheck
    });

    if (resetCheck.shouldReset) {
      cardsToReset.push(card);
    }
  }

  return {
    cardsToReset,
    resetInfo
  };
}

/**
 * Formats the next reset date for display
 */
export function formatNextResetDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Gets current date in ISO format (YYYY-MM-DD)
 */
export function getCurrentDateISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculates the next due date for a card based on its payment day
 */
export function getNextDueDate(paymentDay: number): Date {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  // Try current month first
  let dueDate: Date;
  try {
    dueDate = new Date(currentYear, currentMonth, paymentDay);
  } catch (error) {
    // Handle invalid dates (e.g., Feb 30th) - use last day of month
    dueDate = new Date(currentYear, currentMonth + 1, 0);
  }
  
  // If due date has passed this month, use next month
  if (dueDate <= today) {
    try {
      dueDate = new Date(currentYear, currentMonth + 1, paymentDay);
    } catch (error) {
      // Handle invalid dates for next month
      dueDate = new Date(currentYear, currentMonth + 2, 0);
    }
  }
  
  return dueDate;
}

/**
 * Gets a summary of reset status for all cards
 */
export function getResetSummary(cards: CreditCard[]): {
  totalCards: number;
  cardsNeedingReset: number;
  nextResetDates: Array<{
    cardName: string;
    nextReset: string;
    daysUntilReset: number;
  }>;
} {
  const { cardsToReset, resetInfo } = getCardsToReset(cards);
  
  const nextResetDates = resetInfo.map(info => {
    const today = new Date();
    const daysUntilReset = Math.ceil(
      (info.resetCheck.nextResetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      cardName: `Card (due ${info.card.payment_day})`,
      nextReset: formatNextResetDate(info.resetCheck.nextResetDate),
      daysUntilReset
    };
  });

  return {
    totalCards: cards.length,
    cardsNeedingReset: cardsToReset.length,
    nextResetDates
  };
} 