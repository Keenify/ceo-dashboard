"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUserSettings, UserSettings } from "@/app/personal-finance/services/useUserSettings";
import { usePaymentReminders } from "@/app/personal-finance/services/usePaymentReminders";
import { useCreditCardInstruction, CreditCardInstructionDBRow } from "@/app/personal-finance/services/useCreditCardInstruction";
import { getCardsToReset, getResetSummary, formatNextResetDate, getCurrentDateISO, shouldResetCard } from "@/app/personal-finance/utils/paymentResetUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Calendar, Settings, Mail, Clock, CreditCard, Send } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface PaymentResetSettingsProps {
  userId: string;
  onResetComplete?: () => void;
  refreshTrigger?: number;
}

const PaymentResetSettings: React.FC<PaymentResetSettingsProps> = ({ 
  userId, 
  onResetComplete,
  refreshTrigger
}) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState<boolean>(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(3);
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [cards, setCards] = useState<CreditCardInstructionDBRow[]>([]);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);

  // Track if auto-reset has been performed to prevent infinite loops
  const hasPerformedAutoReset = useRef<boolean>(false);
  const autoResetInProgress = useRef<boolean>(false);

  const { 
    fetchUserSettings, 
    saveUserSettings, 
    loading: settingsLoading 
  } = useUserSettings();

  const {
    scheduleRemindersForCard,
    cancelRemindersForCard,
    fetchRemindersByCard,
    loading: remindersLoading,
    error: remindersError
  } = usePaymentReminders();
  
  const { 
    fetchCreditCardInstructions,
    updateCreditCardInstruction,
    loading: cardsLoading 
  } = useCreditCardInstruction();

  // Load user settings and cards on component mount
  useEffect(() => {
    loadSettingsAndCards();
  }, [userId]);

  // Reload cards when CardPayment operations trigger refresh
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log('🔄 PaymentResetSettings: Refreshing due to CardPayment changes');
      loadSettingsAndCards();
    }
  }, [refreshTrigger]);

  // Auto-reset check - only run once when component first loads with cards
  useEffect(() => {
    if (cards.length > 0 && !hasPerformedAutoReset.current && !autoResetInProgress.current) {
      hasPerformedAutoReset.current = true;
      checkAndAutoResetCards();
    }
  }, [cards.length > 0]); // Only trigger when we first get cards

  const loadSettingsAndCards = async () => {
    // Load user settings from database
    const userSettings = await fetchUserSettings(userId);
    if (userSettings) {
      setSettings(userSettings);
      setEmailRemindersEnabled(userSettings.email_reminders_enabled);
      setReminderDaysBefore(userSettings.reminder_days_before);
      setEmailAddress(userSettings.email_address);
    }

    // Load credit cards
    const userCards = await fetchCreditCardInstructions(userId);
    if (userCards) {
      setCards(userCards);
    }
  };

  const checkAndAutoResetCards = async () => {
    if (autoResetInProgress.current) {
      console.log("Auto-reset already in progress, skipping...");
      return;
    }

    autoResetInProgress.current = true;

    try {
      const { cardsToReset } = getCardsToReset(cards);
      
      if (cardsToReset.length > 0) {
        console.log(`Auto-resetting ${cardsToReset.length} cards that passed their due dates`);
        
        let resetCount = 0;
        for (const card of cardsToReset) {
          try {
            const result = await updateCreditCardInstruction(card.id, userId, {
              is_paid: false,
              last_reset_date: getCurrentDateISO()
            });

            if (result) {
              console.log(`✅ Auto-reset card: ${card.card_name || card.id}`);
              resetCount++;
            }
          } catch (error) {
            console.error(`❌ Failed to auto-reset card ${card.id}:`, error);
          }
        }

        if (resetCount > 0) {
          // Show user notification
          setMessage(`${resetCount} card${resetCount > 1 ? 's' : ''} automatically reset for the new month.`);
          setMessageType("info");
          setTimeout(() => setMessage(""), 5000);

          // Notify parent component
          onResetComplete?.();

          // Reload cards to reflect updates, but don't trigger another auto-reset
          const userCards = await fetchCreditCardInstructions(userId);
          if (userCards) {
            setCards(userCards);
          }
        }
      } else {
        console.log("No cards need auto-reset");
      }
    } catch (error) {
      console.error("Error during auto-reset check:", error);
    } finally {
      autoResetInProgress.current = false;
    }
  };

  const handleReminderToggle = async (enabled: boolean) => {
    setEmailRemindersEnabled(enabled);
    
    if (enabled) {
      // When enabling reminders, validate email first
      if (!emailAddress.trim()) {
        toast.error("Please enter an email address before enabling reminders.");
        setEmailRemindersEnabled(false); // Revert toggle
        return;
      }
      
      // Schedule reminders for all unpaid cards
      await scheduleRemindersForAllCards();
      toast.success("Email reminders enabled successfully!");
    } else {
      // When disabling reminders, cancel all pending reminders
      await cancelAllPendingReminders();
      toast.success("Email reminders disabled successfully!");
    }
  };

  const scheduleRemindersForAllCards = async () => {
    if (!emailAddress.trim()) {
      console.log("No email address provided, skipping reminder scheduling");
      return;
    }

    try {
      console.log("🔄 Creating consolidated reminders via backend API...");
      
      const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
      
      const response = await fetch(`${backendApiDomain}/payment-reminders/create-consolidated`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          email: emailAddress.trim(),
          reminder_days_before: reminderDaysBefore
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Backend consolidated reminders created:", result);
        
        setMessage(result.message);
        setMessageType("success");
        setTimeout(() => setMessage(""), 8000);
      } else {
        const errorData = await response.json();
        console.error("❌ Backend consolidated reminders failed:", errorData);
        
        setMessage(errorData.detail || "Failed to create consolidated reminders.");
        setMessageType("error");
        setTimeout(() => setMessage(""), 5000);
      }

    } catch (error) {
      console.error("❌ Error calling backend consolidated reminders API:", error);
      setMessage("Failed to schedule reminders. Please check your connection and try again.");
      setMessageType("error");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const cancelAllPendingReminders = async () => {
    let cancelledCount = 0;

    for (const card of cards) {
      try {
        const result = await cancelRemindersForCard(card.id, userId);
        if (result && result.cancelled_count > 0) {
          cancelledCount += result.cancelled_count;
          console.log(`✅ Cancelled ${result.cancelled_count} reminders for ${card.card_name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to cancel reminders for ${card.card_name}:`, error);
      }
    }

    if (cancelledCount > 0) {
      setMessage(`Cancelled ${cancelledCount} pending reminders.`);
      setMessageType("info");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSaveSettings = async () => {
    if (reminderDaysBefore < 1 || reminderDaysBefore > 14) {
      setMessage("Reminder days must be between 1 and 14.");
      setMessageType("error");
      return;
    }

    if (emailRemindersEnabled && !emailAddress.trim()) {
      setMessage("Email address is required when reminders are enabled.");
      setMessageType("error");
      return;
    }

    // Validate email format if provided
    if (emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      setMessage("Please enter a valid email address.");
      setMessageType("error");
      return;
    }

    // Check if email or days changed (will require rescheduling reminders)
    const emailChanged = settings?.email_address !== emailAddress.trim();
    const daysChanged = settings?.reminder_days_before !== reminderDaysBefore;
    const enabledChanged = settings?.email_reminders_enabled !== emailRemindersEnabled;

    const result = await saveUserSettings(userId, {
      email_reminders_enabled: emailRemindersEnabled,
      reminder_days_before: reminderDaysBefore,
      email_address: emailAddress.trim(),
    });

    if (result) {
      setSettings(result);
      
      // Handle reminder rescheduling if needed
      if (emailRemindersEnabled && (emailChanged || daysChanged)) {
        setMessage("Settings saved! Rescheduling reminders with new settings...");
        setMessageType("info");
        
        // Cancel existing reminders and reschedule with new settings
        await cancelAllPendingReminders();
        await scheduleRemindersForAllCards();
        
        setMessage("Email settings updated and reminders rescheduled successfully!");
        setMessageType("success");
      } else {
        setMessage("Email settings updated successfully!");
        setMessageType("success");
      }
      
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("Failed to update settings.");
      setMessageType("error");
    }
  };

  const handleSendTestEmail = async () => {
    if (!emailAddress.trim()) {
      toast.error("Please enter an email address first.");
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSendingTestEmail(true);
    
    try {
      console.log('🚀 Sending test email via backend API...');
      
      const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
      
      const response = await fetch(`${backendApiDomain}/payment-reminders/send-test-email`, {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_id: userId,
          email: emailAddress.trim(),
          reminder_days_before: reminderDaysBefore 
        })
      });
      
      console.log('📡 Backend response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Backend test email API succeeded:', result);
        
        toast.success(
          `Test email sent successfully to ${emailAddress.trim()}! ` +
          `${result.cards_included > 0 ? `Included ${result.cards_included} card${result.cards_included > 1 ? 's' : ''}.` : ''} ` +
          `This shows how your consolidated monthly reminders will look.`
        );
      } else {
        const errorData = await response.json();
        console.error('❌ Backend test email API failed:', errorData);
        
        throw new Error(errorData.detail || 'Failed to send test email');
      }
      
    } catch (error) {
      console.error("Error sending test email:", error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error("Could not connect to email service. Please check your internet connection.");
        } else {
          toast.error(`Failed to send test email: ${error.message}`);
        }
      } else {
        toast.error("Failed to send test email. Please try again.");
      }
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const getResetInfoDisplay = () => {
    if (cards.length === 0) {
      return (
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            No credit cards found. Add credit cards to see their reset schedules.
          </p>
        </div>
      );
    }

    const resetSummary = getResetSummary(cards);
    
    return (
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="text-sm space-y-2">
          <p className="text-muted-foreground mb-3">
            Each card automatically resets to "unpaid" the day after its payment due date passes.
          </p>
          
          {resetSummary.nextResetDates.map((resetInfo, index) => {
            const card = cards[index];
            if (!card) return null;
            
            const resetCheck = shouldResetCard(card);
            
            return (
              <div key={card.id} className="flex justify-between items-center py-1 border-b border-muted/30 last:border-b-0">
                <div>
                  <span className="font-medium">{card.card_name}</span>
                  <span className="text-muted-foreground ml-2">(due {card.payment_day}{getOrdinalSuffix(card.payment_day)})</span>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {resetCheck.shouldReset && !hasPerformedAutoReset.current ? (
                      <span className="text-orange-600 font-medium">Resetting now...</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Next reset: </span>
                        <span className="font-medium">{resetInfo.nextReset}</span>
                      </>
                    )}
                  </div>
                  {(!resetCheck.shouldReset || hasPerformedAutoReset.current) && (
                    <div className="text-xs text-muted-foreground">
                      {resetInfo.daysUntilReset > 0 ? `in ${resetInfo.daysUntilReset} days` : 'today'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <CardTitle className="text-lg">Payment Settings</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Hide" : "Show"}
          </Button>
        </div>
        <CardDescription>
          Configure consolidated monthly email reminders and view automatic reset schedule
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {message && (
            <Alert className={messageType === "error" ? "border-red-500" : messageType === "success" ? "border-green-500" : ""}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {remindersError && (
            <Alert className="border-red-500">
              <AlertDescription>Reminders Error: {remindersError.message}</AlertDescription>
            </Alert>
          )}

          {/* Automatic Reset Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" />
              <h3 className="font-semibold">Automatic Reset Schedule</h3>
            </div>

            {getResetInfoDisplay()}
          </div>

          {/* Email Reminder Settings */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4" />
              <h3 className="font-semibold">Email Reminder Settings</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-reminders">Enable Email Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive one consolidated monthly email with all upcoming credit card payments
                  </p>
                </div>
                <Switch
                  id="email-reminders"
                  checked={emailRemindersEnabled}
                  onCheckedChange={handleReminderToggle}
                  disabled={settingsLoading || remindersLoading}
                />
              </div>

              {emailRemindersEnabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reminderDays">Days Before Due Date</Label>
                      <Input
                        id="reminderDays"
                        type="number"
                        min={1}
                        max={14}
                        value={reminderDaysBefore}
                        onChange={(e) => setReminderDaysBefore(parseInt(e.target.value) || 3)}
                        className="w-20"
                      />
                      <p className="text-sm text-muted-foreground">
                        Consolidated email will be sent this many days before your earliest due date (1-14)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="emailAddress">Email Address</Label>
                      <Input
                        id="emailAddress"
                        type="email"
                        placeholder="your.email@example.com"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        Where to send payment reminder emails
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveSettings}
                      disabled={settingsLoading || remindersLoading}
                      size="sm"
                    >
                      {settingsLoading || remindersLoading ? "Saving..." : "Save Email Settings"}
                    </Button>
                    <Button 
                      onClick={handleSendTestEmail}
                      disabled={isSendingTestEmail || !emailAddress.trim()}
                      variant="outline"
                      size="sm"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSendingTestEmail ? "Sending..." : "Send Test Email"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default PaymentResetSettings; 