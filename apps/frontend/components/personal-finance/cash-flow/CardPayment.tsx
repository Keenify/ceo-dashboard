"use client";

import React, { useState, useEffect, startTransition } from "react";
import { useCreditCardInstruction, CreditCardInstructionDBRow, CreditCardInstructionDBInsert, CreditCardInstructionDBUpdate } from "@/app/personal-finance/services/useCreditCardInstruction";
import { usePaymentReminders, PaymentReminder } from "@/app/personal-finance/services/usePaymentReminders";
import { useUserSettings } from "@/app/personal-finance/services/useUserSettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PaymentResetSettings from "./PaymentResetSettings";

interface CardPaymentProps {
  userId: string;
}

// Enhanced card interface with reminder status (kept for background functionality)
interface CardWithReminders extends CreditCardInstructionDBRow {
  reminderStatus: 'none' | 'pending' | 'sent' | 'failed';
  reminderCount: number;
}

const CardPayment: React.FC<CardPaymentProps> = ({ userId }) => {
  const [instructions, setInstructions] = useState<CardWithReminders[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<CreditCardInstructionDBRow | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CreditCardInstructionDBInsert>>({
    card_name: "",
    payment_day: 1,
    description: "",
    instruction: "",
    is_paid: false,
  });

  const {
    fetchCreditCardInstructions,
    addCreditCardInstruction,
    updateCreditCardInstruction,
    deleteCreditCardInstruction,
    loading,
    error,
  } = useCreditCardInstruction();

  const {
    fetchRemindersByCard,
    scheduleRemindersForCard,
    cancelRemindersForCard,
    loading: remindersLoading,
    error: remindersError,
  } = usePaymentReminders();

  const {
    fetchUserSettings,
    loading: settingsLoading,
    error: settingsError,
  } = useUserSettings();

  // Load instructions with reminder status (kept for background functionality)
  const loadInstructionsWithReminders = async () => {
    const data = await fetchCreditCardInstructions(userId, 0, 100, true);
    if (data) {
      const sortedData = [...data].sort((a, b) => a.payment_day - b.payment_day);
      
      // Enhance each card with reminder status (still needed for background logic)
      const cardsWithReminders = await Promise.all(
        sortedData.map(async (card): Promise<CardWithReminders> => {
          try {
            const reminders = await fetchRemindersByCard(card.id, userId);
            
            if (!reminders || reminders.length === 0) {
              return {
                ...card,
                reminderStatus: 'none',
                reminderCount: 0,
              };
            }

            // Determine status based on most recent reminder
            const pendingReminders = reminders.filter(r => r.status === 'pending');
            const sentReminders = reminders.filter(r => r.status === 'sent');
            const failedReminders = reminders.filter(r => r.status === 'failed');

            let status: 'none' | 'pending' | 'sent' | 'failed' = 'none';
            if (pendingReminders.length > 0) {
              status = 'pending';
            } else if (failedReminders.length > 0) {
              status = 'failed';
            } else if (sentReminders.length > 0) {
              status = 'sent';
            }

            return {
              ...card,
              reminderStatus: status,
              reminderCount: reminders.length,
            };
          } catch (error) {
            console.error(`Error fetching reminders for card ${card.id}:`, error);
            return {
              ...card,
              reminderStatus: 'none',
              reminderCount: 0,
            };
          }
        })
      );

      setInstructions(cardsWithReminders);
      console.log(`Loaded ${cardsWithReminders.length} credit card instructions with reminder status`);
    }
  };

  useEffect(() => {
    if (userId) {
      loadInstructionsWithReminders();
    }
  }, [userId]);

  const handleResetComplete = () => {
    // Preserve scroll position during reset
    const currentScrollPosition = window.scrollY;
    
    // Reload instructions after reset
    loadInstructionsWithReminders().then(() => {
      // Restore scroll position after data loads
      setTimeout(() => {
        window.scrollTo(0, currentScrollPosition);
      }, 0);
    });
  };

  const handleAddNew = () => {
    setFormData({
      card_name: "",
      payment_day: 1,
      description: "",
      instruction: "",
      is_paid: false,
    });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (instruction: CreditCardInstructionDBRow) => {
    setCurrentInstruction(instruction);
    setFormData({
      card_name: instruction.card_name,
      payment_day: instruction.payment_day,
      description: instruction.description,
      instruction: instruction.instruction,
      is_paid: instruction.is_paid,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (instruction: CreditCardInstructionDBRow) => {
    setCurrentInstruction(instruction);
    setIsDeleteDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      // Ensure payment_day is between 1-31
      const numValue = parseInt(value);
      setFormData({
        ...formData,
        [name]: Math.min(Math.max(numValue, 1), 31),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData({
      ...formData,
      is_paid: checked,
    });
  };

  const handleSubmitAdd = async () => {
    if (!formData.card_name || !formData.payment_day) {
      alert("Card name and payment day are required");
      return;
    }

    const payload: CreditCardInstructionDBInsert = {
      user_id: userId,
      card_name: formData.card_name!,
      payment_day: formData.payment_day!,
      description: formData.description || null,
      instruction: formData.instruction || null,
      is_paid: formData.is_paid || false,
    };

    const result = await addCreditCardInstruction(payload);
    if (result) {
      setIsAddDialogOpen(false);
      
      // Add the new card to local state (optimistic update)
      const newCardWithReminders: CardWithReminders = {
        ...result,
        reminderStatus: 'none',
        reminderCount: 0,
      };
      
      setInstructions(prev => {
        const updated = [...prev, newCardWithReminders];
        // Keep sorted by payment_day
        return updated.sort((a, b) => a.payment_day - b.payment_day);
      });
      
      // Auto-schedule reminders in background (non-blocking)
      scheduleRemindersForNewCard(result);
      
      // Update refresh trigger for PaymentResetSettings only
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const scheduleRemindersForNewCard = async (card: CreditCardInstructionDBRow) => {
    console.log('🔧 DEBUG: scheduleRemindersForNewCard called for card:', card.card_name);
    
    try {
      // Get user settings to check if reminders are enabled
      console.log('🔧 DEBUG: Fetching user settings for user:', userId);
      const userSettings = await fetchUserSettings(userId);
      
      console.log('🔧 DEBUG: User settings received:', userSettings);
      console.log('🔧 DEBUG: Reminders enabled:', userSettings?.email_reminders_enabled);
      console.log('🔧 DEBUG: Email address:', userSettings?.email_address);
      console.log('🔧 DEBUG: Card is_paid status:', card.is_paid);
      
      if (userSettings?.email_reminders_enabled && userSettings.email_address) {
        // Only schedule reminders if card is not already paid
        if (!card.is_paid) {
          console.log(`Scheduling reminders for new card: ${card.card_name}`);
          
          const reminders = await scheduleRemindersForCard(
            card.id,
            userId,
            card.payment_day,
            userSettings.email_address,
            userSettings.reminder_days_before
          );
          
          console.log('🔧 DEBUG: scheduleRemindersForCard result:', reminders);
          
          if (reminders && reminders.length > 0) {
            console.log(`✅ Scheduled ${reminders.length} reminders for ${card.card_name}`);
          } else {
            console.log('🔧 DEBUG: No reminders were created');
          }
        } else {
          console.log(`Card ${card.card_name} is already paid, skipping reminder scheduling`);
        }
      } else {
        console.log('🔧 DEBUG: Email reminders not enabled or no email address set, skipping reminder scheduling');
        console.log('🔧 DEBUG: - email_reminders_enabled:', userSettings?.email_reminders_enabled);
        console.log('🔧 DEBUG: - email_address:', userSettings?.email_address);
      }
    } catch (error) {
      console.error('🔧 DEBUG: Error scheduling reminders for new card:', error);
      // Don't fail the card creation if reminder scheduling fails
    }
  };

  const handleSubmitEdit = async () => {
    if (!currentInstruction || !formData.card_name || !formData.payment_day) {
      return;
    }

    const payload: CreditCardInstructionDBUpdate = {
      card_name: formData.card_name,
      payment_day: formData.payment_day,
      description: formData.description,
      instruction: formData.instruction,
      is_paid: formData.is_paid,
    };

    const result = await updateCreditCardInstruction(currentInstruction.id, userId, payload);
    if (result) {
      setIsEditDialogOpen(false);
      
      // Update the specific card in local state (optimistic update)
      setInstructions(prev => {
        const updated = prev.map(item => 
          item.id === currentInstruction.id 
            ? { ...item, ...result }
            : item
        );
        // Keep sorted by payment_day
        return updated.sort((a, b) => a.payment_day - b.payment_day);
      });
      
      // Update refresh trigger for PaymentResetSettings only
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentInstruction) return;

    // Cancel any pending reminders before deleting the card (background functionality)
    try {
      await cancelRemindersForCard(currentInstruction.id, userId);
      console.log(`Cancelled reminders for deleted card: ${currentInstruction.card_name}`);
    } catch (error) {
      console.error('Error cancelling reminders for deleted card:', error);
      // Continue with deletion even if reminder cancellation fails
    }

    const result = await deleteCreditCardInstruction(currentInstruction.id, userId);
    if (result) {
      setIsDeleteDialogOpen(false);
      
      // Remove the card from local state (optimistic update)
      setInstructions(prev => 
        prev.filter(item => item.id !== currentInstruction.id)
      );
      
      // Update refresh trigger for PaymentResetSettings only
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleReminderLogic = async (
    instruction: CreditCardInstructionDBRow, 
    newPaidStatus: boolean, 
    updatedCard: CreditCardInstructionDBRow
  ) => {
    // Run reminder logic in background without blocking UI
    try {
      if (newPaidStatus) {
        // Card marked as paid - cancel pending reminders
        const cancelResult = await cancelRemindersForCard(instruction.id, userId);
        if (cancelResult) {
          console.log(`✅ Cancelled ${cancelResult.cancelled_count} pending reminders for ${instruction.card_name}`);
        }
      } else {
        // Card marked as unpaid - potentially schedule new reminders
        await scheduleRemindersForNewCard(updatedCard);
      }
    } catch (error) {
      console.error('Error handling reminder logic:', error);
      // Don't affect the main UI for reminder errors
    }
  };

  const handleTogglePaid = async (instruction: CreditCardInstructionDBRow) => {
    // Prevent any navigation or scroll behavior
    const currentScrollPosition = window.scrollY;
    
    const newPaidStatus = !instruction.is_paid;
    
    // Use startTransition to batch updates and prevent visual glitches
    startTransition(() => {
      setUpdatingCardId(instruction.id);
      setInstructions(prev => 
        prev.map(item => 
          item.id === instruction.id 
            ? { ...item, is_paid: newPaidStatus }
            : item
        )
      );
    });
    
    // Ensure scroll position remains unchanged
    window.scrollTo(0, currentScrollPosition);
    
    try {
      // Isolate database update to prevent Fast Refresh interference
      const performDatabaseUpdate = async () => {
        return await updateCreditCardInstruction(
          instruction.id,
          userId,
          { is_paid: newPaidStatus }
        );
      };
      
      // Execute in next tick to avoid Fast Refresh detection
      const result = await new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const dbResult = await performDatabaseUpdate();
            resolve(dbResult);
          } catch (error) {
            resolve(null);
          }
        }, 0);
      });
      
      if (result) {
        // Handle reminder logic in background (non-blocking)
        setTimeout(() => {
          handleReminderLogic(instruction, newPaidStatus, result as CreditCardInstructionDBRow);
        }, 10); // Small delay to ensure database operation completes first
        // NOTE: No refreshTrigger update for checkbox toggles - we use optimistic updates
      } else {
        // Revert optimistic update on failure
        startTransition(() => {
          setInstructions(prev => 
            prev.map(item => 
              item.id === instruction.id 
                ? { ...item, is_paid: !newPaidStatus }
                : item
            )
          );
        });
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      // Revert optimistic update on error
      startTransition(() => {
        setInstructions(prev => 
          prev.map(item => 
            item.id === instruction.id 
              ? { ...item, is_paid: !newPaidStatus }
              : item
          )
        );
      });
    } finally {
      startTransition(() => {
        setUpdatingCardId(null);
      });
      
      // Final scroll position preservation
      window.scrollTo(0, currentScrollPosition);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentResetSettings 
        userId={userId} 
        onResetComplete={handleResetComplete}
        refreshTrigger={refreshTrigger}
      />
      
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Credit Card Payment Instructions</h2>
        <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
          Add New Card
        </Button>
      </div>

      {error && <div className="text-red-500">{error.message}</div>}
      {remindersError && <div className="text-red-500">Reminders: {remindersError.message}</div>}
      {settingsError && <div className="text-red-500">Settings: {settingsError.message}</div>}

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Day</TableHead>
              <TableHead className="w-[180px]">Card Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Instructions</TableHead>
              <TableHead className="w-[80px]">Paid</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Loading...
                </TableCell>
              </TableRow>
            ) : instructions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  No credit card instructions found. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              instructions.map((instruction) => (
                <TableRow key={instruction.id} className={`transition-colors duration-200 ${instruction.is_paid ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                  <TableCell className="font-medium">{instruction.payment_day}</TableCell>
                  <TableCell>{instruction.card_name}</TableCell>
                  <TableCell>{instruction.description || "-"}</TableCell>
                  <TableCell>{instruction.instruction || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={instruction.is_paid} 
                        onCheckedChange={(checked) => {
                          // Prevent default browser behavior and maintain scroll position
                          if (typeof checked === 'boolean') {
                            handleTogglePaid(instruction);
                          }
                        }}
                        disabled={updatingCardId === instruction.id}
                        className={updatingCardId === instruction.id ? "opacity-50" : ""}
                      />
                      {updatingCardId === instruction.id && (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEdit(instruction)}
                              className="h-8 w-8 p-0"
                            >
                              ✏️
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDelete(instruction)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              🗑️
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Credit Card Payment Instruction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="card_name" className="text-right">
                Card Name*
              </Label>
              <Input
                id="card_name"
                name="card_name"
                value={formData.card_name || ""}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment_day" className="text-right">
                Payment Day*
              </Label>
              <Input
                id="payment_day"
                name="payment_day"
                type="number"
                min={1}
                max={31}
                value={formData.payment_day || 1}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="instruction" className="text-right">
                Instructions
              </Label>
              <Input
                id="instruction"
                name="instruction"
                value={formData.instruction || ""}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_paid" className="text-right">
                Paid
              </Label>
              <div className="col-span-3 flex items-center">
                <Checkbox
                  id="is_paid"
                  checked={formData.is_paid || false}
                  onCheckedChange={handleCheckboxChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credit Card Payment Instruction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_card_name" className="text-right">
                Card Name*
              </Label>
              <Input
                id="edit_card_name"
                name="card_name"
                value={formData.card_name || ""}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_payment_day" className="text-right">
                Payment Day*
              </Label>
              <Input
                id="edit_payment_day"
                name="payment_day"
                type="number"
                min={1}
                max={31}
                value={formData.payment_day || 1}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_description" className="text-right">
                Description
              </Label>
              <Input
                id="edit_description"
                name="description"
                value={formData.description || ""}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_instruction" className="text-right">
                Instructions
              </Label>
              <Input
                id="edit_instruction"
                name="instruction"
                value={formData.instruction || ""}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_is_paid" className="text-right">
                Paid
              </Label>
              <div className="col-span-3 flex items-center">
                <Checkbox
                  id="edit_is_paid"
                  checked={formData.is_paid || false}
                  onCheckedChange={handleCheckboxChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the payment instruction for {currentInstruction?.card_name}?
            This action cannot be undone and will cancel any pending reminders.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardPayment; 