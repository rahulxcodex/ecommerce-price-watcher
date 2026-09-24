'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  MessageSquare,
  Mail,
  CreditCard,
  Smartphone,
  Save,
} from 'lucide-react';
import { AppSettings } from '@/types';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alert Settings State
  const [settings, setSettings] = useState<AppSettings>({
    id: 'default',
    telegram_chat_id: '',
    whatsapp_phone: '',
    whatsapp_apikey: '',
    email: '',
    notification_preference: 'all_time_low',
    selected_bank_cards: ['HDFC', 'ICICI', 'SBI', 'Axis'],
  });

  // Fetch saved settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.settings && data.settings.id) {
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            selected_bank_cards: data.settings.selected_bank_cards || ['HDFC', 'ICICI', 'SBI', 'Axis'],
          }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();

    // Check existing push permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setPushStatus('enabled');
      } else if (Notification.permission === 'denied') {
        setPushStatus('blocked');
      } else {
        setPushStatus('default');
      }
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setStatusMessage({ type: 'success', text: 'Alert settings saved successfully!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCard = (card: string) => {
    setSettings((prev) => {
      const exists = prev.selected_bank_cards.includes(card);
      const nextCards = exists
        ? prev.selected_bank_cards.filter((c) => c !== card)
        : [...prev.selected_bank_cards, card];
      return { ...prev, selected_bank_cards: nextCards };
    });
  };

  // Web Push Subscription Handlers
  const handleEnableWebPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatusMessage({ type: 'error', text: 'Web Push is not supported by your current browser.' });
      return;
    }

    setIsPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setPushStatus('blocked');
        throw new Error('Browser notification permission was not granted.');
      }

      // Convert VAPID key to Uint8Array
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDz0PzY-a24hFj4x96U_4gB0rR_R6jK6tFmX_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6g==';
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      }).catch(async () => {
        // Fallback if existing subscription exists
        return await reg.pushManager.getSubscription();
      });

      if (!subscription) {
        throw new Error('Failed to create browser push subscription.');
      }

      // Register subscription on backend
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) throw new Error('Failed to save push subscription on server.');

      setPushStatus('enabled');
      setStatusMessage({ type: 'success', text: 'Browser Web Push notifications successfully enabled on this device!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsPushLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <p className="text-xs">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Alert &amp; Notification Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure personal notifications across Telegram, WhatsApp, Email, and Browser Push
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

      {/* Web Push Notification Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Instant In-Browser Web Push</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Receive instant mobile and desktop alerts when price drops occur, even when the website is closed.
          </p>
        </div>

        <button
          type="button"
          onClick={handleEnableWebPush}
          disabled={isPushLoading || pushStatus === 'enabled'}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap ${
            pushStatus === 'enabled'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
          }`}
        >
          {isPushLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : pushStatus === 'enabled' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <BellRing className="w-3.5 h-3.5" />
          )}
          <span>{pushStatus === 'enabled' ? 'Push Alerts Active' : 'Enable on this Device'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Telegram Configuration */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">1. Telegram Bot Alerts</h2>
              <p className="text-[11px] text-slate-400">
                Send <code>/start</code> to your bot to receive your Telegram Chat ID
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={settings.telegram_chat_id || ''}
              onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              placeholder="e.g. 123456789"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Free WhatsApp Configuration (CallMeBot) */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">2. Free WhatsApp Alerts (CallMeBot)</h2>
              <p className="text-[11px] text-slate-400">
                100% Free personal WhatsApp gateway. Send &quot;I allow callmebot to send me messages&quot; to <code>+34 911 06 14 91</code> to get your API key.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                WhatsApp Phone Number (with country code)
              </label>
              <input
                type="text"
                value={settings.whatsapp_phone || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_phone: e.target.value })}
                placeholder="+919876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                CallMeBot API Key
              </label>
              <input
                type="password"
                value={settings.whatsapp_apikey || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_apikey: e.target.value })}
                placeholder="e.g. 123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </div>

        {/* Email Alerts (Google Apps Script) */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">3. Email Alerts (Google Apps Script)</h2>
              <p className="text-[11px] text-slate-400">
                Free Gmail dispatching directly to your inbox
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Notification Frequency Preference */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">4. Alert Trigger Preference</h2>
              <p className="text-[11px] text-slate-400">
                Choose when you want to receive price drop alerts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { id: 'all_time_low', title: 'All-Time Lows Only', desc: 'Trigger only when price beats historic minimum' },
              { id: 'any_drop', title: 'Any Price Drop', desc: 'Trigger on any discount or price reduction' },
              { id: 'never', title: 'Mute Notifications', desc: 'Keep tracking prices without sending alerts' },
            ].map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setSettings({ ...settings, notification_preference: option.id as any })}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  settings.notification_preference === option.id
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-semibold">{option.title}</div>
                <div className="text-[11px] text-slate-400 mt-1">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Bank Cards for Discount Calculation */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">5. Bank Offer & Card Calculator</h2>
              <p className="text-[11px] text-slate-400">
                Select the bank cards you own to automatically calculate net payable prices on products
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'OneCard', 'Federal', 'Bank of Baroda'].map((bank) => {
              const active = settings.selected_bank_cards.includes(bank);
              return (
                <button
                  type="button"
                  key={bank}
                  onClick={() => handleToggleCard(bank)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {active ? `✓ ${bank}` : `+ ${bank}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save All Settings</span>
        </button>
      </form>
    </div>
  );
}
