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
    'hisense pos', 'hisense piece of crap', 'hisense piece of shit', // 必须绑定品牌前缀
    'lemon tv', 'nightmare tv', 'complete disaster', 'total fail', 'total failure',
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
  // === 品牌直接推荐 ===
  { pattern: /\bhisense\b/i, weight: 0.15 }, // 提到品牌名本身给基础正面权重（配合其他正面词）
  { pattern: /love (?:my |this |the )?hisense/i, weight: 0.5 },
  { pattern: /hisense (?:is|has been|are|were) (?:great|amazing|excellent|awesome|fantastic|wonderful|incredible|outstanding|good|solid|reliable|worth it)/i, weight: 0.5 },
  { pattern: /really (?:like|enjoy|love|appreciate) (?:my |this |the )?(?:hisense|this tv|the tv)/i, weight: 0.4 },
  { pattern: /(?:bought|got|purchased|picked up) (?:a |the |my )?hisense/i, weight: 0.3 },
  { pattern: /hisense (?:tv|television|monitor|fridge|washing machine|appliance)/i, weight: 0.2 },
  { pattern: /my hisense/i, weight: 0.2 },
  { pattern: /get (?:a |the )?hisense/i, weight: 0.35 },
  { pattern: /go (?:with |for )?(?:a |the )?hisense/i, weight: 0.35 },
  { pattern: /hisense (?:all the way|ftw|for the win)/i, weight: 0.5 },
  { pattern: /team hisense/i, weight: 0.4 },

  // === 推荐购买 ===
  { pattern: /(?:highly |definitely |strongly |absolutely )?recommend (?:hisense|this tv|it|them)/i, weight: 0.45 },
  { pattern: /would (?:definitely |highly |strongly |absolutely )?recommend/i, weight: 0.4 },
  { pattern: /(?:i )?recommend (?:hisense|the hisense|this)/i, weight: 0.4 },
  { pattern: /best (?:tv|purchase|buy|value|deal) (?:i|ive|i've) (?:ever|had|made)/i, weight: 0.5 },
  { pattern: /best (?:bang|value) for (?:the |your )?(?:buck|money|price)/i, weight: 0.45 },
  { pattern: /great (?:buy|deal|choice|option|pick)/i, weight: 0.4 },
  { pattern: /good (?:buy|deal|choice|option|pick)/i, weight: 0.35 },
  { pattern: /solid (?:buy|choice|option|pick|tv|purchase|value)/i, weight: 0.35 },
  { pattern: /(?:you |u )?(?:should|must|need to|have to|gotta) (?:get|buy|try|check out) (?:a |the |this )?hisense/i, weight: 0.45 },
  { pattern: /(?:go |look )?(?:check out|look at|try) hisense/i, weight: 0.35 },
  { pattern: /consider (?:hisense|a hisense|the hisense)/i, weight: 0.3 },
  { pattern: /hisense (?:is|would be) (?:a )?(?:good|great|solid|excellent|amazing|fantastic) (?:option|choice|pick|buy)/i, weight: 0.45 },

  // === 产品好评 ===
  { pattern: /great (?:value|price|quality|picture|display|screen|image|color|sound|tv)/i, weight: 0.35 },
  { pattern: /good (?:value|price|quality|picture|display|screen|image|color|sound)/i, weight: 0.3 },
  { pattern: /excellent (?:picture|quality|tv|value|display|screen|image|color|sound)/i, weight: 0.4 },
  { pattern: /amazing (?:picture|quality|tv|value|display|screen|image|color|sound)/i, weight: 0.4 },
  { pattern: /fantastic (?:picture|quality|tv|display|screen|value)/i, weight: 0.4 },
  { pattern: /beautiful (?:picture|display|screen|image)/i, weight: 0.35 },
  { pattern: /stunning (?:picture|display|screen|image)/i, weight: 0.4 },
  { pattern: /crisp (?:picture|display|screen|image)/i, weight: 0.3 },
  { pattern: /sharp (?:picture|display|screen|image)/i, weight: 0.3 },
  { pattern: /vivid (?:colors?|picture|display)/i, weight: 0.3 },
  { pattern: /looks (?:great|amazing|beautiful|stunning|fantastic|crisp|sharp|good|nice)/i, weight: 0.3 },
  { pattern: /impressed (?:with|by)/i, weight: 0.35 },
  { pattern: /impressive/i, weight: 0.3 },
  { pattern: /worth (?:every |the )?(?:penny|cent|dollar|money|price)/i, weight: 0.4 },
  { pattern: /great (?:for the |at the |for )?(?:price|money|budget|cost)/i, weight: 0.4 },
  { pattern: /(?:very |super |really )?affordable/i, weight: 0.25 },
  { pattern: /budget(?: friendly| pick| option| choice)?/i, weight: 0.2 },
  { pattern: /no (?:regrets|issues|problems|complaints)/i, weight: 0.3 },
  { pattern: /zero (?:issues|problems|complaints)/i, weight: 0.3 },
  { pattern: /works (?:great|perfectly|flawlessly|well|fine)/i, weight: 0.35 },
  { pattern: /works (?:like a )?charm/i, weight: 0.35 },
  { pattern: /setup (?:was )?(?:easy|simple|quick|straightforward)/i, weight: 0.25 },
  { pattern: /easy (?:to |to )?(?:set up|setup|install|use)/i, weight: 0.25 },

  // === 满意度表达 ===
  { pattern: /very (?:happy|pleased|satisfied|impressed)/i, weight: 0.4 },
  { pattern: /(?:super|really|so|extremely) (?:happy|pleased|satisfied|impressed)/i, weight: 0.4 },
  { pattern: /happy (?:with|about) (?:my |this |the )?(?:purchase|tv|hisense|product)/i, weight: 0.4 },
  { pattern: /glad i (?:bought|got|purchased|went with)/i, weight: 0.4 },
  { pattern: /love it/i, weight: 0.4 },
  { pattern: /love (?:the|this|my) (?:tv|product|purchase|hisense)/i, weight: 0.45 },
  { pattern: /exceeded (?:my |the )?expectations/i, weight: 0.45 },
  { pattern: /better than expected/i, weight: 0.4 },
  { pattern: /pleasantly surprised/i, weight: 0.4 },
  { pattern: /(?:so |very |really )?satisfied/i, weight: 0.35 },
  { pattern: /couldn'?t be (?:happier|more pleased|more satisfied)/i, weight: 0.5 },
  { pattern: /(?:great|good|amazing|fantastic|excellent|wonderful|awesome) (?:experience|product|purchase)/i, weight: 0.4 },

  // === 对比其他品牌中推荐海信 ===
  { pattern: /hisense (?:over|instead of|rather than|vs|versus|compared to) (?:samsung|lg|sony|tcl|vizio)/i, weight: 0.4 },
  { pattern: /(?:switched?|changed?) (?:from|to) hisense/i, weight: 0.3 },
  { pattern: /hisense (?:beats?|wins?|is better than|outperforms?|worked better|lasted longer) /i, weight: 0.45 },
  { pattern: /picked hisense (?:over|instead)/i, weight: 0.4 },
  { pattern: /chose hisense/i, weight: 0.35 },
  { pattern: /(?:go with|would choose|would pick|r'd go with) hisense/i, weight: 0.5 }, // "I'd go with them"
  { pattern: /hisense (?:worked|works) (?:better|well|great|perfectly)/i, weight: 0.45 },
  { pattern: /(?:better|more reliable|superior) (?:than|to) (?:my |their |)*(?:tcl|samsung|lg|sony|vizio)/i, weight: 0.35 },
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

  // Combine: negative takes priority
  // If negative keywords found, always use negative score (positive cannot offset)
  // Only use positive score when there are NO negative signals
  let finalScore: number;
  if (normalizedNegative < 0) {
    // Has negative signal: always negative, positive is ignored
    finalScore = normalizedNegative;
  } else if (positiveScore > 0) {
    // No negative signal, has positive signal: positive
    finalScore = normalizedPositive;
  } else {
    // Neither: neutral
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

// ─── 影响力得分计算（单条评论）───────────────────────────────────
// 公式：influenceScore = (log10(max(score, 1) + 1) * 5 + 1) * |sentimentScore|
// - 点赞数取 log10 压缩量级，避免高赞评论一票定胜负
// - 再乘以情感强度（|sentimentScore|），仅对负面评论有实际意义
// - 基础值 +1 保证 score=0 的评论也有最低得分
// 返回值范围：约 0.0 ~ 20.0
export function calcCommentInfluenceScore(score: number, sentimentScore: number): number {
  const likeWeight = Math.log10(Math.max(score, 1) + 1) * 5 + 1;
  return parseFloat((likeWeight * Math.abs(sentimentScore)).toFixed(2));
}

export function calculatePostAlertLevel(
  comments: RedditComment[],
  rules?: DetectionRules,
): {
  level: AlertLevel;
  reasons: string[];
  flaggedCount: number;
  totalInfluenceScore: number; // 所有恶意评论影响力得分之和
} {
  const results = comments.map(c => ({ comment: c, result: analyzeCommentSentiment(c, rules) }));
  const flaggedItems = results.filter(r => r.result.isFlagged);
  const flaggedCount = flaggedItems.length;

  if (flaggedCount === 0) {
    return { level: 'safe', reasons: [], flaggedCount: 0, totalInfluenceScore: 0 };
  }

  // 收集所有告警类型
  const allReasons = new Set(flaggedItems.flatMap(r => r.result.flagReasons));
  const reasons = [...allReasons];

  // 计算每条恶意评论的影响力得分，累加得到总分
  const totalInfluenceScore = flaggedItems.reduce((sum, { comment, result }) => {
    const influence = calcCommentInfluenceScore(comment.score, result.score);
    return sum + influence;
  }, 0);

  // ─── 三级判定阈值 ───────────────────────────────────────────
  // 严重（critical）：总影响力 >= 5 或存在号召抵制类评论
  // 中等（medium）：  总影响力 > 0 且 < 5
  // 安全（safe）：    总影响力 = 0（无恶意评论）
  let level: AlertLevel;
  const hasCTA = allReasons.has('call_to_action_negative');

  if (totalInfluenceScore >= 5 || hasCTA) {
    level = 'critical';
  } else if (totalInfluenceScore > 0) {
    level = 'medium';
  } else {
    level = 'safe';
  }

  return { level, reasons, flaggedCount, totalInfluenceScore: parseFloat(totalInfluenceScore.toFixed(2)) };
}

export function getAlertLevelLabel(level: AlertLevel): string {
  switch (level) {
    case 'critical': return '严重';
    case 'high': return '严重';   // 兼容旧数据
    case 'medium': return '中等';
    case 'low': return '安全';    // 兼容旧数据
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
