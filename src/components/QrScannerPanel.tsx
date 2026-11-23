import jsQR from 'jsqr';
import { Camera, ImageUp, StopCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface QrScannerPanelProps {
  onDecoded: (certificateId: string) => void;
}

export function extractCertificateIdFromQrText(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const verifyIdx = segments.findIndex((s) => s.toLowerCase() === 'verify');
    if (verifyIdx !== -1 && segments[verifyIdx + 1]) {
      return decodeURIComponent(segments[verifyIdx + 1]);
    }
    const last = segments[segments.length - 1];
    if (last && /^[A-Za-z0-9_-]{4,64}$/.test(last)) {
      return decodeURIComponent(last);
    }
  } catch {
    // Not a full URL; check if path or raw ID
  }

  const pathMatch = trimmed.match(/\/verify\/([A-Za-z0-9_-]{4,64})/i);
  if (pathMatch?.[1]) return pathMatch[1];

  if (/^[A-Za-z0-9_-]{4,64}$/.test(trimmed)) return trimmed;
  return null;
}

export function QrScannerPanel({ onDecoded }: QrScannerPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const certId = extractCertificateIdFromQrText(code.data);
          if (certId) {
            stopCamera();
            setStatusNote(`Decoded Certificate ID: ${certId}`);
            onDecoded(certId);
            return;
          } else {
            setErrorMsg('QR code detected, but it does not contain a valid CertiTrust verification URL.');
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [onDecoded, stopCamera]);

  const startCamera = async () => {
    setErrorMsg(null);
    setStatusNote(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera access is not supported in this browser. Upload a QR image instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setErrorMsg(
        'Camera permission denied or no camera detected. You can upload a QR code PNG/JPG screenshot below.',
      );
      stopCamera();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setStatusNote(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setErrorMsg('Unable to read image context.');
        URL.revokeObjectURL(objectUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      URL.revokeObjectURL(objectUrl);

      if (!code?.data) {
        setErrorMsg('No readable QR code was found in that image. Try a clearer crop of the QR code.');
        return;
      }

      const certId = extractCertificateIdFromQrText(code.data);
      if (!certId) {
        setErrorMsg(`QR code scanned ("${code.data}"), but it is not a CertiTrust credential link.`);
        return;
      }
      setStatusNote(`QR decoded successfully: ${certId}`);
      onDecoded(certId);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg('Unable to load the selected image file.');
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!cameraActive ? (
          <button
            type="button"
            onClick={startCamera}
            className="flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800 transition-colors"
          >
            <Camera className="h-4 w-4" />
            <span>Start Camera Scanner</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <StopCircle className="h-4 w-4" />
            <span>Stop Camera</span>
          </button>
        )}

        <label className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
          <ImageUp className="h-4 w-4 text-teal-600" />
          <span>Upload QR Image</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageUpload}
            className="sr-only"
          />
        </label>
      </div>

      {cameraActive && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 aspect-video max-h-72 mx-auto">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-44 h-44 border-2 border-teal-400 rounded-lg shadow-inner" />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {statusNote && (
        <p className="text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5">
          {statusNote}
        </p>
      )}
      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
