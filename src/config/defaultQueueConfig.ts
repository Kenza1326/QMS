import { QueueSystemConfig, QueueCategory, CounterStation } from '../types/queueTypes';
import { DEFAULT_QUEUE_RULES } from './defaultQueueRules';

// MULTI-SERVICES CATEGORIES FOR CAPTUREDOC TEMPLATE 2 (BROAD OPERATIONS)
export const CAPTUREDOC_SERVICES_CATEGORIES: QueueCategory[] = [
  {
    id: 'cat-paiement',
    code: 'PAIEMENT',
    ticketPrefix: 'F',
    labelFr: 'Paiement de factures & recharges',
    labelAr: 'دفع الفواتير وتعبئة الرصيد',
    iconName: 'Banknote',
    color: '#0055D4',
    subOperations: [
      {
        id: 'sub-sonelgaz',
        code: 'SONELGAZ',
        labelFr: 'Facture d\'électricité & gaz (Sonelgaz)',
        labelAr: 'فاتورة الكهرباء والغاز',
        estimatedMinutes: 5,
        requiredDocuments: [
          {
            id: 'doc-facture',
            label: 'Facture papier ou référence client',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-eau',
        code: 'EAU',
        labelFr: 'Facture d\'eau potable (SEAAL / ADE)',
        labelAr: 'فاتورة المياه',
        estimatedMinutes: 5,
        requiredDocuments: [
          {
            id: 'doc-facture-eau',
            label: 'Facture d\'eau ou avis d\'échéance',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-telecom',
        code: 'TELECOM',
        labelFr: 'Recharge & abonnements Télécom (Fibre / 4G / Mobilis)',
        labelAr: 'اشتراكات الإنترنت والهاتف',
        estimatedMinutes: 4,
        requiredDocuments: [
          {
            id: 'doc-tel',
            label: 'Numéro de ligne ou contrat',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-timbres',
        code: 'TIMBRES_TAXES',
        labelFr: 'Droits de timbre & taxes administratives',
        labelAr: 'حقوق الطابع الجبائي والرسوم',
        estimatedMinutes: 6,
        requiredDocuments: [
          {
            id: 'doc-cni',
            label: 'Pièce d\'identité biométrique',
            isMandatory: true,
          },
        ],
      },
    ],
  },
  {
    id: 'cat-docs',
    code: 'DOCUMENTS',
    ticketPrefix: 'D',
    labelFr: 'Dépôt & retrait de dossiers administratifs',
    labelAr: 'إيداع واستلام الملفات الإدارية',
    iconName: 'FileText',
    color: '#FFB800',
    subOperations: [
      {
        id: 'sub-depot-dossier',
        code: 'DEPOT_DOSSIER',
        labelFr: 'Dépôt de dossier d\'inscription / agrément',
        labelAr: 'إيداع ملف التسجيل والاعتماد',
        estimatedMinutes: 15,
        requiredDocuments: [
          {
            id: 'doc-dossier-complet',
            label: 'Dossier complet relié avec bordereau',
            isMandatory: true,
          },
          {
            id: 'doc-cni',
            label: 'Pièce d\'identité biométrique du demandeur',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-retrait-cartes',
        code: 'RETRAIT_CARTES',
        labelFr: 'Retrait de cartes, permis & attestations validées',
        labelAr: 'استلام البطاقات والشهادات الصادرة',
        estimatedMinutes: 5,
        requiredDocuments: [
          {
            id: 'doc-recepisse',
            label: 'Récépissé de dépôt ou convocation',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-legalisation',
        code: 'LEGALISATION',
        labelFr: 'Légalisation & certification électronique',
        labelAr: 'المصادقة الإلكترونية على الوثائق',
        estimatedMinutes: 10,
        requiredDocuments: [
          {
            id: 'doc-originaux',
            label: 'Originaux des documents à certifier',
            isMandatory: true,
          },
        ],
      },
    ],
  },
  {
    id: 'cat-citoyen',
    code: 'CITOYEN',
    ticketPrefix: 'A',
    labelFr: 'Accueil & démarches citoyennes',
    labelAr: 'الاستقبال والتوجيه والإجراءات',
    iconName: 'UserCheck',
    color: '#0284C7',
    subOperations: [
      {
        id: 'sub-orientation',
        code: 'ORIENTATION',
        labelFr: 'Renseignements généraux & orientation',
        labelAr: 'الاستعلامات العامة والتوجيه',
        estimatedMinutes: 5,
        requiredDocuments: [],
      },
      {
        id: 'sub-assistance-enligne',
        code: 'ASSISTANCE_ENLIGNE',
        labelFr: 'Assistance aux démarches en ligne & formulaires',
        labelAr: 'المساعدة في المعاملات الرقمية',
        estimatedMinutes: 15,
        requiredDocuments: [
          {
            id: 'doc-cni',
            label: 'Pièce d\'identité',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-reclamation-citoyen',
        code: 'RECLAMATION_CITOYEN',
        labelFr: 'Dépôt de réclamation & médiation',
        labelAr: 'تسجيل الشكاوى والوساطة',
        estimatedMinutes: 12,
        requiredDocuments: [
          {
            id: 'doc-justif-rec',
            label: 'Justificatif de la demande ou référence',
            isMandatory: true,
          },
        ],
      },
    ],
  },
  {
    id: 'cat-pro-admin',
    code: 'ENTREPRISE',
    ticketPrefix: 'PRO',
    labelFr: 'Services professionnels & entreprises',
    labelAr: 'خدمات المؤسسات والشركاء',
    iconName: 'Briefcase',
    color: '#475569',
    subOperations: [
      {
        id: 'sub-appels-offres',
        code: 'APPELS_OFFRES',
        labelFr: 'Dépôt de soumissions & appels d\'offres',
        labelAr: 'إيداع العروض والمناقصات',
        estimatedMinutes: 20,
        requiredDocuments: [
          {
            id: 'doc-pli-ferme',
            label: 'Plis cachetés sous enveloppe scellée',
            isMandatory: true,
          },
          {
            id: 'doc-mandat',
            label: 'Mandat ou procuration de la société',
            isMandatory: true,
          },
        ],
      },
      {
        id: 'sub-attestations-pro',
        code: 'ATTESTATIONS_PRO',
        labelFr: 'Attestations fiscales & parafiscales d\'entreprise',
        labelAr: 'الشهادات الجبائية والشهادات المهنية',
        estimatedMinutes: 15,
        requiredDocuments: [
          {
            id: 'doc-rc',
            label: 'Registre du commerce et NIF',
            isMandatory: true,
          },
        ],
      },
    ],
  },
];

// COUNTERS FOR CAPTUREDOC MULTI-SERVICES TEMPLATE
export const CAPTUREDOC_SERVICES_COUNTERS: CounterStation[] = [
  {
    id: 'counter-s1',
    number: 1,
    name: 'Guichet 01 - Factures & Paiements Rapides',
    agentName: 'Amina Benali',
    assignedCategoryIds: ['cat-paiement'],
    status: 'idle',
  },
  {
    id: 'counter-s2',
    number: 2,
    name: 'Guichet 02 - Dépôt & Retrait Dossiers',
    agentName: 'Karim Haddad',
    assignedCategoryIds: ['cat-docs'],
    status: 'idle',
  },
  {
    id: 'counter-s3',
    number: 3,
    name: 'Guichet 03 - Démarches Citoyennes & Renseignements',
    agentName: 'Samia Mansouri',
    assignedCategoryIds: ['cat-citoyen'],
    status: 'idle',
  },
  {
    id: 'counter-s4',
    number: 4,
    name: 'Guichet 04 - Espace Entreprises & Partenaires',
    agentName: 'Sofiane Zerrouki',
    assignedCategoryIds: ['cat-pro-admin'],
    status: 'idle',
  },
];

// BANKING CATEGORIES (PRESERVED IN FULL)
export const BANKING_CATEGORIES: QueueCategory[] = [
  {
    "id": "cat-caisse",
    "code": "CAISSE",
    "ticketPrefix": "C",
    "labelFr": "Opérations de caisse",
    "labelAr": "عمليات على الصندوق",
    "iconName": "Banknote",
    "color": "#E60028",
    "subOperations": [
      {
        "id": "sub-retrait-versement-dzd",
        "code": "RETRAIT_VERS_DZD",
        "labelFr": "Retrait / versement (DZD)",
        "labelAr": "سحب / إيداع (دج)",
        "estimatedMinutes": 5,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique (CNI ou Passeport)",
            "isMandatory": true,
            "description": "Original en cours de validité"
          },
          {
            "id": "doc-cheque",
            "label": "Chèque ou bordereau de versement",
            "isMandatory": true,
            "description": "Chèque signé ou bordereau dûment rempli"
          }
        ]
      },
      {
        "id": "sub-autres-dzd",
        "code": "AUTRES_DZD",
        "labelFr": "Autres opérations DZD",
        "labelAr": "عمليات أخرى دج",
        "estimatedMinutes": 7,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          },
          {
            "id": "doc-justif",
            "label": "Justificatif de l'opération",
            "isMandatory": false
          }
        ]
      },
      {
        "id": "sub-retrait-versement-devise",
        "code": "RETRAIT_VERS_DEVISE",
        "labelFr": "Retrait / versement devise",
        "labelAr": "سحب / إيداع عملة صعبة",
        "estimatedMinutes": 8,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          },
          {
            "id": "doc-justif-devise",
            "label": "Déclaration douanière ou titre de voyage (si versement)",
            "isMandatory": false
          }
        ]
      },
      {
        "id": "sub-allocations-devises",
        "code": "ALLOCATIONS_DEVISES",
        "labelFr": "Autres opérations Devise (allocations)",
        "labelAr": "عمليات أخرى عملة صعبة (منحة سياحية)",
        "estimatedMinutes": 10,
        "requiredDocuments": [
          {
            "id": "doc-passeport",
            "label": "Passeport en cours de validité",
            "isMandatory": true
          },
          {
            "id": "doc-billet",
            "label": "Billet de transport aller-retour",
            "isMandatory": true
          },
          {
            "id": "doc-quittance",
            "label": "Quittance fiscale de droit de timbre",
            "isMandatory": true
          }
        ]
      }
    ]
  },
  {
    "id": "cat-particuliers",
    "code": "PARTICULIERS",
    "ticketPrefix": "P",
    "labelFr": "Services aux particuliers",
    "labelAr": "خدمات للأفراد",
    "iconName": "UserCheck",
    "color": "#003B73",
    "subOperations": [
      {
        "id": "sub-ouverture-compte",
        "code": "ENTREE_RELATION",
        "labelFr": "Entrée en relation (Ouverture de compte)",
        "labelAr": "بدء العلاقة المصرفية / فتح حساب",
        "estimatedMinutes": 15,
        "requiredDocuments": [
          {
            "id": "doc-cni",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          },
          {
            "id": "doc-residence",
            "label": "Certificat de résidence (- de 3 mois)",
            "isMandatory": true
          },
          {
            "id": "doc-travail",
            "label": "Fiche de paie ou attestation de travail",
            "isMandatory": true
          },
          {
            "id": "doc-photos",
            "label": "2 photos d'identité récentes",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-credit-conso-immo",
        "code": "CREDIT_CONSO_IMMO",
        "labelFr": "Demande de crédit immobilier / consommation",
        "labelAr": "طلب قرض استهلاكي أو عقاري",
        "estimatedMinutes": 20,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique (CNI / Passeport)",
            "isMandatory": true
          },
          {
            "id": "doc-fiche-paie",
            "label": "3 dernières fiches de paie ou attestation de revenu",
            "isMandatory": true
          },
          {
            "id": "doc-releves",
            "label": "Relevés bancaires des 3 derniers mois",
            "isMandatory": true
          },
          {
            "id": "doc-attestation-travail",
            "label": "Attestation de travail récente",
            "isMandatory": true
          },
          {
            "id": "doc-residence",
            "label": "Certificat de résidence en cours de validité",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-moyens-paiement",
        "code": "MOYENS_PAIEMENT",
        "labelFr": "Cartes bancaires (CIB/Visa) & Chéquiers",
        "labelAr": "البطاقات البنكية ودفاتر الشيكات",
        "estimatedMinutes": 8,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-reclamation-conseil",
        "code": "RECLAMATION_CONSEIL",
        "labelFr": "Conseil client & Réclamations",
        "labelAr": "استشارات وشكاوى الزبائن",
        "estimatedMinutes": 10,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          }
        ]
      }
    ]
  },
  {
    "id": "cat-pro",
    "code": "PROFESSIONNELS",
    "ticketPrefix": "PRO",
    "labelFr": "Services aux professionnels",
    "labelAr": "خدمات للمهنيين",
    "iconName": "Briefcase",
    "color": "#C99700",
    "subOperations": [
      {
        "id": "sub-financement-pro",
        "code": "FINANCEMENT_PRO",
        "labelFr": "Financement d'entreprise & Investissement",
        "labelAr": "تمويل المؤسسات والاستثمار",
        "estimatedMinutes": 25,
        "requiredDocuments": [
          {
            "id": "doc-rc",
            "label": "Registre de commerce électronique",
            "isMandatory": true
          },
          {
            "id": "doc-bilans",
            "label": "Bilans & états financiers des 2 derniers exercices",
            "isMandatory": true
          },
          {
            "id": "doc-statuts",
            "label": "Statuts de l'entreprise & PV de nomination du gérant",
            "isMandatory": true
          },
          {
            "id": "doc-cni-gerant",
            "label": "Pièce d'identité du gérant ou mandataire habilité",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-commerce-international",
        "code": "COMMERCE_INT",
        "labelFr": "Commerce international (Credoc, Remdoc)",
        "labelAr": "التجارة الخارجية والاعتمادات المستندية",
        "estimatedMinutes": 20,
        "requiredDocuments": [
          {
            "id": "doc-domiciliation",
            "label": "Facture domiciliée & D10 douanier",
            "isMandatory": true
          },
          {
            "id": "doc-certif",
            "label": "Certificat d'origine & liste de colisage",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-gestion-flux-tpe",
        "code": "GESTION_FLUX_TPE",
        "labelFr": "Gestion des flux & Terminaux TPE / e-Paiement",
        "labelAr": "إدارة السيولة وأجهزة الدفع الإلكتروني TPE",
        "estimatedMinutes": 12,
        "requiredDocuments": [
          {
            "id": "doc-id-gerant",
            "label": "Pièce d'identité du gérant",
            "isMandatory": true
          },
          {
            "id": "doc-rib-pro",
            "label": "RIB du compte professionnel",
            "isMandatory": true
          }
        ]
      }
    ]
  },
  {
    "id": "cat-portefeuille",
    "code": "PORTEFEUILLE",
    "ticketPrefix": "PF",
    "labelFr": "Opérations portefeuille (chèques, traites)",
    "labelAr": "عمليات المحفظة (شيكات، كمبيالات)",
    "iconName": "FileText",
    "color": "#475569",
    "subOperations": [
      {
        "id": "sub-remise-cheques",
        "code": "REMISE_CHEQUES",
        "labelFr": "Remise de chèques à l'encaissement",
        "labelAr": "إيداع الشيكات للتحصيل",
        "estimatedMinutes": 6,
        "requiredDocuments": [
          {
            "id": "doc-cheques",
            "label": "Chèques endossés (signature au verso)",
            "isMandatory": true
          },
          {
            "id": "doc-bordereau",
            "label": "Bordereau de remise complété",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-encaissement-effets",
        "code": "ENCAISSEMENT_EFFETS",
        "labelFr": "Encaissement traites & effets de commerce",
        "labelAr": "تحصيل الكمبيالات والسندات للأمر",
        "estimatedMinutes": 10,
        "requiredDocuments": [
          {
            "id": "doc-traites",
            "label": "Effets originaux signés et acceptés",
            "isMandatory": true
          }
        ]
      },
      {
        "id": "sub-regularisation-rejets",
        "code": "REGUL_REJETS",
        "labelFr": "Régularisation d'incidents & rejets",
        "labelAr": "تسوية حوادث الدفع والرفض",
        "estimatedMinutes": 15,
        "requiredDocuments": [
          {
            "id": "doc-id",
            "label": "Pièce d'identité biométrique",
            "isMandatory": true
          },
          {
            "id": "doc-avis-rejet",
            "label": "Avis de rejet reçu",
            "isMandatory": true
          }
        ]
      }
    ]
  }
];

export const BANKING_COUNTERS: CounterStation[] = [
  {
    id: 'counter-1',
    number: 1,
    name: 'Guichet 01 - Caisse Rapide',
    agentName: 'Amina Benali',
    assignedCategoryIds: ['cat-caisse'],
    status: 'idle',
  },
  {
    id: 'counter-2',
    number: 2,
    name: 'Guichet 02 - Caisse & Devises',
    agentName: 'Karim Haddad',
    assignedCategoryIds: ['cat-caisse'],
    status: 'idle',
  },
  {
    id: 'counter-3',
    number: 3,
    name: 'Guichet 03 - Conseiller Particuliers',
    agentName: 'Samia Mansouri',
    assignedCategoryIds: ['cat-particuliers'],
    status: 'idle',
  },
  {
    id: 'counter-4',
    number: 4,
    name: 'Guichet 04 - Espace Entreprises & Portefeuille',
    agentName: 'Sofiane Zerrouki',
    assignedCategoryIds: ['cat-pro', 'cat-portefeuille'],
    status: 'idle',
  },
];

export const DEFAULT_QUEUE_CONFIG: QueueSystemConfig = {
  brand: {
    id: 'capturedoc-bank',
    name: 'CaptureDoc - Services Bancaires & Financiers',
    arabicName: '',
    tagline: 'Solutions d\'accueil et traitement des flux financiers',
    taglineAr: '',
    primaryColor: '#0055D4',
    primaryHover: '#0047BA',
    primaryDark: '#00358A',
    secondaryColor: '#FFB800',
    secondaryLight: '#FFE8A3',
    accentColor: '#0055D4',
    logoUrl: '/logos/capturedoc.png',
    websiteUrl: 'https://capturedoc.com',
  },
  availableBrands: [
    {
      id: 'capturedoc-bank',
      name: 'CaptureDoc - Services Bancaires & Financiers',
      arabicName: '',
      tagline: 'Accueil et gestion optimisée des opérations bancaires',
      taglineAr: '',
      primaryColor: '#0055D4',
      primaryHover: '#0047BA',
      primaryDark: '#00358A',
      secondaryColor: '#FFB800',
      secondaryLight: '#FFE8A3',
      accentColor: '#0055D4',
      logoUrl: '/logos/capturedoc.png',
      websiteUrl: 'https://capturedoc.com',
    },
    {
      id: 'capturedoc-services',
      name: 'CaptureDoc - Services Publics & Facturation',
      arabicName: '',
      tagline: 'Paiement de factures, démarches citoyennes et dossiers administratifs',
      taglineAr: '',
      primaryColor: '#0055D4',
      primaryHover: '#0047BA',
      primaryDark: '#00358A',
      secondaryColor: '#FFB800',
      secondaryLight: '#FFE8A3',
      accentColor: '#0055D4',
      logoUrl: '/logos/capturedoc.png',
      websiteUrl: 'https://capturedoc.com',
    },
    {
      id: 'agb',
      name: 'Gulf Bank Algérie (AGB)',
      arabicName: '',
      tagline: 'Votre partenaire de confiance pour un avenir prospère',
      taglineAr: '',
      primaryColor: '#003865',
      primaryHover: '#002B4E',
      primaryDark: '#001D38',
      secondaryColor: '#C99700',
      secondaryLight: '#F4E0A5',
      accentColor: '#E60028',
      logoUrl: '/logos/agb.png',
      websiteUrl: 'https://www.agb.dz',
    },
    {
      id: 'sga',
      name: 'Société Générale Algérie (SGA)',
      arabicName: '',
      tagline: "C'est vous l'avenir",
      taglineAr: '',
      primaryColor: '#E60028',
      primaryHover: '#CC0024',
      primaryDark: '#1A1A1A',
      secondaryColor: '#1A1A1A',
      secondaryLight: '#333333',
      accentColor: '#E60028',
      logoUrl: '/logos/sga.png',
      websiteUrl: 'https://www.societegenerale.dz',
    },
  ],
  selectedAgencyId: 'ag-alger-centre',
  agencies: [
    {
      id: 'ag-alger-centre',
      name: 'Agence Principale Alger Centre',
      city: 'Alger',
      address: '12, Rue Didouche Mourad, Alger',
      phone: '+213 21 73 80 00',
      openingHours: 'Dimanche - Jeudi : 08h30 - 16h30',
      hourlyAffluence: [
        { hour: '08:30', percentage: 35, isPeak: false },
        { hour: '09:30', percentage: 65, isPeak: false },
        { hour: '10:30', percentage: 95, isPeak: true },
        { hour: '11:30', percentage: 85, isPeak: true },
        { hour: '12:30', percentage: 50, isPeak: false },
        { hour: '13:30', percentage: 60, isPeak: false },
        { hour: '14:30', percentage: 75, isPeak: false },
        { hour: '15:30', percentage: 40, isPeak: false },
        { hour: '16:00', percentage: 25, isPeak: false },
      ],
    },
    {
      id: 'ag-hydra',
      name: 'Agence Hydra Val d\'Hydra',
      city: 'Alger',
      address: 'Boulevard du 11 Décembre 1960, Hydra, Alger',
      phone: '+213 21 60 45 12',
      openingHours: 'Dimanche - Jeudi : 08h30 - 16h30',
      hourlyAffluence: [
        { hour: '08:30', percentage: 25, isPeak: false },
        { hour: '09:30', percentage: 55, isPeak: false },
        { hour: '10:30', percentage: 80, isPeak: true },
        { hour: '11:30', percentage: 90, isPeak: true },
        { hour: '12:30', percentage: 45, isPeak: false },
        { hour: '13:30', percentage: 55, isPeak: false },
        { hour: '14:30', percentage: 70, isPeak: false },
        { hour: '15:30', percentage: 30, isPeak: false },
        { hour: '16:00', percentage: 20, isPeak: false },
      ],
    },
  ],
  categories: BANKING_CATEGORIES,
  counters: BANKING_COUNTERS,
  exchangeRates: [
    {
      currencyCode: 'EUR',
      currencyName: 'Euro',
      flag: '🇪🇺',
      buyRate: 146.85,
      sellRate: 147.15,
      trend: 'up',
      lastUpdated: 'Aujourd\'hui à 09:00',
    },
    {
      currencyCode: 'USD',
      currencyName: 'Dollar US',
      flag: '🇺🇸',
      buyRate: 134.42,
      sellRate: 134.78,
      trend: 'down',
      lastUpdated: 'Aujourd\'hui à 09:00',
    },
    {
      currencyCode: 'GBP',
      currencyName: 'Livre Sterling',
      flag: '🇬🇧',
      buyRate: 172.95,
      sellRate: 173.45,
      trend: 'up',
      lastUpdated: 'Aujourd\'hui à 09:00',
    },
    {
      currencyCode: 'CAD',
      currencyName: 'Dollar Canadien',
      flag: '🇨🇦',
      buyRate: 99.12,
      sellRate: 99.45,
      trend: 'neutral',
      lastUpdated: 'Aujourd\'hui à 09:00',
    },
    {
      currencyCode: 'SAR',
      currencyName: 'Riyal Saoudien',
      flag: '🇸🇦',
      buyRate: 35.84,
      sellRate: 35.98,
      trend: 'neutral',
      lastUpdated: 'Aujourd\'hui à 09:00',
    },
  ],
  advertisingBanners: [],
  soundSettings: {
    soundEnabled: true,
    speechEnabled: true,
    volume: 0.8,
    speechLang: 'fr-FR',
  },
  rules: DEFAULT_QUEUE_RULES,
};
