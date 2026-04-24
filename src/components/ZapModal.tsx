/**
 * ZapModal — NIP-57 zap amount picker and payment flow.
 * Preset amounts, custom input, WebLN payment, QR code fallback,
 * and relay-based payment confirmation via kind 9735 zap receipts.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { useModal } from "@/hooks/useModal";
import { fetchZapInvoice, getUserRelays, type SignerFn } from "@/utils/zaps";
import { generateKeyPair } from "@/utils/bech32";
import { pool } from "@/lib/nostr";
import { nostrRelays } from "@/config";

const PRESETS = [21, 69, 420, 3333];

type Step = "pick" | "loading" | "pay" | "confirming" | "success" | "error";

interface ZapModalProps {
  event: Record<string, unknown>;
  isOpen: boolean;
  onClose: () => void;
  signEvent?: SignerFn;
  pubkey: string | null;
  onZapConfirmed?: () => void;
}

export default function ZapModal({
  event,
  isOpen,
  onClose,
  signEvent,
  pubkey,
  onZapConfirmed,
}: ZapModalProps) {
  const [amount, setAmount] = useState(21);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasWebln, setHasWebln] = useState(false);
  const [copied, setCopied] = useState(false);
  // The signed kind 9734 zap request event (shown for anonymous zaps)
  const [signedZapRequest, setSignedZapRequest] = useState<Record<string, unknown> | null>(null);
  // Track whether the logged-in user is anonymous
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Ref to cancel the zap receipt subscription
  const zapSubRef = useRef<{ unsubscribe: () => void } | null>(null);

  useModal(isOpen, onClose);

  // Detect WebLN availability
  useEffect(() => {
    setHasWebln(!!window.webln);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setAmount(21);
      setCustomInput("");
      setIsCustom(false);
      setInvoice(null);
      setQrDataUrl(null);
      setErrorMsg("");
      setCopied(false);
      setSignedZapRequest(null);
      setIsAnonymous(false);
    }
  }, [isOpen]);

  // Clean up zap receipt subscription on unmount or close
  useEffect(() => {
    return () => {
      if (zapSubRef.current) {
        zapSubRef.current.unsubscribe();
        zapSubRef.current = null;
      }
    };
  }, [isOpen]);

  const activeAmount = isCustom ? parseInt(customInput, 10) || 0 : amount;
  const eventId = event.id as string | undefined;

  /**
   * Open a live subscription for kind 9735 zap receipts matching our invoice.
   * Uses pool.subscription (stays open) instead of pool.request (one-shot).
   * Matches by exact bolt11 invoice to avoid false positives from old zaps.
   */
  const watchForZapReceipt = useCallback(async (millisats: number, bolt11: string) => {
    if (!eventId) return;

    // Clean up any existing subscription
    if (zapSubRef.current) {
      zapSubRef.current.unsubscribe();
    }

    // Query the event author's NIP-65 relay list for broader coverage
    const authorPubkey = event.pubkey as string | undefined;
    const relays = authorPubkey ? await getUserRelays(authorPubkey) : nostrRelays;

    const sub = pool
      .subscription(relays, {
        kinds: [9735],
        "#e": [eventId],
        limit: 100,
      })
      .subscribe({
        next: (receipt: any) => {
          // Match by exact bolt11 invoice — ignores old receipts with different invoices
          const bolt11Tag = receipt.tags?.find((t: string[]) => t[0] === "bolt11");
          if (bolt11Tag?.[1] === bolt11) {
            setStep("success");
            sub.unsubscribe();
            zapSubRef.current = null;
            onZapConfirmed?.();
          }
        },
        error: () => {},
        complete: () => {},
      });

    zapSubRef.current = sub;

    // Timeout after 3 minutes — stop watching
    setTimeout(() => {
      sub.unsubscribe();
      if (zapSubRef.current === sub) {
        zapSubRef.current = null;
      }
    }, 180_000);
  }, [eventId]);

  // Get a signer — use the provided one when logged in, else generate a throwaway key
  const getSigner = useCallback(async (): Promise<{ signer: SignerFn; anonymous: boolean }> => {
    if (signEvent && pubkey) return { signer: signEvent, anonymous: false };
    // Generate a throwaway keypair for anonymous zaps
    const { privkeyHex } = await generateKeyPair();
    const schnorr = (await import("@noble/curves/secp256k1.js")).schnorr;
    // hex → Uint8Array
    const privBytes = new Uint8Array(privkeyHex.length / 2);
    for (let i = 0; i < privkeyHex.length; i += 2) {
      privBytes[i / 2] = parseInt(privkeyHex.substring(i, i + 2), 16);
    }
    const anonSigner: SignerFn = async (evt) => {
      const serialized = JSON.stringify([0, evt.kind, evt.tags, evt.content]);
      const msgBytes = new TextEncoder().encode(serialized);
      const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", msgBytes));
      const sig = schnorr.sign(hashBytes, privBytes);
      const pubKey = schnorr.getPublicKey(privBytes);
      const idHash = new Uint8Array(await crypto.subtle.digest("SHA-256", msgBytes));
      const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
      return {
        ...evt,
        id: toHex(idHash),
        pubkey: toHex(pubKey),
        sig: toHex(sig),
      };
    };
    return { signer: anonSigner, anonymous: true };
  }, [signEvent]);

  const handleZap = useCallback(async () => {
    const millisats = activeAmount * 1000;
    if (millisats <= 0) {
      setErrorMsg("Enter a valid amount.");
      setStep("error");
      return;
    }

    setStep("loading");

    const { signer, anonymous } = await getSigner();
    setIsAnonymous(anonymous);

    const result = await fetchZapInvoice({
      recipientPubkey: event.pubkey as string,
      eventId: event.id as string | undefined,
      millisats,
      signEvent: signer,
    });

    if ("error" in result) {
      setErrorMsg(result.error);
      setStep("error");
      return;
    }

    // Capture the signed zap request for debugging display
    if (result.signedRequest) {
      setSignedZapRequest(result.signedRequest);
    }

    const bolt11 = result.invoice;
    setInvoice(bolt11);

    // Start watching for zap receipt (kind 9735) on relays
    watchForZapReceipt(millisats, bolt11);

    // Try WebLN first
    if (window.webln) {
      try {
        await window.webln.enable();
        await window.webln.sendPayment(bolt11);
        setStep("success");
        onZapConfirmed?.();
        return;
      } catch {
        // WebLN failed or cancelled — fall through to QR
      }
    }

    // QR code fallback
    try {
      const url = await QRCode.toDataURL(bolt11, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch {
      // QR generation failed — still show invoice text
    }
    setStep("pay");
  }, [activeAmount, event, getSigner, watchForZapReceipt]);

  const handleCopyInvoice = useCallback(async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [invoice]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {step === "pick" && `Zap ${activeAmount} sats`}
            {step === "loading" && "Fetching invoice..."}
            {step === "pay" && `Pay ${activeAmount} sats`}
            {step === "confirming" && "Confirming zap..."}
            {step === "success" && "Zap confirmed!"}
            {step === "error" && "Zap failed"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: Pick amount */}
        {step === "pick" && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setAmount(preset);
                    setIsCustom(false);
                  }}
                  className={`py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                    !isCustom && amount === preset
                      ? "bg-bitcoin-orange text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-6">
              <input
                type="number"
                placeholder="Custom"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setIsCustom(true);
                }}
                onFocus={() => setIsCustom(true)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="1"
              />
              <span className="text-sm text-gray-500">sats</span>
            </div>
            <button
              onClick={handleZap}
              disabled={activeAmount <= 0}
              className="w-full py-2.5 bg-bitcoin-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold transition-colors"
            >
              Zap {activeAmount} sats
            </button>
          </>
        )}

        {/* Step: Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin-orange mb-4" />
            <p className="text-gray-600">Fetching invoice...</p>
          </div>
        )}

        {/* Step: Pay (QR code fallback) */}
        {step === "pay" && (
          <div className="flex flex-col items-center">
            {qrDataUrl && (
              <div className="p-2 bg-white border border-gray-200 rounded-lg mb-4">
                <img src={qrDataUrl} alt="Lightning invoice QR code" className="w-64 h-64" />
              </div>
            )}
            <p className="text-sm text-gray-600 mb-1">
              Scan with your Lightning wallet
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Watching relays for payment confirmation...
            </p>
            <button
              onClick={handleCopyInvoice}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors mb-4"
            >
              {copied ? "Copied!" : "Copy Invoice"}
            </button>

            {/* Anonymous zap: show signed kind 9734 zap request for debugging */}
            {isAnonymous && signedZapRequest && (
              <details className="w-full">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
                  Debug: signed zap request (kind 9734)
                </summary>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all max-h-48 border border-gray-200">
                  {JSON.stringify(signedZapRequest, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center py-6">
            <div className="text-4xl mb-2">&#x26A1;</div>
            <p className="text-gray-700 font-medium mb-1">Zap confirmed!</p>
            <p className="text-xs text-gray-400">Payment verified on relays</p>

            {/* Anonymous zap: show signed zap request on success too */}
            {isAnonymous && signedZapRequest && (
              <details className="w-full mt-4">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
                  Debug: signed zap request (kind 9734)
                </summary>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all max-h-48 border border-gray-200">
                  {JSON.stringify(signedZapRequest, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="py-4">
            <p className="text-sm text-red-700 mb-4">{errorMsg}</p>
            <button
              onClick={onClose}
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
