import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FutureLetterResponse } from '../services/useFutureLetters';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Pencil, Trash2, Calendar, FileText, AlertCircle, CheckCircle2, Clock, Lock, Shield } from 'lucide-react';
import { Badge } from './Badge';

interface FutureLetterListProps {
  letters: FutureLetterResponse[];
  onEdit: (letter: FutureLetterResponse) => void;
  onDelete: (id: string) => void;
}

export default function FutureLetterList({ letters, onEdit, onDelete }: FutureLetterListProps) {
  const [selectedLetter, setSelectedLetter] = useState<FutureLetterResponse | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<string | null>(null);

  const handleViewDetails = (letter: FutureLetterResponse) => {
    setSelectedLetter(letter);
  };

  const handleDeleteClick = (id: string) => {
    setLetterToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (letterToDelete) {
      onDelete(letterToDelete);
      setDeleteConfirmOpen(false);
      setLetterToDelete(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="success">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Scheduled</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Send Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Files</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {letters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No letters found. Create your first letter to your future self.
                </TableCell>
              </TableRow>
            ) : (
              letters.map((letter) => (
                <TableRow key={letter.id}>
                  <TableCell className="font-medium">{letter.recipient_email}</TableCell>
                  <TableCell>{letter.email_subject || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      {format(parseISO(letter.send_date), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(letter.send_status)}
                      <span>{letter.send_status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {letter.attachment_urls && letter.attachment_urls.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span>{letter.attachment_urls.length}</span>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(letter)}
                        aria-label="View details"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      {letter.send_status !== 'sent' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(letter)}
                            aria-label="Edit letter"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(letter.id)}
                            aria-label="Delete letter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Letter details dialog */}
      {selectedLetter && (
        <Dialog open={!!selectedLetter} onOpenChange={() => setSelectedLetter(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Letter Details</span>
                <Badge variant="secondary" className="flex items-center gap-1 ml-2">
                  <Shield className="h-3 w-3" />
                  <span>Encrypted</span>
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedLetter.email_subject || 'No subject'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Status</h3>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge(selectedLetter.send_status)}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium">Recipient</h3>
                <p className="mt-1">{selectedLetter.recipient_email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Scheduled for</h3>
                <p className="mt-1">
                  {format(parseISO(selectedLetter.send_date), 'PPPP')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium flex items-center">
                  Message Content
                  <Lock className="h-3 w-3 ml-1 text-muted-foreground" />
                </h3>
                <div className="mt-1 whitespace-pre-wrap border rounded-md p-3 max-h-[200px] overflow-y-auto text-sm break-words relative">
                  {selectedLetter.email_content}
                  <div className="absolute top-2 right-2 text-muted-foreground">
                    <Lock className="h-3 w-3" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  Your message is end-to-end encrypted for privacy.
                </p>
              </div>
              {selectedLetter.attachment_urls && selectedLetter.attachment_urls.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">Attachments</h3>
                  <ul className="mt-1 list-disc pl-5">
                    {selectedLetter.attachment_urls.map((url, index) => {
                      const fullFileName = url.split('/').pop() || `File ${index + 1}`;
                      const fileName = fullFileName.includes('_') ? 
                        fullFileName.substring(fullFileName.indexOf('_') + 1) : 
                        fullFileName;
                      
                      return (
                        <li key={url}>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-500 hover:underline break-all"
                          >
                            {decodeURIComponent(fileName)}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Letter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this letter? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 