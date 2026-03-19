"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/app/futureme/components/Badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useHabitBuddies, HabitBuddyResponse } from '@/app/habit-tracker/services/useHabitBuddies';
import { toast } from 'sonner';
import { Mail, Plus, Trash2, Send, Users, Loader2, EyeOff, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface HabitBuddyManagerProps {
  userId: string;
}

export function HabitBuddyManager({ userId }: HabitBuddyManagerProps) {
  const [email, setEmail] = useState('');
  const [censorHabits, setCensorHabits] = useState(false);
  const [buddies, setBuddies] = useState<HabitBuddyResponse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [editingBuddy, setEditingBuddy] = useState<HabitBuddyResponse | null>(null);

  const {
    createHabitBuddy,
    fetchHabitBuddies,
    updateHabitBuddy,
    deleteHabitBuddy,
    sendAccountabilityEmail,
    loading,
    error,
  } = useHabitBuddies();

  // Load buddies on component mount
  useEffect(() => {
    loadBuddies();
  }, [userId]);

  const loadBuddies = async () => {
    if (!userId) return;
    const fetchedBuddies = await fetchHabitBuddies(userId);
    if (fetchedBuddies) {
      setBuddies(fetchedBuddies);
    }
  };

  const handleAddBuddy = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if email already exists (only when not editing)
    if (!editingBuddy && buddies.some(buddy => buddy.buddy_email.toLowerCase() === email.toLowerCase())) {
      toast.error('This email is already added as a buddy');
      return;
    }

    try {
      let result: HabitBuddyResponse | null = null;

      if (editingBuddy) {
        // Update existing buddy
        result = await updateHabitBuddy(editingBuddy.id, {
          buddy_email: email.trim(),
          censor_habits: censorHabits,
        });
        
        if (result) {
          setBuddies(prev => prev.map(buddy => 
            buddy.id === editingBuddy.id ? result! : buddy
          ));
          toast.success('Habit buddy updated successfully!');
        } else {
          toast.error('Failed to update habit buddy');
        }
      } else {
        // Create new buddy
        result = await createHabitBuddy({
          user_id: userId,
          buddy_email: email.trim(),
          censor_habits: censorHabits,
        });

        if (result) {
          setBuddies(prev => [...prev, result!]);
          toast.success('Habit buddy added successfully! They will receive automated emails twice daily.');
        } else {
          toast.error('Failed to add habit buddy');
        }
      }

      if (result) {
        setEmail('');
        setCensorHabits(false);
        setEditingBuddy(null);
        setIsDialogOpen(false);
      }
    } catch (err) {
      toast.error(editingBuddy ? 'Failed to update habit buddy' : 'Failed to add habit buddy');
      console.error('Error with buddy:', err);
    }
  };

  const handleEditBuddy = (buddy: HabitBuddyResponse) => {
    setEditingBuddy(buddy);
    setEmail(buddy.buddy_email);
    setCensorHabits(buddy.censor_habits);
    setIsDialogOpen(true);
  };

  const handleDeleteBuddy = async (buddyId: string, buddyEmail: string) => {
    try {
      const success = await deleteHabitBuddy(buddyId);
      if (success) {
        setBuddies(prev => prev.filter(buddy => buddy.id !== buddyId));
        toast.success(`Removed ${buddyEmail} from habit buddies`);
      } else {
        toast.error('Failed to remove habit buddy');
      }
    } catch (err) {
      toast.error('Failed to remove habit buddy');
      console.error('Error deleting buddy:', err);
    }
  };

  const handleSendEmail = async (buddyId: string, buddyEmail: string) => {
    setSendingEmailId(buddyId);
    try {
      const result = await sendAccountabilityEmail(buddyId, userId);
      if (result.success) {
        toast.success(`Accountability email sent to ${buddyEmail}!`);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (err) {
      toast.error('Failed to send email');
      console.error('Error sending email:', err);
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingBuddy(null);
    setEmail('');
    setCensorHabits(false);
    setIsDialogOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Trigger Button */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          handleCancelEdit();
        }
      }}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-2 border-blue-500 hover:border-blue-600 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Users className="h-4 w-4" />
            Habit Buddies
            {buddies.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800 border border-blue-300">
                {buddies.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[88vw] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Habit Accountability Buddies
            </DialogTitle>
            <DialogDescription>
              Add email addresses to receive automated accountability reports twice daily (7:59 AM & 11:59 PM Singapore time).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add New Buddy Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {editingBuddy ? (
                    <>
                      <Edit className="h-4 w-4" />
                      Edit Buddy
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add New Buddy
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddBuddy();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleAddBuddy} 
                      disabled={loading || !email.trim()}
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingBuddy ? (
                        <Edit className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {editingBuddy ? 'Update' : 'Add'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="censor-habits"
                      checked={censorHabits}
                      onCheckedChange={(checked) => setCensorHabits(!!checked)}
                    />
                    <Label htmlFor="censor-habits" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Censor habit names in emails
                      </div>
                    </Label>
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium mb-1">🔒 Privacy Option:</p>
                    <p>When enabled, habit names will be replaced with asterisks (***) in accountability emails. All other data (completion status, streaks, values) will still be visible for accountability purposes.</p>
                  </div>

                  {editingBuddy && (
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="w-full"
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Buddies Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Current Buddies ({buddies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {buddies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No habit buddies added yet.</p>
                    <p className="text-sm">Add an email above to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {buddies.map((buddy) => (
                      <div
                        key={buddy.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-medium">{buddy.buddy_email}</div>
                            {buddy.censor_habits && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border border-orange-300">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Censored
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Added on {formatDate(buddy.created_at)}
                            {buddy.censor_habits && (
                              <span className="block text-orange-600">
                                Habit names will appear as *** in emails
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendEmail(buddy.id, buddy.buddy_email)}
                            disabled={sendingEmailId === buddy.id}
                            className="gap-2"
                          >
                            {sendingEmailId === buddy.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Send Now
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditBuddy(buddy)}
                            disabled={loading}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBuddy(buddy.id, buddy.buddy_email)}
                            disabled={loading}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Section */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <h4 className="font-medium text-blue-900">📧 Automated Email Schedule:</h4>
                  <ul className="space-y-1 text-blue-800 ml-4">
                    <li>• <strong>Morning (7:59 AM):</strong> 7-day comprehensive habit report</li>
                    <li>• <strong>Evening (11:59 PM):</strong> Today's habit progress update</li>
                    <li>• <strong>Timezone:</strong> Singapore Time (Asia/Singapore)</li>
                  </ul>
                  <p className="text-blue-700 mt-3">
                    💡 <strong>Tip:</strong> Use the "Send Now" button to send manual updates anytime!
                  </p>
                  <p className="text-blue-700 mt-2">
                    🔒 <strong>Privacy:</strong> Enable censoring to hide habit names while keeping accountability data visible.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 