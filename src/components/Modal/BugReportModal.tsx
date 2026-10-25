import React, { useState, useEffect } from 'react';
import {
  Bug,
  Sparkles,
  Palette,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useBugReportStore, FeedbackCategory } from '../../stores/bugReportStore';
import { useThemeStore } from '../../stores/themeStore';
import {
  sanitizeCrashData,
  CRASHPULSE_ENDPOINT,
  DEFAULT_PROJECT_KEY,
} from '../../services/crashReporter';
import { APP_VERSION } from '../../version';

const CATEGORIES: { id: FeedbackCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Bug Report', label: 'Bug Report', icon: Bug },
  { id: 'UI Glitch', label: 'UI Glitch', icon: Palette },
  { id: 'Feature Idea', label: 'Feature Idea', icon: Sparkles },
];

export const BugReportModal: React.FC = () => {
  const { isOpen, category: initialCategory, closeBugReport } = useBugReportStore();
  const currentThemeId = useThemeStore((state) => state.currentThemeId);

  const [category, setCategory] = useState<FeedbackCategory>('Bug Report');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync category when opening modal with a specific category
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const sanitizedTitle = sanitizeCrashData(title.trim());
  const sanitizedDesc = sanitizeCrashData(description.trim());
  const sanitizedContact = contact.trim() ? sanitizeCrashData(contact.trim()) : undefined;

  const payload = {
    app: 'shellferry',
    version: APP_VERSION,
    os: typeof navigator !== 'undefined'
      ? (navigator.userAgent.includes('Windows') ? 'Windows' : navigator.platform || 'unknown')
      : 'unknown',
    level: category === 'Bug Report' ? 'warning' : 'info',
    message: `[Feedback: ${category}] ${sanitizedTitle || '<summary>'}`,
    stack: sanitizedDesc + (sanitizedContact ? `\nContact: ${sanitizedContact}` : ''),
    context: {
      type: 'manual_feedback',
      category,
      contact: sanitizedContact || undefined,
      screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      ...(includeDiagnostics
        ? {
            os: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            version: APP_VERSION,
            theme: currentThemeId,
          }
        : {}),
    },
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setTitle('');
    setDescription('');
    setContact('');
    setShowPreview(false);
    setError(null);
    setSubmitted(false);
    closeBugReport();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a subject summary.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description or steps.');
      return;
    }

    setIsSubmitting(true);

    const projectKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CRASHPULSE_PROJECT_KEY) ||
      DEFAULT_PROJECT_KEY;

    try {
      const response = await fetch(CRASHPULSE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': projectKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `Submission failed (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errorDetail = errJson.error;
        } catch {}
        throw new Error(errorDetail);
      }

      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report. Please check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-[#181824] border border-[#2a2b38] shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2b38] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Bug className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Send Feedback & Bug Report</h3>
              <p className="text-[11px] text-slate-400">Direct transmission to ShellFerry development team</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1e1e2d] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-white">Report Submitted</h4>
            <p className="text-xs text-slate-300 max-w-sm">
              Thank you! Your feedback has been sent to the developers.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 px-4 py-1.5 rounded-lg bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-500 text-xs text-slate-200 font-medium cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Pills */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-xs'
                          : 'bg-[#11111a] border-[#2a2b38] text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject / Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Subject <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'Bug Report'
                    ? 'e.g. Session disconnects after 5 minutes of idle'
                    : category === 'UI Glitch'
                    ? 'e.g. SFTP pane horizontal scroll overlap on split view'
                    : 'e.g. Add quick command snippets toolbar'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description / Steps to Reproduce <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what happened, steps to reproduce, or details of your suggestion..."
                className="w-full px-3 py-2 rounded-lg bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Optional Contact */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contact <span className="text-slate-500 font-normal">(Optional: Email / Telegram / GitHub)</span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. dev@example.com or @mygithub"
                className="w-full px-3 py-1.5 rounded-lg bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            {/* Diagnostics Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="include-diagnostics"
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="rounded bg-[#11111a] border-[#2a2b38] text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
              />
              <label htmlFor="include-diagnostics" className="text-xs text-slate-300 cursor-pointer select-none">
                Include anonymous system diagnostics (OS, Version, Theme)
              </label>
            </div>

            {/* Expandable Preview Sanitized Data */}
            <div className="pt-2 border-t border-[#262738]">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
              >
                {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>Preview Sanitized Data</span>
              </button>

              {showPreview && (
                <div className="mt-2">
                  <p className="text-[10px] text-slate-400 mb-1">
                    Zero-knowledge client redaction active. All paths, keys, and tokens are stripped before leaving your device:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-[#11111a] border border-[#2a2b38] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40 leading-snug">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2a2b38]">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-[#11111a] hover:bg-[#1f202e] border border-[#2a2b38] text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
