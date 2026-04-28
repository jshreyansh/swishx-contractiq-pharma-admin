export interface DemoDocument {
  id: string;
  title: string;
  kind: string;
  addedBy: string;
  addedAt: string;
}

const ORDER_DOCUMENTS: Record<string, DemoDocument[]> = {
  'ORD-2026-61001': [
    {
      id: 'ord-61001-po',
      title: 'Apollo fresh requirement note.pdf',
      kind: 'Hospital Note',
      addedBy: 'Priya Singh',
      addedAt: 'Today, 10:15 AM',
    },
  ],
  'ORD-2026-61005': [
    {
      id: 'ord-61005-po',
      title: 'AIIMS purchase order scan.pdf',
      kind: 'PO',
      addedBy: 'Rahul Sharma',
      addedAt: 'Today, 9:05 AM',
    },
    {
      id: 'ord-61005-reconfirm',
      title: 'Hospital reconfirmation mail.msg',
      kind: 'Approval Mail',
      addedBy: 'Division Desk',
      addedAt: 'Today, 11:40 AM',
    },
  ],
  'ORD-2026-61006': [
    {
      id: 'ord-61006-rc',
      title: 'RC release note RC-2026-001.pdf',
      kind: 'RC Reference',
      addedBy: 'Arun Desai',
      addedAt: 'Yesterday, 6:20 PM',
    },
  ],
  'ORD-2026-61007': [
    {
      id: 'ord-61007-asm',
      title: 'ASM commercial justification.docx',
      kind: 'Commercial Note',
      addedBy: 'Rajesh Kumar',
      addedAt: 'Yesterday, 4:10 PM',
    },
    {
      id: 'ord-61007-po',
      title: 'Max PO signed copy.pdf',
      kind: 'PO',
      addedBy: 'Rahul Sharma',
      addedAt: 'Yesterday, 4:35 PM',
    },
  ],
  'ORD-2026-61010': [
    {
      id: 'ord-61010-exception',
      title: 'Regional exception request.pdf',
      kind: 'Exception Note',
      addedBy: 'Neeraj Sharma',
      addedAt: 'Yesterday, 2:00 PM',
    },
  ],
  'ORD-2026-61011': [
    {
      id: 'ord-61011-failure',
      title: 'CFA validation screenshot.png',
      kind: 'Exception Proof',
      addedBy: 'Ramesh CFA',
      addedAt: 'Today, 12:25 PM',
    },
  ],
};

const RATE_CONTRACT_DOCUMENTS: Record<string, DemoDocument[]> = {
  'RC-2026-001': [
    {
      id: 'rc-001-signed',
      title: 'Signed commercial annexure.pdf',
      kind: 'RC Annexure',
      addedBy: 'Hospital Procurement',
      addedAt: 'Apr 25, 2026',
    },
    {
      id: 'rc-001-mail',
      title: 'Negotiated pricing confirmation.msg',
      kind: 'Approval Mail',
      addedBy: 'Priya Singh',
      addedAt: 'Apr 25, 2026',
    },
  ],
  'RC-2026-021': [
    {
      id: 'rc-021-round2',
      title: 'Round 2 cap-qty revision sheet.xlsx',
      kind: 'Negotiation Sheet',
      addedBy: 'Division Desk',
      addedAt: 'Apr 27, 2026',
    },
  ],
  'RC-2026-022': [
    {
      id: 'rc-022-po',
      title: 'Hospital intent letter.pdf',
      kind: 'Hospital Letter',
      addedBy: 'Field Rep',
      addedAt: 'Apr 26, 2026',
    },
  ],
  'RC-2026-024': [
    {
      id: 'rc-024-support',
      title: 'Competition benchmarking note.docx',
      kind: 'Benchmark Note',
      addedBy: 'Business Review Team',
      addedAt: 'Apr 24, 2026',
    },
  ],
};

export function getDemoOrderDocuments(orderId: string): DemoDocument[] {
  return ORDER_DOCUMENTS[orderId] || [];
}

export function getDemoRateContractDocuments(rcCode: string): DemoDocument[] {
  return RATE_CONTRACT_DOCUMENTS[rcCode] || [];
}
