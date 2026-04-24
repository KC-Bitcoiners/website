/**
 * ZapModal — NIP-57 zap amount picker and payment flow.
 * Preset amounts, custom input, WebLN payment, and QR code fallback.
 */
import React, { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { useModal } from "@/hooks/useModal";
import { fetchZapInvoice, type SignerFn } from "@/utils/zaps";

const PRESETS = [100, 500, 1000, 5000];

type Step = "pick" | "loading" | "pay" | "success" | "error";

interface ZapModalProps {
  event: Record<string, unknown>;
  isOpen: boolean;
  onClose: () => void;
  signEvent: SignerFn;
  pubkey: string | null;
}

export default function ZapModal({
  event,
  isOpen,
  onClose,
  signEvent,
  pubkey,
}: ZapModalProps) {
  const [amount, setAmount] = useState(1000);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasWebln, setHasWebln] = useState(false);
  const [copied, setCopied] = useState(false);

  useModal(isOpen, onClose);

  // Detect WebLN availability
  useEffect(() => {
    setHasWebln(!!window.webln);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setAmount(1000);
      setCustomInput("");
      setIsCustom(false);
      setInvoice(null);
      setQrDataUrl(null);
      setErrorMsg("");
      setCopied(false);
    }
  }, [isOpen]);

  const activeAmount = isCustom ? parseInt(customInput, 10) || 0 : amount;

  const handleZap = useCallback(async () => {
    const millisats = activeAmount * 1000;
    if (millisats <= 0) {
      setErrorMsg("Enter a valid amount.");
      setStep("error");
      return;
    }

    setStep("loading");

    const result = await fetchZapInvoice({
      recipientPubkey: event.pubkey as string,
      eventId: event.id as string | undefined,
      millisats,
      signEvent,
    });

    if ("error" in result) {
      setErrorMsg(result.error);
      setStep("error");
      return;
    }

    const bolt11 = result.invoice;
    setInvoice(bolt11);

    // Try WebLN first
    if (window.webln) {
      try {
        await window.webln.enable();
        await window.webln.sendPayment(bolt11);
        setStep("success");
        setTimeout(onClose, 1500);
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
  }, [activeAmount, event, signEvent, onClose]);

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
        className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {step === "pick" && `Zap ${activeAmount} sats`}
            {step === "loading" && "Fetching invoice..."}
            {step === "pay" && `Pay ${activeAmount} sats`}
            {step === "success" && "Zap sent!"}
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
            {!pubkey && (
              <p className="text-sm text-yellow-700 mb-4">
                You need to log in to send zaps.
              </p>
            )}
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
              disabled={!pubkey || activeAmount <= 0}
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
            <p className="text-sm text-gray-600 mb-3">
              Scan with your Lightning wallet
            </p>
            <button
              onClick={handleCopyInvoice}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              {copied ? "Copied!" : "Copy Invoice"}
            </button>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center py-6">
            <div className="text-4xl mb-2">&#x26A1;</div>
            <p className="text-gray-700 font-medium">Zap sent!</p>
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
