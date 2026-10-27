import {notifications} from '../../services/notificationService';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Camera,
  Upload,
  Scan,
  User,
  MapPin,
  Calendar,
  Briefcase,
  Phone,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Edit3,
  Eye,
  X,
  ChevronRight,
  ArrowRight,
  Lock,
  FileCheck2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QueueTicket, KycDossier, KycDocument, KycFormData } from '../../types/queueTypes';
import { queueStore } from '../../services/queueStore';

interface ActiveWaitKycModuleProps {
  ticket: QueueTicket;
  primaryColor?: string;
  onDossierUpdated?: (updatedTicket: QueueTicket) => void;
}

// Realistic sample Algerian KYC documents for instant demo
const DEMO_SAMPLES = {
  idRecto: {
    name: 'CNI_Biometrique_Recto.jpg',
    previewUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="%23f8fafc"><rect width="400" height="250" rx="16" fill="%230F172A"/><rect x="10" y="10" width="380" height="230" rx="12" fill="%231E293B" stroke="%2338BDF8" stroke-width="2"/><text x="30" y="38" fill="%2338BDF8" font-family="sans-serif" font-weight="bold" font-size="11" letter-spacing="1">RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE</text><text x="30" y="54" fill="%2394A3B8" font-family="sans-serif" font-size="9">CARTE NATIONALE D\'IDENTITÉ BIOMÉTRIQUE</text><rect x="30" y="70" width="75" height="95" rx="8" fill="%23334155"/><circle cx="67" cy="105" r="22" fill="%2364748B"/><path d="M42 155 Q67 135 92 155 Z" fill="%2364748B"/><text x="120" y="88" fill="%2394A3B8" font-size="9" font-family="sans-serif">NOM / LAST NAME</text><text x="120" y="104" fill="%23FFFFFF" font-size="13" font-family="sans-serif" font-weight="bold">BENAISSA</text><text x="120" y="122" fill="%2394A3B8" font-size="9" font-family="sans-serif">PRÉNOM / FIRST NAME</text><text x="120" y="138" fill="%23FFFFFF" font-size="13" font-family="sans-serif" font-weight="bold">Karim</text><text x="120" y="156" fill="%2394A3B8" font-size="9" font-family="sans-serif">NIN (18 chiffres)</text><text x="120" y="172" fill="%2338BDF8" font-size="12" font-family="monospace" font-weight="bold">198816010045230012</text><rect x="30" y="185" width="340" height="40" rx="6" fill="%230F172A"/><text x="40" y="202" fill="%2338BDF8" font-family="monospace" font-size="10">IDDZA198816010045230012&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text><text x="40" y="217" fill="%2338BDF8" font-family="monospace" font-size="10">8804152M3008125DZA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8</text></svg>',
  },
  idVerso: {
    name: 'CNI_Biometrique_Verso.jpg',
    previewUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="%23f8fafc"><rect width="400" height="250" rx="16" fill="%230F172A"/><rect x="10" y="10" width="380" height="230" rx="12" fill="%231E293B" stroke="%2338BDF8" stroke-width="2"/><text x="30" y="38" fill="%2338BDF8" font-family="sans-serif" font-weight="bold" font-size="10">RÉPUBLIQUE ALGÉRIENNE - VERSO CNI</text><rect x="30" y="55" width="55" height="45" rx="6" fill="%23C99700"/><rect x="35" y="62" width="45" height="30" rx="3" fill="%23E2E8F0" opacity="0.3"/><text x="100" y="70" fill="%2394A3B8" font-size="9" font-family="sans-serif">ADRESSE DE RÉSIDENCE</text><text x="100" y="86" fill="%23FFFFFF" font-size="11" font-family="sans-serif" font-weight="bold">24 Boulevard Zighout Youcef</text><text x="100" y="100" fill="%2338BDF8" font-size="10" font-family="sans-serif">Alger-Centre (16000), Alger</text><text x="30" y="130" fill="%2394A3B8" font-size="9" font-family="sans-serif">DATE D\'EXPIRATION</text><text x="30" y="145" fill="%23FFFFFF" font-size="11" font-family="monospace" font-weight="bold">12/08/2030</text><text x="180" y="130" fill="%2394A3B8" font-size="9" font-family="sans-serif">COMMUNE DE DÉLIVRANCE</text><text x="180" y="145" fill="%23FFFFFF" font-size="11" font-family="sans-serif">APC Alger Sidi M\'Hamed</text><rect x="30" y="170" width="340" height="55" rx="6" fill="%230F172A"/><text x="40" y="195" fill="%2338BDF8" font-family="monospace" font-size="10">&lt;&lt; B10293847 &lt;&lt; 16000 &lt;&lt; ALGER &lt;&lt;&lt;&lt;&lt;&lt;</text><text x="40" y="212" fill="%2338BDF8" font-family="monospace" font-size="10">BENAISSA&lt;&lt;KARIM&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text></svg>',
  },
  residence: {
    name: 'Certificat_Residence_APC.pdf',
    previewUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="%23ffffff"><rect width="400" height="250" rx="16" fill="%23FFFFFF" stroke="%23CBD5E1" stroke-width="2"/><rect x="15" y="15" width="370" height="220" rx="10" fill="%23F8FAFC" stroke="%23E2E8F0"/><text x="200" y="42" text-anchor="middle" fill="%230F172A" font-family="sans-serif" font-weight="bold" font-size="12">CERTIFICAT DE RÉSIDENCE - APC</text><text x="200" y="58" text-anchor="middle" fill="%2364748B" font-family="sans-serif" font-size="9">WILAYA D\'ALGER • COMMUNE D\'ALGER-CENTRE</text><line x1="40" y1="70" x2="360" y2="70" stroke="%23CBD5E1" stroke-width="1"/><text x="40" y="95" fill="%23475569" font-size="10" font-family="sans-serif">Le Président de l\'APC certifie que le citoyen :</text><text x="40" y="115" fill="%230F172A" font-size="12" font-family="sans-serif" font-weight="bold">M. BENAISSA Karim</text><text x="40" y="135" fill="%23475569" font-size="10" font-family="sans-serif">Demeure actuellement à l\'adresse suivante :</text><text x="40" y="152" fill="%230F172A" font-size="11" font-family="sans-serif" font-weight="bold">24 Boulevard Zighout Youcef, Alger-Centre</text><rect x="260" y="165" width="100" height="50" rx="6" fill="%23E2E8F0" stroke="%230284C7" stroke-width="1" stroke-dasharray="3,3"/><text x="310" y="193" text-anchor="middle" fill="%230284C7" font-size="9" font-family="sans-serif" font-weight="bold">[Sceau APC Officiel]</text></svg>',
  },
};

const DEFAULT_EXTRACTED_FORM: KycFormData = {
  fullName: 'Karim Benaissa',
  nin: '198816010045230012',
  documentNumber: 'CNI-20491823',
  dateOfBirth: '1988-04-15',
  placeOfBirth: 'Alger Sidi M\'Hamed (16)',
  expiryDate: '2030-08-12',
  address: '24 Boulevard Zighout Youcef',
  commune: 'Alger-Centre',
  wilaya: '16 - Alger',
  phoneNumber: '0550 12 34 56',
  email: 'karim.benaissa@email.dz',
  occupation: 'Cadre administratif',
  monthlyIncome: '80 000 - 120 000 DZD',
};

export const ActiveWaitKycModule: React.FC<ActiveWaitKycModuleProps> = ({
  ticket,
  primaryColor = '#0055D4',
  onDossierUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Documents Scanner, 2: e-Form Validation
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState<KycDocument | null>(null);

  // Initial state derived from ticket
  const initialDossier: KycDossier = ticket.kycDossier || {
    status: 'not_started',
    documents: {},
    formData: {
      ...DEFAULT_EXTRACTED_FORM,
      fullName: ticket.customerName || DEFAULT_EXTRACTED_FORM.fullName,
      phoneNumber: ticket.customerPhone || DEFAULT_EXTRACTED_FORM.phoneNumber,
    },
  };

  const [dossier, setDossier] = useState<KycDossier>(initialDossier);

  useEffect(() => {
    if (ticket.kycDossier) {
      setDossier(ticket.kycDossier);
    }
  }, [ticket.kycDossier]);

  const docsCount = [
    dossier.documents.idRecto,
    dossier.documents.idVerso,
    dossier.documents.residence,
  ].filter(Boolean).length;

  const isComplete = dossier.status === 'completed';

  // Handle uploading real file or demo file
  const handleAttachDocument = async (
    type: 'id_recto' | 'id_verso' | 'residence',
    name: string,
    dataUrl: string
  ) => {
    try {
    const doc: KycDocument = {
      id: `doc-${Date.now()}-${type}`,
      type,
      name,
      previewUrl: dataUrl,
      uploadedAt: new Date().toISOString(),
      verified: true,
    };

    const newDocs = {
      ...dossier.documents,
      [type === 'id_recto' ? 'idRecto' : type === 'id_verso' ? 'idVerso' : 'residence']: doc,
    };

    const updatedDossier: KycDossier = {
      ...dossier,
      status: 'in_progress',
      documents: newDocs,
    };

    await queueStore.updateTicketKycDossier(ticket.id, updatedDossier);
    setDossier(updatedDossier);
    if (onDossierUpdated) {
      const refreshed = queueStore.getState().tickets.find((t) => t.id === ticket.id);
      if (refreshed) onDossierUpdated(refreshed);
    }
    } catch(error){notifications.error(error instanceof Error?error.message:'Dossier non enregistré.');}
  };

  // Instant full demo scan (simulates OCR in 1s)
  const handleSimulateAllAndExtract = () => {
    setIsOcrProcessing(true);
    setTimeout(async () => {
      try {
      const newDocs = {
        idRecto: {
          id: `doc-${Date.now()}-recto`,
          type: 'id_recto' as const,
          name: DEMO_SAMPLES.idRecto.name,
          previewUrl: DEMO_SAMPLES.idRecto.previewUrl,
          uploadedAt: new Date().toISOString(),
          verified: true,
        },
        idVerso: {
          id: `doc-${Date.now()}-verso`,
          type: 'id_verso' as const,
          name: DEMO_SAMPLES.idVerso.name,
          previewUrl: DEMO_SAMPLES.idVerso.previewUrl,
          uploadedAt: new Date().toISOString(),
          verified: true,
        },
        residence: {
          id: `doc-${Date.now()}-residence`,
          type: 'residence' as const,
          name: DEMO_SAMPLES.residence.name,
          previewUrl: DEMO_SAMPLES.residence.previewUrl,
          uploadedAt: new Date().toISOString(),
          verified: true,
        },
      };

      const updated: KycDossier = {
        status: 'in_progress',
        documents: newDocs,
        formData: {
          ...DEFAULT_EXTRACTED_FORM,
          fullName: ticket.customerName && ticket.customerName !== 'Visiteur' ? ticket.customerName : DEFAULT_EXTRACTED_FORM.fullName,
          phoneNumber: ticket.customerPhone || DEFAULT_EXTRACTED_FORM.phoneNumber,
        },
      };

      await queueStore.updateTicketKycDossier(ticket.id, updated);
      setDossier(updated);
      setIsOcrProcessing(false);
      setStep(2); // advance to review pre-filled form
      } catch(error){notifications.error(error instanceof Error?error.message:'Dossier non enregistré.');} finally {setIsOcrProcessing(false);}
    }, 900);
  };

  // File upload input handler
  const onFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'id_recto' | 'id_verso' | 'residence'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleAttachDocument(type, file.name, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Form field update
  const handleFormFieldChange = (field: keyof KycFormData, val: string) => {
    setDossier((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        [field]: val,
      },
    }));
  };

  // Submit and finalize KYC dossier
  const handleFinalSubmit = async () => {
    try {
    const finalized: KycDossier = {
      ...dossier,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    const updated = await queueStore.updateTicketKycDossier(ticket.id, finalized);
    setDossier(finalized);
    if (updated && onDossierUpdated) {
      onDossierUpdated(updated);
    }

    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    setIsOpen(false);
    } catch(error){notifications.error(error instanceof Error?error.message:'Dossier non enregistré.');}
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. COMPACT ATTENTE ACTIVE CARD IN CLIENT TICKET VIEW */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-3xl p-5 border-2 border-blue-200/80 shadow-md relative overflow-hidden transition-all">
        {/* Top Glow bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: isComplete ? '#10B981' : primaryColor }}
        />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isComplete ? <ShieldCheck className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                ⚡ Attente Active • Entrée en relation
              </span>
              <h4 className="text-sm font-black text-slate-900 leading-tight">
                {isComplete
                  ? 'Dossier KYC Pré-rempli & Validé !'
                  : 'Préparez votre entrée en relation au guichet'}
              </h4>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
              isComplete
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : docsCount > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {isComplete ? '✓ Prêt (3/3)' : `${docsCount}/3 pièces`}
          </span>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          {isComplete
            ? 'Vos pièces et vos informations KYC sont enregistrées. Votre conseiller bancaire y aura directement accès dès votre appel !'
            : 'Profitez de votre temps d\'attente pour numériser votre pièce d\'identité (recto/verso) et votre justificatif de résidence. Gagnez jusqu\'à 15 minutes au guichet !'}
        </p>

        {/* 3 Checklist Badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div
            className={`p-2.5 rounded-2xl border text-center transition-all ${
              dossier.documents.idRecto
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] font-black">
              {dossier.documents.idRecto ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Scan className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>CNI Recto</span>
            </div>
          </div>

          <div
            className={`p-2.5 rounded-2xl border text-center transition-all ${
              dossier.documents.idVerso
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] font-black">
              {dossier.documents.idVerso ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Scan className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>CNI Verso</span>
            </div>
          </div>

          <div
            className={`p-2.5 rounded-2xl border text-center transition-all ${
              dossier.documents.residence
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] font-black">
              {dossier.documents.residence ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Scan className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Résidence</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => {
            setStep(isComplete ? 2 : docsCount === 3 ? 2 : 1);
            setIsOpen(true);
          }}
          className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
          style={{ backgroundColor: isComplete ? '#059669' : primaryColor }}
        >
          {isComplete ? (
            <>
              <Edit3 className="w-4 h-4" />
              <span>Consulter / Modifier mon e-Formulaire KYC</span>
            </>
          ) : docsCount > 0 ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Continuer la numérisation & validation KYC →</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Numériser mes pièces & Pré-remplir mon KYC (Gagner 15 min)</span>
            </>
          )}
        </button>
      </div>

      {/* ============================================================ */}
      {/* 2. FULL INTERACTIVE MODAL WIZARD: SCAN DOCUMENTS + E-FORM */}
      {/* ============================================================ */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                  {step === 1 ? '1/2' : '2/2'}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {step === 1
                      ? 'Étape 1 : Numérisation des documents'
                      : 'Étape 2 : e-Formulaire KYC Pré-rempli'}
                  </h3>
                  <span className="text-[11px] text-slate-500 block">
                    {step === 1
                      ? 'Scannez CNI (Recto/Verso) et Certificat de résidence'
                      : 'Vérifiez les données extraites automatiquement par OCR'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* STEP 1: SCAN DOCUMENTS */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Quick Auto-Demo Bar */}
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 text-xs text-amber-900 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                      <span>Test Rapide : Numériser 3 pièces en 1 clic</span>
                    </div>
                    <button
                      onClick={handleSimulateAllAndExtract}
                      disabled={isOcrProcessing}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isOcrProcessing ? 'Analyse OCR...' : 'Auto-Scan Démo'}
                    </button>
                  </div>

                  {/* DOCUMENT 1: CNI RECTO */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                          1
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            Pièce d'identité (Recto)
                          </h4>
                          <span className="text-[10px] text-slate-400 block">
                            CNI biométrique ou passeport • Face avec photo et NIN
                          </span>
                        </div>
                      </div>

                      {dossier.documents.idRecto && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Reçu
                        </span>
                      )}
                    </div>

                    {dossier.documents.idRecto ? (
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <img
                          src={dossier.documents.idRecto.previewUrl}
                          alt="Recto"
                          className="w-16 h-11 object-cover rounded-lg border border-slate-300 cursor-pointer shadow-xs"
                          onClick={() => setPreviewModalDoc(dossier.documents.idRecto!)}
                        />
                        <div className="flex-1 truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {dossier.documents.idRecto.name}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium">
                            ✓ Données CNI extraites avec succès
                          </span>
                        </div>
                        <button
                          onClick={() => setPreviewModalDoc(dossier.documents.idRecto!)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-300">
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Prendre photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => onFileInputChange(e, 'id_recto')}
                          />
                        </label>
                        <button
                          onClick={() =>
                            handleAttachDocument('id_recto', DEMO_SAMPLES.idRecto.name, DEMO_SAMPLES.idRecto.previewUrl)
                          }
                          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-blue-200"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Simuler CNI</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DOCUMENT 2: CNI VERSO */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                          2
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            Pièce d'identité (Verso)
                          </h4>
                          <span className="text-[10px] text-slate-400 block">
                            Face arrière • Adresse, puce et date d'expiration
                          </span>
                        </div>
                      </div>

                      {dossier.documents.idVerso && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Reçu
                        </span>
                      )}
                    </div>

                    {dossier.documents.idVerso ? (
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <img
                          src={dossier.documents.idVerso.previewUrl}
                          alt="Verso"
                          className="w-16 h-11 object-cover rounded-lg border border-slate-300 cursor-pointer shadow-xs"
                          onClick={() => setPreviewModalDoc(dossier.documents.idVerso!)}
                        />
                        <div className="flex-1 truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {dossier.documents.idVerso.name}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium">
                            ✓ Puce et date d'expiration vérifiées
                          </span>
                        </div>
                        <button
                          onClick={() => setPreviewModalDoc(dossier.documents.idVerso!)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-300">
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Prendre photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => onFileInputChange(e, 'id_verso')}
                          />
                        </label>
                        <button
                          onClick={() =>
                            handleAttachDocument('id_verso', DEMO_SAMPLES.idVerso.name, DEMO_SAMPLES.idVerso.previewUrl)
                          }
                          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-blue-200"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Simuler Verso</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DOCUMENT 3: JUSTIFICATIF DE RÉSIDENCE */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                          3
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            Justificatif de Domicile / Résidence
                          </h4>
                          <span className="text-[10px] text-slate-400 block">
                            Certificat de résidence (- de 3 mois) ou facture Sonelgaz
                          </span>
                        </div>
                      </div>

                      {dossier.documents.residence && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Reçu
                        </span>
                      )}
                    </div>

                    {dossier.documents.residence ? (
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <img
                          src={dossier.documents.residence.previewUrl}
                          alt="Résidence"
                          className="w-16 h-11 object-cover rounded-lg border border-slate-300 cursor-pointer shadow-xs"
                          onClick={() => setPreviewModalDoc(dossier.documents.residence!)}
                        />
                        <div className="flex-1 truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {dossier.documents.residence.name}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium">
                            ✓ Domicile légal conforme
                          </span>
                        </div>
                        <button
                          onClick={() => setPreviewModalDoc(dossier.documents.residence!)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-300">
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>Importer fichier</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => onFileInputChange(e, 'residence')}
                          />
                        </label>
                        <button
                          onClick={() =>
                            handleAttachDocument(
                              'residence',
                              DEMO_SAMPLES.residence.name,
                              DEMO_SAMPLES.residence.previewUrl
                            )
                          }
                          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-blue-200"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Simuler Résidence</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: PRE-FILLED KYC E-FORM */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* OCR Extraction Notice */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-emerald-950 block">
                        Extraction OCR Réussie !
                      </span>
                      <span className="text-[11px] text-emerald-800">
                        Les champs ci-dessous ont été pré-remplis automatiquement depuis vos 3 pièces. Vous pouvez ajuster ou compléter si besoin.
                      </span>
                    </div>
                  </div>

                  {/* Form Section 1: Identité */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Identité Civile (Extrait CNI)</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Nom & Prénom
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.fullName}
                          onChange={(e) => handleFormFieldChange('fullName', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          NIN (Numéro National d'Identité)
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.nin}
                          onChange={(e) => handleFormFieldChange('nin', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-blue-700 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          N° Pièce d'Identité
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.documentNumber}
                          onChange={(e) => handleFormFieldChange('documentNumber', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Date d'expiration CNI
                        </label>
                        <input
                          type="date"
                          value={dossier.formData.expiryDate}
                          onChange={(e) => handleFormFieldChange('expiryDate', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Date de Naissance
                        </label>
                        <input
                          type="date"
                          value={dossier.formData.dateOfBirth}
                          onChange={(e) => handleFormFieldChange('dateOfBirth', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Lieu de Naissance
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.placeOfBirth}
                          onChange={(e) => handleFormFieldChange('placeOfBirth', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Section 2: Domicile & Coordonnées */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. Domicile & Contact (Extrait Résidence)</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Adresse légale de résidence
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.address}
                          onChange={(e) => handleFormFieldChange('address', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Commune
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.commune}
                          onChange={(e) => handleFormFieldChange('commune', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Wilaya
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.wilaya}
                          onChange={(e) => handleFormFieldChange('wilaya', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Téléphone mobile
                        </label>
                        <input
                          type="tel"
                          value={dossier.formData.phoneNumber}
                          onChange={(e) => handleFormFieldChange('phoneNumber', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Profession
                        </label>
                        <input
                          type="text"
                          value={dossier.formData.occupation}
                          onChange={(e) => handleFormFieldChange('occupation', e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
              {step === 1 ? (
                <>
                  <span className="text-xs text-slate-500 font-medium">
                    {docsCount}/3 pièces prêtes
                  </span>
                  <button
                    onClick={() => {
                      if (docsCount === 0) {
                        handleSimulateAllAndExtract();
                      } else {
                        setStep(2);
                      }
                    }}
                    className="py-3 px-5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Vérifier le e-Formulaire KYC</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    ← Retour pièces
                  </button>

                  <button
                    onClick={handleFinalSubmit}
                    className="py-3 px-6 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valider mon dossier d'entrée en relation</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. LIGHTBOX PREVIEW MODAL FOR SCANNED DOCUMENT */}
      {/* ============================================================ */}
      {previewModalDoc && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-4 max-w-lg w-full space-y-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {previewModalDoc.name}
              </span>
              <button
                onClick={() => setPreviewModalDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center p-2">
              <img
                src={previewModalDoc.previewUrl}
                alt={previewModalDoc.name}
                className="max-h-[60vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
