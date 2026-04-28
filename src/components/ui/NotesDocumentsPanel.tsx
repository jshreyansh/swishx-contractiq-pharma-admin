import { FileText, Paperclip } from 'lucide-react';
import type { DemoDocument } from '../../utils/demoDocuments';

interface NotesDocumentsPanelProps {
  title?: string;
  notes?: string | null;
  documents?: DemoDocument[];
  compact?: boolean;
  className?: string;
}

export default function NotesDocumentsPanel({
  title = 'Notes & Documents',
  notes,
  documents = [],
  compact = false,
  className = '',
}: NotesDocumentsPanelProps) {
  const cleanNotes = notes?.trim() || '';

  if (!cleanNotes && documents.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <Paperclip size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-[11px] text-slate-400">
              {cleanNotes ? 'Notes available' : 'No notes'}{documents.length > 0 ? ` · ${documents.length} document${documents.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className={`grid gap-3 p-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
        {cleanNotes && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={13} className="text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{cleanNotes}</p>
          </div>
        )}

        {documents.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Paperclip size={13} className="text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attached Documents</p>
            </div>
            <div className="space-y-2">
              {documents.map(document => (
                <div key={document.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{document.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{document.addedBy} · {document.addedAt}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {document.kind}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
