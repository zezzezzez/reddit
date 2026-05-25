// Sentiment Analysis Engine
// Uses keyword matching + rule-based analysis for detecting hostile/negative comments
// Optional OpenAI integration for more accurate analysis

import { RedditComment, AlertLevel, DetectionRules } from './types';

// Hostile/negative keyword categories
export const KEYWORD_CATEGORIES = {
  brand_attack: [
    'worst brand', 'garbage company', 'trash company',
    'boycott', 'boycott hisense',
    'never buy hisense', 'never buying hisense',
    'stay away from hisense', 'do not buy hisense', "don't buy hisense",
    'ripoff', 'rip off', 'hisense ripoff', 'hisense rip off',
    'hisense scam', 'hisense fraud', 'hisense liar',
    'hisense is lying', 'hisense lies',
    'hisense cheat', 'hisense cheating',
    'hisense steal', 'hisense stealing', 'hisense stolen',
    'hisense thief', 'hisense thieves',
    'hisense deceptive', 'hisense misleading',
    'hisense unethical', 'hisense corrupt', 'hisense dishonest',
  ],
  product_hate: [
    'worst tv', 'terrible tv', 'horrible tv', 'awful tv', 'pathetic tv', 'garbage tv', 'trash tv',
    'junk tv', 'useless tv', 'broken out of box', 'defective tv', 'piece of crap', 'piece of shit',
    ' POS ', 'lemon tv', 'nightmare tv', 'complete disaster', 'total fail', 'total failure',
    'regret buying this tv', 'waste of money', 'returning this', 'sent it back',
  ],
  negative_sentiment: [
    'hate this tv', 'hate hisense', 'disgusting quality', 'outrageous', 'unacceptable quality',
    'fed up with hisense', 'sick of hisense', 'tired of hisense',
    'never again hisense', 'never buying hisense',
    'overpriced junk', 'not worth the money', 'total waste', 'deeply disappointed',
  ],
  call_to_action_negative: [
    "don't buy hisense", 'avoid hisense', 'stay away from hisense',
    'do not recommend hisense', 'not recommended hisense',
    'boycott hisense', 'class action', 'sue hisense', 'lawsuit hisense',
    'report them', 'file a complaint', 'contact bbb',
    'spread the word', 'warning about hisense',
  ],
  competitor_push: [
    'get samsung instead', 'buy lg instead', 'sony is better', 'get a samsung',
    'switch to lg', 'go with sony', 'tcl is better', 'hisense sucks',
    'hisense is trash', 'hisense is garbage', 'hisense is worst',
    'anyone but hisense', 'avoid hisense', 'skip hisense',
  ],
};

// Positive keyword patterns for sentiment scoring
const POSITIVE_PATTERNS = [
  // Brand praise
  { pattern: /love (?:my |this |the )?hisense/i, weight: 0.4 },
  { pattern: /hisense (?:is|has been) (?:great|amazing|excellent|awesome|fantastic|wonderful|incredible|outstanding)/i, weight: 0.5 },
  { pattern: /really (?:like|enjoy|love|appreciate) (?:my |this |the )?(?:hisense|this tv)/i, weight: 0.4 },
  { pattern: /best (?:tv|purchase|buy|value) (?:i|ive|i'v|i'Ve) (?:ever|had)/i, weight: 0.5 },
  { pattern: /highly (?:recommend|rated)/i, weight: 0.35 },
  { pattern: /great (?:value|price|quality|picture|tv)/i, weight: 0.3 },
  { pattern: /good (?:value|price|quality|picture)/i, weight: 0.25 },
  { pattern: /impressed (?:with|by)/i, weight: 0.3 },
  { pattern: /impressive/i, weight: 0.3 },
  { pattern: /excellent (?:picture|quality|tv|value)/i, weight: 0.35 },
  { pattern: /amazing (?:picture|quality|tv|value)/i, weight: 0.35 },
  { pattern: /solid (?:tv|choice|purchase|value)/i, weight: 0.25 },
  { pattern: /would (?:definitely |highly )?recommend/i, weight: 0.3 },
  { pattern: /no (?:regrets|issues|problems|complaints)/i, weight: 0.25 },
  { pattern: /very (?:happy|pleased|satisfied)/i, weight: 0.35 },
  { pattern: /worth (?:every |the )?(?:penny|money|price)/i, weight: 0.3 },
  { pattern: /fantastic (?:picture|quality|tv)/i, weight: 0.35 },
  { pattern: /great (?:for the |at the )?(?:price|money|budget)/i, weight: 0.3 },
  { pattern: /looks (?:great|amazing|beautiful|stunning|fantastic)/i, weight: 0.25 },
  { pattern: /really (?:good|nice|impressive|solid)/i, weight: 0.2 },
  { pattern: /glad i (?:bought|got|purchased)/i, weight: 0.3 },
  { pattern: /happy (?:with|about) (?:my |this |the )?(?:purchase|tv|hisense)/i, weight: 0.3 },
  { pattern: /exceeded (?:my |the )?expectations/i, weight: 0.4 },
];

// Intensity modifiers that amplify negativity
const INTENSITY_MODIFIERS = [
  'very', 'extremely', 'absolutely', 'completely', 'totally',
  'utterly', 'incredibly', 'seriously', 'really', 'so',
  'fucking', 'damn', 'hell', 'super',
];

// Negation words that might flip sentiment
const NEGATION_WORDS = [
  'not', "n't", 'never', 'no', 'neither', 'nor', 'barely', 'hardly',
];

export interface SentimentResult {
  score: number; // -1 to 1
  isFlagged: boolean;
  flagReasons: string[];
  matchedKeywords: { category: string; keyword: string }[];
  intensity: number; // 1-3
}

export function analyzeCommentSentiment(
  comment: RedditComment,
  rules?: DetectionRules,
): SentimentResult {
  const text = comment.body.toLowerCase();
  const matchedKeywords: { category: string; keyword: string }[] = [];
  let negativityScore = 0;

  // Use provided rules or default to all enabled
  const activeRules = rules || {
    brand_attack: true,
    product_hate: true,
    negative_sentiment: true,
    call_to_action_negative: true,
    competitor_push: true,
  };

  // Check each keyword category (only enabled ones)
  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    if (!activeRules[category as keyof DetectionRules]) continue;
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase().trim();
      if (keywordLower.length <= 3) {
        // Short keywords need word boundary matching
        const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
        if (regex.test(text)) {
          matchedKeywords.push({ category, keyword: keyword.trim() });
          negativityScore += getCategoryWeight(category);
        }
      } else {
        if (text.includes(keywordLower)) {
          // Check for negation before keyword
          const keywordIndex = text.indexOf(keywordLower);
          const beforeText = text.substring(Math.max(0, keywordIndex - 20), keywordIndex);
          const hasNegation = NEGATION_WORDS.some(neg => beforeText.includes(neg));
          if (!hasNegation) {
            matchedKeywords.push({ category, keyword: keyword.trim() });
            negativityScore += getCategoryWeight(category);
          }
        }
      }
    }
  }

  // Check intensity modifiers
  let intensityMod = 1;
  const matchedModifiers = INTENSITY_MODIFIERS.filter(mod => text.includes(mod));
  if (matchedModifiers.length >= 2) intensityMod = 1.5;
  else if (matchedModifiers.length >= 1) intensityMod = 1.2;

  // Factor in comment score (upvoted negative comments are more concerning)
  const scoreFactor = comment.score > 10 ? 1.3 : comment.score > 5 ? 1.1 : 1.0;

  // Calculate final score
  const rawScore = Math.min(negativityScore * intensityMod * scoreFactor, 10);
  const normalizedNegative = -1 * (rawScore / 10); // -1 to 0

  // Check positive patterns
  let positiveScore = 0;
  for (const { pattern, weight } of POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      positiveScore += weight;
    }
  }
  // Cap positive score at 1.0
  const normalizedPositive = Math.min(positiveScore, 1.0);

  // Combine: positive offsets negative
  // If no negative keywords and positive patterns found, score is positive
  // If negative keywords found, positive patterns can partially offset
  let finalScore: number;
  if (normalizedNegative < 0 && positiveScore > 0) {
    // Both positive and negative signals: reduce negative impact
    finalScore = normalizedNegative + (normalizedPositive * 0.5);
  } else if (normalizedNegative < 0) {
    finalScore = normalizedNegative;
  } else if (positiveScore > 0) {
    finalScore = normalizedPositive;
  } else {
    // Neutral: neither positive nor negative
    finalScore = 0;
  }

  finalScore = Math.max(-1, Math.min(1, finalScore));

  const isFlagged = matchedKeywords.length > 0;
  const flagReasons = [...new Set(matchedKeywords.map(m => m.category))];

  return {
    score: finalScore,
    isFlagged,
    flagReasons,
    matchedKeywords,
    intensity: rawScore > 6 ? 3 : rawScore > 3 ? 2 : 1,
  };
}

function getCategoryWeight(category: string): number {
  switch (category) {
    case 'call_to_action_negative': return 2.5;
    case 'brand_attack': return 2.0;
    case 'competitor_push': return 1.5;
    case 'product_hate': return 1.5;
    case 'negative_sentiment': return 1.0;
    default: return 1.0;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function calculatePostAlertLevel(
  comments: RedditComment[],
  rules?: DetectionRules,
): {
  level: AlertLevel;
  reasons: string[];
  flaggedCount: number;
} {
  const results = comments.map(c => analyzeCommentSentiment(c, rules));
  const flaggedResults = results.filter(r => r.isFlagged);
  const flaggedCount = flaggedResults.length;

  const reasons: string[] = [];
  let severityScore = 0;

  if (flaggedCount === 0) {
    return { level: 'safe', reasons: [], flaggedCount: 0 };
  }

  // Collect all unique flag reasons
  const allReasons = new Set(flaggedResults.flatMap(r => r.flagReasons));
  reasons.push(...allReasons);

  // Calculate severity based on flagged comments ratio and intensity
  const flaggedRatio = flaggedCount / comments.length;
  const avgIntensity = flaggedResults.reduce((sum, r) => sum + r.intensity, 0) / flaggedResults.length;
  const highIntensityCount = flaggedResults.filter(r => r.intensity >= 3).length;

  severityScore = flaggedRatio * 40 + avgIntensity * 20 + highIntensityCount * 10;

  // Check for call_to_action_negative - this is most dangerous
  if (allReasons.has('call_to_action_negative')) {
    severityScore += 20;
  }

  let level: AlertLevel;
  if (severityScore >= 60 || highIntensityCount >= 3) {
    level = 'critical';
  } else if (severityScore >= 40 || flaggedRatio >= 0.3) {
    level = 'high';
  } else if (severityScore >= 20 || flaggedRatio >= 0.15) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { level, reasons, flaggedCount };
}

export function getAlertLevelLabel(level: AlertLevel): string {
  switch (level) {
    case 'critical': return '严重';
    case 'high': return '高危';
    case 'medium': return '中等';
    case 'low': return '低危';
    case 'safe': return '安全';
  }
}

export function getAlertLevelColor(level: AlertLevel): string {
  switch (level) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-blue-400';
    case 'safe': return 'text-green-400';
  }
}

export function getAlertLevelBg(level: AlertLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500/20 border-red-500/50';
    case 'high': return 'bg-orange-500/20 border-orange-500/50';
    case 'medium': return 'bg-yellow-500/20 border-yellow-500/50';
    case 'low': return 'bg-blue-500/20 border-blue-500/50';
    case 'safe': return 'bg-green-500/20 border-green-500/50';
  }
}

export function getAlertLevelBadge(level: AlertLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-blue-500 text-white';
    case 'safe': return 'bg-green-500 text-white';
  }
}

// Optional: OpenAI-based analysis
export async function analyzeWithOpenAI(
  comment: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<{ score: number; reasons: string[]; isFlagged: boolean }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a brand reputation monitoring AI. Analyze the following Reddit comment about a brand/product. Determine if it contains hostile, negative, or potentially damaging sentiment toward the brand. Focus on: 1) Direct brand attacks 2) Product complaints 3) Calls to boycott/avoid 4) Competitor recommendations. Return a JSON object with: score (-1 to 1, where -1 is extremely hostile), reasons (array of detected issue categories), isFlagged (boolean).`
          },
          {
            role: 'user',
            content: comment,
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return {
      score: result.score,
      reasons: result.reasons,
      isFlagged: result.isFlagged,
    };
  } catch {
    return { score: 0, reasons: [], isFlagged: false };
  }
}
