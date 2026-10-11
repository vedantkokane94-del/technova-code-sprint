/**
 * Deterministically assigns Variant A, B, or C using DJB2-like hash of user ID + day
 * @param {string} userId - User UID or email
 * @param {number} day - Day number (1 to 9)
 * @returns {string} - 'A', 'B', or 'C'
 */
export function getTaskVariant(userId, day) {
  if (!userId) return 'A';
  const str = String(userId).trim().toLowerCase() + '_day_' + String(day);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash);
  const variants = ['A', 'B', 'C'];
  return variants[positiveHash % 3];
}

/**
 * Calculates Jaccard / word-level similarity between two text strings
 * Returns percentage similarity (0 to 100)
 */
export function calculateTextSimilarity(text1 = '', text2 = '') {
  if (!text1 || !text2) return 0;
  const tokenize = (t) => {
    return new Set(
      t.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  };
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      intersection++;
    }
  }
  const union = new Set([...set1, ...set2]).size;
  return Math.round((intersection / union) * 100);
}

/**
 * Checks for signature phrases, clichés, and patterns typical of AI LLM code & explanation generation.
 * AI modules are strictly prohibited for Technova Code Sprint submissions.
 * @param {string} text - Solution note or explanation text
 * @returns {{ isAiSuspected: boolean, reason: string | null }}
 */
export function detectAiGeneratedContent(text = '') {
  if (!text || text.trim().length === 0) {
    return { isAiSuspected: false, reason: null };
  }

  const lower = text.toLowerCase();

  const aiPhrases = [
    "as an ai",
    "as a language model",
    "here is the complete solution",
    "here is the solution",
    "in this code, we have implemented",
    "in conclusion, the above code",
    "delve into",
    "crucial role in ensuring",
    "testament to",
    "it is important to note that",
    "certainly! here is",
    "here's the breakdown",
    "here is the step-by-step",
    "step-by-step breakdown",
    "let me know if you need any further assistance",
    "feel free to ask if you have any questions",
    "happy coding!",
    "hope this helps!"
  ];

  for (const phrase of aiPhrases) {
    if (lower.includes(phrase)) {
      return {
        isAiSuspected: true,
        reason: `Flagged: Signature AI generation phrase detected ("${phrase}"). AI modules are strictly prohibited.`
      };
    }
  }

  return { isAiSuspected: false, reason: null };
}


