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
  Radio,
  Sparkles,
  Download,
  Info,
  RotateCcw,
  Crown,
} from 'lucide-react';
import { AppSettings } from '@/types';
import { useAuth } from '@/contexts/auth-context';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Alert Settings State
  const [settings, setSettings] = useState<AppSettings>({
    id: 'default',
    telegram_chat_id: '',
    whatsapp_phone: '',
    whatsapp_apikey: '',
    email: '',
    discord_webhook: '',
    ntfy_topic: '',
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

    // Check existing push permission status and auto-sync subscription
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          navigator.serviceWorker.ready.then(async (reg) => {
            try {
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                const vapidKey =
                  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
                  'BJeWpGbW6kkqoVzplUPqE-4NClupkqYD0xM8v7V-pNo84btMzAllrq1r7uIttyv7p1O6ghne_eSCSHvMUu7Qsx8';
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidKey),
                });
              }
              if (sub) {
                await fetch('/api/push/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscription: sub }),
                }).catch(() => {});
                setPushStatus('enabled');
              } else {
                setPushStatus('default');
              }
            } catch {
              setPushStatus('default');
            }
          }).catch(() => {
            setPushStatus('default');
          });
        } else {
          setPushStatus('enabled');
        }
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

    // Check if permission is already explicitly denied
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
      setPushStatus('blocked');
      setStatusMessage({
        type: 'error',
        text: 'Browser notification permission is currently blocked in your browser settings. Please click the site settings / lock icon beside the URL in your browser address bar, set Notifications to "Allow", and reload this page.',
      });
      return;
    }

    setIsPushLoading(true);
    setStatusMessage(null);
    try {
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('blocked');
        throw new Error(
          'Browser notification permission was not granted. To allow: click the site settings / lock icon in your browser address bar -> set Notifications to "Allow" -> reload.'
        );
      }

      // Convert VAPID key to Uint8Array
      const vapidKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        'BJeWpGbW6kkqoVzplUPqE-4NClupkqYD0xM8v7V-pNo84btMzAllrq1r7uIttyv7p1O6ghne_eSCSHvMUu7Qsx8';
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

      let subscription: PushSubscription | null = null;
      try {
        subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }
      } catch (subErr: any) {
        console.warn('Initial push subscription failed, attempting reset:', subErr);
        // Clear stale subscription and re-subscribe
        try {
          const stale = await reg.pushManager.getSubscription();
          if (stale) await stale.unsubscribe();
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        } catch (retryErr: any) {
          const rawErr = retryErr?.message || String(retryErr);
          if (rawErr.includes('push service error') || rawErr.includes('Registration failed')) {
            const isBrave = typeof (navigator as any).brave !== 'undefined';
            if (isBrave) {
              throw new Error(
                'Registration failed (Brave Push Messaging Disabled). Brave blocks Google push messaging by default. To fix: Open brave://settings/privacy -> turn ON "Use Google services for push messaging" -> relaunch Brave and click Enable.'
              );
            }
            throw new Error(
              'Registration failed (push service unreachable). Your browser could not connect to Google Cloud Messaging (FCM). If using Brave, enable "Use Google services for push messaging" in brave://settings/privacy. If using a VPN, Pi-hole, or ad-blocker, verify mtalk.google.com and fcm.googleapis.com are not blocked.'
            );
          }
          throw retryErr;
        }
      }

      if (!subscription) {
        throw new Error('Failed to create browser push subscription.');
      }

      // Register subscription on backend
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save push subscription on server.');
      }

      setPushStatus('enabled');
      setStatusMessage({
        type: 'success',
        text: 'Browser Web Push notifications successfully enabled on this device! You can send a test notification below.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleResetPush = async () => {
    setIsPushLoading(true);
    setStatusMessage(null);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch {}
          await reg.unregister();
        }
      }
      setPushStatus('default');
      setStatusMessage({
        type: 'info',
        text: 'Service worker and push registrations cleared. Now click "Enable on this Device" to reconnect cleanly.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: `Reset failed: ${msg}` });
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    setStatusMessage(null);
    try {
      // 1. Ensure browser subscription exists and is synced to the server first
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            const vapidKey =
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
              'BJeWpGbW6kkqoVzplUPqE-4NClupkqYD0xM8v7V-pNo84btMzAllrq1r7uIttyv7p1O6ghne_eSCSHvMUu7Qsx8';
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
          }
          if (sub) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub }),
            });
            setPushStatus('enabled');
          }
          if (reg && reg.showNotification) {
            await reg.showNotification('🔔 PriceWatcher Notification Verified', {
              body: 'Instant push notifications are active on this device!',
              icon: '/icon-192.png',
              badge: '/badge-72.png',
            });
          }
        } catch (syncErr) {
          console.warn('Push sync before test notice:', syncErr);
        }
      }

      // 2. Trigger server test push
      let res = await fetch('/api/push/test', { method: 'POST' });
      let data = await res.json();

      // If server had 0 subscriptions, attempt re-register and retry once
      if (!res.ok || !data.success) {
        if (data.error && data.error.includes('No active push subscriptions found')) {
          await handleEnableWebPush();
          res = await fetch('/api/push/test', { method: 'POST' });
          data = await res.json();
        }
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Server test push failed');
        }
      }

      setStatusMessage({ type: 'success', text: data.message || 'Test push notification delivered!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: `Test push failed: ${msg}` });
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleTestChannel = async (channel: string, value: string, apikey?: string) => {
    setTestingChannel(channel);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, value, apikey }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test alert');
      }
      setStatusMessage({ type: 'success', text: data.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: `${channel.toUpperCase()} test failed: ${msg}` });
    } finally {
      setTestingChannel(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-champagne-faint font-mono">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <p className="text-xs">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-champagne font-normal tracking-tight">
          Alert &amp; Notification Settings
        </h1>
        <p className="text-xs text-champagne-faint mt-1 font-mono">
          Configure personal notifications across Telegram, WhatsApp, Email, and Browser Push
        </p>
      </div>

      {user?.isCombined && (
        <div className="p-4 rounded-sm bg-surface border border-gold/30 flex items-center gap-3 text-gold text-xs">
          <Crown className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <span className="font-semibold text-champagne">Special Combined Settings (Shared Space):</span>
            <p className="text-[11px] text-champagne-faint mt-0.5">
              These notification channels will alert connected accounts in this shared space when tracked items drop in price.
            </p>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-3.5 rounded-sm text-xs flex items-center gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-sage/10 border-sage/20 text-sage'
              : 'bg-terracotta/10 border-terracotta/20 text-terracotta'
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

      {/* Web Push Notification Banner & Diagnostic Box */}
      <div className="bg-surface border border-surface-border p-4 sm:p-5 rounded-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Smartphone className="w-4 h-4 text-gold flex-shrink-0" />
              <h3 className="text-sm font-medium text-champagne">Instant In-Browser Web Push</h3>
              {pushStatus === 'enabled' && (
                <span className="text-[10px] font-mono bg-sage/15 text-sage border border-sage/30 px-2 py-0.5 rounded-sm">
                  Active on this device
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Receive instant desktop and mobile notifications when price drops occur, even when the site is closed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {pushStatus === 'enabled' && (
              <button
                type="button"
                onClick={handleTestPush}
                disabled={isTestingPush}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                {isTestingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Send Test Push</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetPush}
              disabled={isPushLoading}
              title="Reset service worker & push cache"
              className="p-2.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleEnableWebPush}
              disabled={isPushLoading}
              title={pushStatus === 'enabled' ? 'Click to re-sync push registration with server' : 'Enable Web Push'}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap ${
                pushStatus === 'enabled'
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
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
              <span>{isPushLoading ? 'Syncing...' : pushStatus === 'enabled' ? '✓ Subscribed (Re-sync)' : 'Enable on this Device'}</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Guide for Push Service Errors / Brave Browser */}
        {statusMessage && statusMessage.type === 'error' && (statusMessage.text.includes('push service') || statusMessage.text.includes('Brave')) && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 text-xs text-sky-300 space-y-2.5">
            <div className="font-semibold flex items-center gap-1.5 text-sky-200">
              <Info className="w-4 h-4 flex-shrink-0 text-sky-400" />
              <span>How to Fix &quot;Registration failed - push service error&quot;:</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
              <p className="font-medium text-sky-200">1. If you are using Brave Browser:</p>
              <p className="pl-3 text-slate-300">
                Brave blocks Google FCM push by default. In Brave, go to <code className="bg-slate-950 px-1.5 py-0.5 rounded text-sky-300 border border-slate-800">brave://settings/privacy</code> → toggle ON <strong>&quot;Use Google services for push messaging&quot;</strong> → restart Brave.
              </p>
              <p className="font-medium text-sky-200">2. Ad-blockers or Network Restrictions:</p>
              <p className="pl-3 text-slate-300">
                Ensure your network or extension is not blocking <code className="bg-slate-950 px-1.5 py-0.5 rounded text-sky-300 border border-slate-800">mtalk.google.com</code> or <code className="bg-slate-950 px-1.5 py-0.5 rounded text-sky-300 border border-slate-800">fcm.googleapis.com</code>.
              </p>
              <p className="font-medium text-sky-200">3. Clear Stale Registration:</p>
              <p className="pl-3 text-slate-300">
                Click the reset icon (<RotateCcw className="w-3 h-3 inline text-slate-400" />) beside the button to clear cached browser push tokens, then click <em>Enable on this Device</em> again.
              </p>
            </div>
          </div>
        )}

        {/* Diagnostic Guide when Notification Permission is Blocked */}
        {pushStatus === 'blocked' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-amber-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Browser Notification Permission is Currently Blocked</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Your browser is blocking notification requests for this website. To allow push alerts:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-amber-200/80 space-y-1 pl-1">
              <li>Click the <strong>Site Settings</strong> or <strong>Padlock icon</strong> on the left side of the address bar.</li>
              <li>Change <strong>Notifications</strong> from <em>Block</em> to <em>Allow</em>.</li>
              <li>Reload this page and click <strong>Enable on this Device</strong> again.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Chrome Extension Companion Feature Card */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950/40 border border-emerald-500/20 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-slate-100">PriceWatcher Extension Companion</h3>
            <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-semibold">
              v1.1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Track products directly from Amazon, Flipkart, Myntra, Ajio, Meesho &amp; Westside with 1-click without copying URLs!
          </p>
          <p className="text-[11px] text-slate-500">
            Setup: Download ZIP &gt; Extract &gt; Open <code>chrome://extensions</code> &gt; Turn on Developer mode &gt; Load unpacked.
          </p>
        </div>

        <a
          href="/api/extension/download"
          download="PriceWatcher-Companion-Extension.zip"
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:border-emerald-500/50"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Download Extension (.zip)</span>
        </a>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Telegram Configuration */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200">1. Telegram Bot Alerts</h2>
                  <span className="text-[10px] bg-slate-800 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20">
                    100% Free • Unlimited
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Send <code>/start</code> to your bot to receive your Telegram Chat ID
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestChannel('telegram', settings.telegram_chat_id || '')}
              disabled={!settings.telegram_chat_id || testingChannel === 'telegram'}
              className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {testingChannel === 'telegram' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>Test Telegram</span>
            </button>
          </div>

          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Telegram Chat ID(s)
              </label>
              <span className="text-[10px] text-slate-500">
                Multi-account supported: separate multiple IDs with commas
              </span>
            </div>
            <input
              type="text"
              value={settings.telegram_chat_id || ''}
              onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              placeholder="e.g. 12345678, 87654321, -1001928374"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Discord Webhook Configuration (100% Free & Unlimited) */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200">2. Discord Webhooks (Free Alternative)</h2>
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    100% Free • Rich Embeds
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant alerts with product thumbnails and direct purchase buttons in your server or private channel
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestChannel('discord', settings.discord_webhook || '')}
              disabled={!settings.discord_webhook || testingChannel === 'discord'}
              className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {testingChannel === 'discord' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>Test Discord</span>
            </button>
          </div>

          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Discord Webhook URL(s)
              </label>
              <span className="text-[10px] text-slate-500">
                Multi-webhook supported: separate with commas or newlines
              </span>
            </div>
            <input
              type="text"
              value={settings.discord_webhook || ''}
              onChange={(e) => setSettings({ ...settings, discord_webhook: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-slate-500 mt-1.5">
              How to get: In Discord, go to Channel Settings &gt; Integrations &gt; Webhooks &gt; New Webhook &gt; Copy Webhook URL.
            </p>
          </div>
        </div>

        {/* ntfy.sh Push Configuration (100% Free, Zero Setup) */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200">3. ntfy.sh Mobile Push (Free Alternative)</h2>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Zero Setup • No Phone #
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant lock-screen push notifications to your phone via the free open-source ntfy app (iOS &amp; Android)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestChannel('ntfy', settings.ntfy_topic || '')}
              disabled={!settings.ntfy_topic || testingChannel === 'ntfy'}
              className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {testingChannel === 'ntfy' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>Test ntfy</span>
            </button>
          </div>

          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 mb-1">
              <label className="block text-xs font-medium text-slate-300">
                ntfy Topic Name(s)
              </label>
              <span className="text-[10px] text-slate-500">
                Multi-account: separate topics with commas
              </span>
            </div>
            <input
              type="text"
              value={settings.ntfy_topic || ''}
              onChange={(e) => setSettings({ ...settings, ntfy_topic: e.target.value })}
              placeholder="e.g. pw-deals-tracker992"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-slate-500 mt-1.5">
              How to use: Install the free <strong>ntfy</strong> app from Google Play or App Store &gt; Tap &quot;+&quot; &gt; Subscribe to this topic name.
            </p>
          </div>
        </div>

        {/* Free WhatsApp Configuration (CallMeBot) */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200">4. Free WhatsApp Alerts (CallMeBot Gateway)</h2>
                  <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    100% Free
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Send &quot;I allow callmebot to send me messages&quot; to <code>+34 911 06 14 91</code> on WhatsApp for your API key
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestChannel('whatsapp', settings.whatsapp_phone || '', settings.whatsapp_apikey || '')}
              disabled={!settings.whatsapp_phone || !settings.whatsapp_apikey || testingChannel === 'whatsapp'}
              className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {testingChannel === 'whatsapp' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>Test WhatsApp</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  WhatsApp Phone(s)
                </label>
                <span className="text-[10px] text-slate-500">Multi-number</span>
              </div>
              <input
                type="text"
                value={settings.whatsapp_phone || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_phone: e.target.value })}
                placeholder="+919876543210, +919123456789"
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
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-200">5. Email Alerts (Google Apps Script)</h2>
                  <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Free Gmail Relay
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sends price drop alerts directly to your inbox via Google Apps Script
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestChannel('email', settings.email || '')}
              disabled={!settings.email || testingChannel === 'email'}
              className="self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {testingChannel === 'email' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>Test Email</span>
            </button>
          </div>

          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Email Address(es)
              </label>
              <span className="text-[10px] text-slate-500">Multi-email supported: separate with commas</span>
            </div>
            <input
              type="text"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="alice@gmail.com, bob@gmail.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Notification Frequency Preference */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">6. Alert Trigger Preference</h2>
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
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">7. Bank Offer & Card Calculator</h2>
              <p className="text-[11px] text-slate-400">
                Select the bank cards you own to automatically calculate net payable prices on products
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5 pt-2">
            {['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'OneCard', 'Federal', 'Bank of Baroda'].map((bank) => {
              const active = settings.selected_bank_cards.includes(bank);
              return (
                <button
                  type="button"
                  key={bank}
                  onClick={() => handleToggleCard(bank)}
                  className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition-all ${
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
          className="w-full bg-gold hover:bg-gold-hover disabled:bg-surface-subtle disabled:text-champagne-faint text-obsidian font-semibold py-3 px-4 rounded-sm text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save All Settings</span>
        </button>
      </form>
    </div>
  );
}
