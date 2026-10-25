import React from 'react';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

export const PRIVACY_STORAGE_KEY = 'shellferry_privacy_acknowledged';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleAllow = () => {
    useSettingsStore.getState().updateSetting('sendCrashReports', true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRIVACY_STORAGE_KEY, 'acknowledged');
    }
    onClose();
  };

  const handleDisable = () => {
    useSettingsStore.getState().updateSetting('sendCrashReports', false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRIVACY_STORAGE_KEY, 'acknowledged');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-[#181824] border border-[#2a2b38] p-6 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#2a2b38]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Privacy & Diagnostic Telemetry</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Transparent, privacy-preserving error reporting for ShellFerry
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 text-xs leading-relaxed">
          <p className="text-slate-300">
            ShellFerry includes an optional diagnostic reporting mechanism designed to catch unexpected crashes
            and improve app stability. Before telemetry is sent, all data undergoes client-side sanitization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* What is collected */}
            <div className="rounded-lg bg-[#11111a] border border-[#2a2b38] p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>What is collected:</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-[11px]">
                <li>Anonymous error stack traces</li>
                <li>Operating system type & platform</li>
                <li>Application version</li>
                <li>Error location (component / line)</li>
              </ul>
            </div>

            {/* What is NEVER collected */}
            <div className="rounded-lg bg-[#11111a] border border-[#2a2b38] p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-rose-400">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span>What is NEVER collected:</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-[11px]">
                <li>SSH keys & certificates</li>
                <li>Credentials & vault passwords</li>
                <li>IP addresses (redacted to <code className="text-slate-400">[IP]</code>)</li>
                <li>Terminal commands & session output</li>
                <li>Local usernames (redacted to <code className="text-slate-400">[USER]</code>)</li>
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            You can change this choice at any time in Settings -&gt; Security & Privacy.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-[#2a2b38]">
          <button
            type="button"
            onClick={handleDisable}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#11111a] hover:bg-[#1f202e] border border-[#2a2b38] text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Disable Diagnostics
          </button>
          <button
            type="button"
            onClick={handleAllow}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            Allow Diagnostic Reports (Recommended)
          </button>
        </div>
      </div>
    </div>
  );
};
