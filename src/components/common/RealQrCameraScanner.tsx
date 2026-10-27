import {notifications} from '../../services/notificationService';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, X, CheckCircle2, Upload, AlertCircle, Sparkles, Lock } from 'lucide-react';
import jsQR from 'jsqr';
import { audioService } from '../../services/audioService';

export interface RealQrCameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  preferredFacingMode?: 'user' | 'environment';
  showCloseButton?: boolean;
  allowFileUpload?: boolean;
}

export const RealQrCameraScanner: React.FC<RealQrCameraScannerProps> = ({
  onScan,
  onClose,
  title = 'Scanner de QR Code',
  subtitle = 'Présentez le QR Code de votre ticket ou réservation devant la caméra',
  preferredFacingMode = 'environment',
  showCloseButton = true,
  allowFileUpload = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isHandlingScanRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(preferredFacingMode);
  const [cameraState, setCameraState] = useState<'loading' | 'active' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decodedPayload, setDecodedPayload] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Handle successful detection
  const handleSuccess = useCallback(
    (codeText: string) => {
      if (isHandlingScanRef.current) return;
      isHandlingScanRef.current = true;

      setDecodedPayload(codeText);
      setCameraState('success');

      // Audio feedback & haptic vibration
      try {
        audioService.playChime(1.0);
      } catch (e) {}

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (e) {}
      }

      stopStream();

      // Dispatch after a brief celebration animation
      setTimeout(() => {
        onScan(codeText);
      }, 700);
    },
    [onScan, stopStream]
  );

  // Scan frame processing loop
  const scanLoop = useCallback(() => {
    if (isHandlingScanRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Try native BarcodeDetector if available in Chromium
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            detector
              .detect(canvas)
              .then((barcodes: any[]) => {
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleSuccess(barcodes[0].rawValue);
                  return;
                }
              })
              .catch(() => {});
          } catch (e) {}
        }

        // Fast JS QR engine detection
        try {
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (qrCode && qrCode.data && qrCode.data.trim()) {
            handleSuccess(qrCode.data.trim());
            return;
          }
        } catch (e) {
          // Frame decode error, continue loop
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [handleSuccess]);

  // Start video stream from user's camera
  const startCamera = useCallback(async () => {
    stopStream();
    isHandlingScanRef.current = false;
    setCameraState('loading');
    setErrorMessage(null);

    const isNonSecure =
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.protocol === 'http:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      if (isNonSecure) {
        setErrorMessage(
          "Chrome et Safari bloquent la caméra directe en HTTP sur mobile (192.168.0.111). Ouvrez en HTTPS ou utilisez le bouton photo ci-dessous."
        );
      } else {
        setErrorMessage("La caméra n'est pas accessible sur cet appareil ou ce navigateur.");
      }
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraState('active');
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      setCameraState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage("Permission caméra refusée. Veuillez autoriser l'accès à la caméra.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage("Aucune caméra physique détectée sur cet appareil.");
      } else {
        setErrorMessage(`Erreur caméra : ${err.message || 'Impossible de démarrer la vidéo'}`);
      }
    }
  }, [facingMode, scanLoop, stopStream]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrCode && qrCode.data) {
            handleSuccess(qrCode.data.trim());
          } else {
            notifications.error("Aucun QR Code valide n'a été détecté dans cette photo. Veuillez vous rapprocher et reprendre une photo nette.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  return (
    <div className="relative flex flex-col items-center w-full max-w-md mx-auto bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-700 text-white select-none">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden image file input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="w-full px-5 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-black text-white leading-tight">{title}</h4>
            <span className="text-[10px] text-slate-400 font-medium">Caméra active en direct</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Flip camera button */}
          <button
            type="button"
            onClick={toggleFacingMode}
            title="Changer de caméra"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Close button */}
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              title="Fermer"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport: Live Video / Target Reticle */}
      <div className="relative w-full aspect-square max-h-[340px] bg-black overflow-hidden flex items-center justify-center">
        {/* Actual Video Element */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === 'active' || cameraState === 'success' ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          playsInline
        />

        {/* Loading Spinner */}
        {cameraState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center z-10">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-300">Initialisation de la caméra...</p>
            <p className="text-[11px] text-slate-500">Veuillez autoriser l'accès à la caméra de l'appareil</p>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center z-10 overflow-y-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
              <CameraOff className="w-6 h-6" />
            </div>
            <p className="text-xs font-black text-rose-300 max-w-xs">{errorMessage}</p>

            <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
              {/* Option 1: Native Camera Photo (Opens phone camera directly, 100% works on HTTP & HTTPS) */}
              {allowFileUpload && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white text-xs font-black shadow-lg transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>Prendre en photo le QR Code</span>
                </button>
              )}

              {/* Option 2: Switch to HTTPS if on HTTP */}
              {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = window.location.href.replace('http:', 'https:');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow"
                >
                  <Lock className="w-3.5 h-3.5 text-white" />
                  <span>Basculer en HTTPS (Flux vidéo direct)</span>
                </button>
              )}

              {/* Option 3: Retry camera */}
              <button
                type="button"
                onClick={startCamera}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer la caméra</span>
              </button>
            </div>
          </div>
        )}

        {/* Success Detection Overlay */}
        {cameraState === 'success' && (
          <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200 z-30">
            <div className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-xl animate-bounce mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-white">QR Code Détecté !</h3>
            <p className="text-xs font-mono font-bold text-emerald-100 mt-1 max-w-xs truncate bg-emerald-800/60 px-3 py-1 rounded-full border border-emerald-400/40">
              {decodedPayload}
            </p>
            <span className="text-[11px] font-medium text-emerald-200 mt-2">Validation en cours...</span>
          </div>
        )}

        {/* Target Reticle (HUD Corners & Laser) */}
        {cameraState === 'active' && (
          <div className="absolute inset-8 border border-white/20 rounded-3xl pointer-events-none z-10 flex flex-col justify-between">
            {/* 4 Corner Markers */}
            <div className="flex justify-between">
              <div className="w-8 h-8 border-t-4 border-l-4 border-[#0055D4] -mt-1 -ml-1 rounded-tl-xl shadow-sm" />
              <div className="w-8 h-8 border-t-4 border-r-4 border-[#0055D4] -mt-1 -mr-1 rounded-tr-xl shadow-sm" />
            </div>

            {/* Glowing Laser Scan Bar */}
            <div className="relative w-full">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#FFB800] to-transparent shadow-[0_0_15px_#FFB800] animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>

            <div className="flex justify-between">
              <div className="w-8 h-8 border-b-4 border-l-4 border-[#0055D4] -mb-1 -ml-1 rounded-bl-xl shadow-sm" />
              <div className="w-8 h-8 border-b-4 border-r-4 border-[#0055D4] -mb-1 -mr-1 rounded-br-xl shadow-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Information & Controls */}
      <div className="w-full p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col items-center gap-3 z-20">
        <p className="text-xs text-center text-slate-300 font-medium leading-relaxed max-w-xs">
          {subtitle}
        </p>

        {/* Quick fallback actions */}
        <div className="w-full flex items-center gap-2 pt-1 border-t border-slate-800/80">
          {allowFileUpload && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>Prendre Photo</span>
            </button>
          )}

          <div className="flex-1 flex gap-1">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Code (ex: P-001)"
              className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
            />
            <button
              type="button"
              onClick={() => {
                if (manualCode.trim()) {
                  handleSuccess(manualCode.trim());
                }
              }}
              disabled={!manualCode.trim()}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
