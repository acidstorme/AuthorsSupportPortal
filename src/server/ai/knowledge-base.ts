// Faithful policy transcription from the supplied assignment PDF. Examples are guidance,
// not evidence that any particular operational action has happened.
export const KB_VERSION = "bookleaf-assignment-v1";
export const knowledgeBase = {
  company: "BookLeaf Publishing is a self-publishing company operating in India and the US. Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium paid package with marketing/distribution add-ons). Services: cover design, typesetting, ISBN assignment, printing, distribution and royalty management. In-house printing facility/warehouse: Delhi. Print partners: Repro India and Epitome Books.",
  royalty: "80/20 split: author receives 80% of net profit per book, BookLeaf 20%. Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping. Royalties are calculated quarterly and paid within 45 days after quarter end. Minimum payout INR 1,000; smaller accumulated royalties roll over to the next quarter. Payouts use bank transfer to the account linked in the author's dashboard. The policy describes a detailed per-platform dashboard breakdown; this demo dataset does not provide per-platform figures, bank details or confirmed payment eligibility/dates.",
  isbn: "Each BookLeaf-published book receives a unique ISBN assigned by BookLeaf under BookLeaf's publisher imprint. Authors wanting their own imprint obtain an ISBN independently. ISBN errors such as duplicate or wrong-book linkage are high-priority production-team escalation issues. The sample example calls for a 48-hour resolution timeline, but this portal cannot confirm escalation or guarantee that case-specific deadline.",
  printing: "Most orders use in-house printing; overflow/specific formats go to Repro India or Epitome Books. Standard turnaround is 5–7 business days from order confirmation. For misprints, binding defects or color inconsistency, BookLeaf arranges a free reprint after verification; photos of defective copies may be needed. The example asks for photos and gives a 5–7 business-day reprint timeline after verification. This portal cannot receive uploads or confirm verification/reprint orders.",
  distribution: "Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store. New listings typically go live 7–10 business days after publication is complete. Unavailable listings usually indicate stock sync issues; BookLeaf's team can trigger a re-sync within 24–48 hours. This is a policy window, not proof that a re-sync occurred or a guarantee of listing restoration.",
  production: "Stages: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live. Policy describes email updates at each stage. Delays typically occur at Cover Design awaiting author approval or Proofreading revision rounds; these are general possibilities, not verified reasons for this author's delay. The demo does not send emails or contain production ETA/approval history.",
  metadata: "The sample general-inquiry example permits book description/metadata updates through the dashboard or by emailing the BookLeaf team; changes typically reflect on platforms within 3–5 business days. This demo has no metadata-editing action or support email address; do not invent an address or claim an update was submitted.",
  tone: "Be empathetic and professional; authors are partners. Acknowledge the concern, use verified numbers/dates/statuses when available, take responsibility for verified BookLeaf mistakes without deflection and end with a clear next step. The examples suggest bank checks, specific payout dates, completed escalations/re-syncs and 48-hour commitments. Those require facts/actions absent here: propose team review, ask for missing details and quote applicable policy windows without fabricating completed work or promises.",
} as const;
export function selectKnowledge(category: string | null, text: string) {
  const selected = new Set<keyof typeof knowledgeBase>(["company", "tone"]);
  const topics: [keyof typeof knowledgeBase, RegExp, string][] = [
    ["royalty", /royalt|payment|payout|profit|bank/i, "ROYALTY_PAYMENTS"],
    ["isbn", /isbn|imprint/i, "ISBN_METADATA_ISSUES"], ["metadata", /metadata|description|bio/i, "GENERAL_INQUIRY"],
    ["printing", /print|binding|misprint|blurr|defect|quality/i, "PRINTING_QUALITY"],
    ["distribution", /amazon|flipkart|listing|unavailable|stock|distribut/i, "DISTRIBUTION_AVAILABILITY"],
    ["production", /production|typeset|proof|cover|manuscript|publish/i, "BOOK_STATUS_PRODUCTION_UPDATES"],
  ];
  for (const [key, pattern, mapped] of topics) if (category === mapped || pattern.test(text)) selected.add(key);
  if (selected.size === 2) for (const key of Object.keys(knowledgeBase) as (keyof typeof knowledgeBase)[]) selected.add(key);
  return [...selected].map((key) => ({ section: key, content: knowledgeBase[key] }));
}
