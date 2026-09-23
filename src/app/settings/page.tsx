'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  HelpCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const [chatId, setChatId] = useState('');
  const [preference, setPreference] = useState<'all_time_low' | 'any_drop'>('all_time_low');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    // Save locally or in database
    localStorage.setItem('pw_telegram_chat_id', chatId.trim());
    localStorage.setItem('pw_notification_preference', preference);

    setTimeout(() => {
      setIsSaving(false);
      setStatusMessage({ type: 'success', text: 'Alert preferences saved successfully!' });
    }, 600);
  };

  const handleTestAlert = async () => {
    if (!chatId.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Telegram Chat ID first.' });
      return;
    }

    setIsTesting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch test notification.');

      setStatusMessage({
        type: 'success',
        text: 'Test alert delivered! Check your Telegram messages.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Alert Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure free Telegram notifications for price drops and all-time low events
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Telegram Setup Guide */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Telegram Bot Setup</h2>
            <p className="text-[11px] text-slate-400">Takes less than 1 minute to connect</p>
          </div>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
          <li>
            Open Telegram and search for{' '}
            <span className="font-semibold text-emerald-400">@userinfobot</span> (or your custom bot).
          </li>
          <li>
            Send any message or press <span className="font-semibold text-slate-100">/start</span>.
          </li>
          <li>
            The bot will reply with your unique <span className="font-semibold text-slate-100">Id</span> (e.g., <code>987654321</code>).
          </li>
          <li>Paste that ID below and click save.</li>
        </ol>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label htmlFor="telegram-chat-id-input" className="block text-xs font-semibold text-slate-200 mb-1">
              Your Telegram Chat ID
            </label>
            <input
              id="telegram-chat-id-input"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 123456789"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-2">
              Alert Trigger Frequency
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="radio"
                  name="pref"
                  value="all_time_low"
                  checked={preference === 'all_time_low'}
                  onChange={() => setPreference('all_time_low')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    All-Time Lows & Target Hits Only (Recommended)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Only alert when the product is cheaper than ever recorded or hits your custom price goal. Zero notification spam.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="radio"
                  name="pref"
                  value="any_drop"
                  checked={preference === 'any_drop'}
                  onChange={() => setPreference('any_drop')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Any Price Reduction
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Alert whenever the price drops by any amount from the previous check.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-emerald-500/20"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTesting || !chatId.trim()}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Test Alert...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Notification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security explanation */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p>
          Your Telegram Chat ID is exclusively used to route price-drop messages from your bot token. It is never sold or shared.
        </p>
      </div>
    </div>
  );
}
