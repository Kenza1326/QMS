import React, {useState} from 'react';
import { RealQrCameraScanner } from '../common/RealQrCameraScanner';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (detectedCode?: string) => Promise<boolean> | boolean;
  ticketNumber?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ticketNumber,
}) => {
  const [attempt,setAttempt]=useState(0);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm">
        <RealQrCameraScanner
          key={attempt}
          title="Validation en agence"
          subtitle={
            ticketNumber
              ? `Visez le QR Code affiché sur la borne tactile d'accueil pour valider le ticket ${ticketNumber}.`
              : "Visez le QR Code affiché sur la borne tactile d'accueil pour valider votre présence."
          }
          preferredFacingMode="environment"
          onScan={async (code) => {
            if(await onSuccess(code)) onClose();
            else setAttempt((value)=>value+1);
          }}
          onClose={onClose}
          showCloseButton={true}
          allowFileUpload={true}
        />
      </div>
    </div>
  );
};
