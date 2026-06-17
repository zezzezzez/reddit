// Sentiment Analysis Engine v2
// 基于品牌实体检测 + 通用情感词兜底 + 关键词分类负面检测

import { RedditComment, AlertLevel, DetectionRules } from './types';

// ─── 硬性负面关键词分类 ─────────────────────────────────────────
// 品牌攻击、产品仇恨、号召抵制、竞品推捧等 — 命中即负面，最高优先级
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
    'fuck hisense', 'fucking hisense', 'damn hisense', 'shit hisense',
    'hisense sucks', 'hisense suck', 'hisense is shit', 'hisense is crap',
  ],
  product_hate: [
    'worst tv', 'terrible tv', 'horrible tv', 'awful tv', 'pathetic tv', 'garbage tv', 'trash tv',
    'junk tv', 'useless tv', 'broken out of box', 'defective tv', 'piece of crap', 'piece of shit',
    'hisense pos', 'hisense piece of crap', 'hisense piece of shit',
    'lemon tv', 'nightmare tv', 'complete disaster', 'total fail', 'total failure',
    'regret buying this tv', 'waste of money', 'returning this', 'sent it back',
    'went dark', 'screen went black', 'backlight failed', 'backlight failure',
    'died after', 'dead after', 'broke after', 'failed after', 'stopped working after',
    'flickering', 'flickers', 'lines on screen', 'color bleed', 'banding',
    'less than a year', 'within a year', 'after a few months',
  ],
  negative_sentiment: [
    'hate this tv', 'hate hisense', 'disgusting quality', 'outrageous', 'unacceptable quality',
    'fed up with hisense', 'sick of hisense', 'tired of hisense',
    'never again hisense', 'never buying hisense',
    'overpriced junk', 'not worth the money', 'total waste', 'deeply disappointed',
    'fuck', 'fucking', 'damn', 'shit', 'sucks', 'suck', 'crap',
    'hisense is bad', 'hisense is terrible', 'hisense is awful',
    'pissed off', 'so angry', 'so mad', 'furious',
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

// ─── 品牌实体关键词（用于情感极性映射）────────────────────────────
// 海信本品词
const HISENSE_KEYWORDS = [
  'hisense', '海信',
  'hisense tv', 'hisense smart tv', 'hisense television',
  'hisense miniled', 'hisense rgb', 'hisense gaming tv', 'hisense fire tv', 'hisense canvas',
  'ux', 'u9', 'u8', 'u7', 'u6', 'e7',
  'ur9sg', 'ur8sg', 'u8qg', 'u7sg', 'u6sf', 'e7fs', 'u6sf pro',
  'miniled', 'rgb', 'sky blue', 'canvas',
  'world cup', 'fifa 2026', 'world cup 2026', 'world cup tv',
];

// 竞品词
const COMPETITOR_KEYWORDS = [
  'samsung', 'sumsung', 'lg', 'tcl', 'sony', 'vizio',
  'x11l', 'mrgb95', 'mr95f', 'rm9l', 'xr90', 'r85h',
  'qm8l', 'xr70', 'qn80', 'qned92', 'qn70', 'qm64', 'qm6', 'qned84', 'p8l',
];

// ─── 通用正面情感词（兜底用，每个词 0.1 分）───────────────────────
const POSITIVE_EMOTION_WORDS = [
  'great', 'amazing', 'good', 'excellent', 'fantastic', 'wonderful', 'awesome',
  'love', 'like', 'enjoy', 'recommend', 'best', 'better', 'impressed', 'happy',
  'satisfied', 'pleased', 'solid', 'reliable', 'perfect', 'outstanding', 'beautiful',
  'stunning', 'crisp', 'sharp', 'vivid', 'nice', 'decent', 'reasonable',
  'no issues', 'no problems', 'no regrets', 'zero issues', 'zero problems',
  'worth it', 'happy with', 'works great', 'works well', 'works perfectly',
  'glad i bought', 'glad i got', 'glad i went with',
  'exceeded expectations', 'better than expected', 'pleasantly surprised',
  'couldn\'t be happier', 'couldnt be happier',
  'love it', 'love this', 'love my', 'love the',
  'good choice', 'great choice', 'solid choice', 'smart choice',
  'good purchase', 'great purchase', 'happy purchase',
  'would buy again', 'buy again', 'recommend it',
];

// ─── 通用负面情感词（兜底用，每个词 0.1 分）───────────────────────
const NEGATIVE_EMOTION_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike', 'regret',
  'disappointed', 'poor', 'broken', 'defective', 'junk', 'trash', 'garbage', 'crap',
  'avoid', 'skip', 'waste', 'problem', 'issues', 'fail', 'failed', 'failing', 'faulty',
  'unreliable', 'don\'t buy', 'do not buy', 'stay away', 'not worth',
  'piece of crap', 'piece of shit', 'piece of junk',
  'disaster', 'nightmare', 'scam', 'fraud', 'ripoff', 'rip off',
  'liar', 'cheat', 'cheating', 'unacceptable', 'outrageous', 'disgusting',
  'returning', 'sent back', 'returned it', 'taking back',
  'never again', 'won\'t buy', 'will not buy', 'wouldn\'t buy',
  'doesn\'t work', 'didn\'t work', 'not working', 'stopped working',
  'died', 'dead', 'bricked', 'broken',
  'fuck', 'fucking', 'damn', 'shit', 'sucks', 'suck',
  'dark', 'flickering', 'flickers', 'lines on screen',
  'pissed', 'angry', 'mad', 'furious',
  'less than a year', 'within a year', 'after a few months',
];

// ─── 基础正面正则模式（额外加分用）───────────────────────────────
const POSITIVE_PATTERNS = [
  { pattern: /\bhisense\b/i, weight: 0.15 },
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
  { pattern: /(?:highly |definitely |strongly |absolutely )?recommend (?:hisense|this tv|it|them)/i, weight: 0.45 },
  { pattern: /would (?:definitely |highly |strongly |absolutely )?recommend/i, weight: 0.4 },
  { pattern: /(?:i )?recommend (?:hisense|the hisense|this)/i, weight: 0.4 },
  { pattern: /best (?:tv|purchase|buy|value|deal) (?:i|ive|i\'ve) (?:ever|had|made)/i, weight: 0.5 },
  { pattern: /best (?:bang|value) for (?:the |your )?(?:buck|money|price)/i, weight: 0.45 },
  { pattern: /great (?:buy|deal|choice|option|pick)/i, weight: 0.4 },
  { pattern: /good (?:buy|deal|choice|option|pick)/i, weight: 0.35 },
  { pattern: /solid (?:buy|choice|option|pick|tv|purchase|value)/i, weight: 0.35 },
  { pattern: /(?:you |u )?(?:should|must|need to|have to|gotta) (?:get|buy|try|check out) (?:a |the |this )?hisense/i, weight: 0.45 },
  { pattern: /(?:go |look )?(?:check out|look at|try) hisense/i, weight: 0.35 },
  { pattern: /consider (?:hisense|a hisense|the hisense)/i, weight: 0.3 },
  { pattern: /hisense (?:is|would be) (?:a )?(?:good|great|solid|excellent|amazing|fantastic) (?:option|choice|pick|buy)/i, weight: 0.45 },
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
  { pattern: /couldn\'?t be (?:happier|more pleased|more satisfied)/i, weight: 0.5 },
  { pattern: /(?:great|good|amazing|fantastic|excellent|wonderful|awesome) (?:experience|product|purchase)/i, weight: 0.4 },
  { pattern: /hisense (?:over|instead of|rather than|vs|versus|compared to) (?:samsung|lg|sony|tcl|vizio)/i, weight: 0.4 },
  { pattern: /(?:switched?|changed?) (?:from|to) hisense/i, weight: 0.3 },
  { pattern: /hisense (?:beats?|wins?|is better than|outperforms?|worked better|lasted longer) /i, weight: 0.45 },
  { pattern: /picked hisense (?:over|instead)/i, weight: 0.4 },
  { pattern: /chose hisense/i, weight: 0.35 },
  { pattern: /(?:go with|would choose|would pick|r\'d go with) hisense/i, weight: 0.5 },
  { pattern: /hisense (?:worked|works) (?:better|well|great|perfectly)/i, weight: 0.45 },
  { pattern: /(?:better|more reliable|superior) (?:than|to) (?:my |their |)*(?:tcl|samsung|lg|sony|vizio)/i, weight: 0.35 },
];

// ─── 强度修饰词 ────────────────────────────────────────────────
const INTENSITY_MODIFIERS = [
  'very', 'extremely', 'absolutely', 'completely', 'totally',
  'utterly', 'incredibly', 'seriously', 'really', 'so',
  'fucking', 'damn', 'hell', 'super',
];

// ─── 否定词 ────────────────────────────────────────────────────
const NEGATION_WORDS = [
  'not', "n't", 'never', 'no', 'neither', 'nor', 'barely', 'hardly',
];

// ─── 辅助函数：关键词边界匹配 ────────────────────────────────────
function textHasKeyword(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // 短词需要词边界匹配
  if (lowerKeyword.length <= 3) {
    const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(lowerKeyword)}([^a-z0-9]|$)`, 'i');
    return regex.test(lowerText);
  }

  // 多词短语直接包含匹配
  return lowerText.includes(lowerKeyword);
}

function textHasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => textHasKeyword(text, k));
}

// ─── 辅助函数：通用情感词检测 ────────────────────────────────────
// 返回 0~1 的得分，每个词 +0.1
function detectGenericEmotion(text: string): { positive: number; negative: number } {
  const lowerText = text.toLowerCase();
  let pos = 0;
  let neg = 0;

  for (const word of POSITIVE_EMOTION_WORDS) {
    const lowerWord = word.toLowerCase();
    const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(lowerWord)}([^a-z0-9]|$)`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) pos += matches.length * 0.1;
  }

  for (const word of NEGATIVE_EMOTION_WORDS) {
    const lowerWord = word.toLowerCase();
    const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(lowerWord)}([^a-z0-9]|$)`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) neg += matches.length * 0.1;
  }

  return {
    positive: Math.min(pos, 1.0),
    negative: Math.min(neg, 1.0),
  };
}

// ─── 辅助函数：品牌附近情感检测 ──────────────────────────────────
// 检测品牌词附近（±60字符）是否有明显的正面/负面表达
function detectBrandContextSentiment(text: string): { hisensePositive: boolean; hisenseNegative: boolean; competitorPositive: boolean; competitorNegative: boolean } {
  const lowerText = text.toLowerCase();
  const result = {
    hisensePositive: false, hisenseNegative: false,
    competitorPositive: false, competitorNegative: false,
  };

  // 检测海信附近情感
  for (const kw of HISENSE_KEYWORDS) {
    const idx = lowerText.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const window = lowerText.substring(Math.max(0, idx - 60), Math.min(lowerText.length, idx + kw.length + 60));

    const hasPos = POSITIVE_EMOTION_WORDS.some(w => window.includes(w.toLowerCase()));
    const hasNeg = NEGATIVE_EMOTION_WORDS.some(w => window.includes(w.toLowerCase()));

    // 额外正面信号（强表达）
    const strongPos = /\b(love|amazing|excellent|fantastic|best|perfect|recommend)\b/i.test(window);
    // 额外负面信号（强表达）
    const strongNeg = /\b(hate|terrible|awful|worst|broken|defective|avoid|don\'t buy|scam)\b/i.test(window);

    if (hasPos || strongPos) result.hisensePositive = true;
    if (hasNeg || strongNeg) result.hisenseNegative = true;
  }

  // 检测竞品附近情感
  for (const kw of COMPETITOR_KEYWORDS) {
    const idx = lowerText.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const window = lowerText.substring(Math.max(0, idx - 60), Math.min(lowerText.length, idx + kw.length + 60));

    const hasPos = POSITIVE_EMOTION_WORDS.some(w => window.includes(w.toLowerCase()));
    const hasNeg = NEGATIVE_EMOTION_WORDS.some(w => window.includes(w.toLowerCase()));

    const strongPos = /\b(love|amazing|excellent|fantastic|best|perfect|recommend)\b/i.test(window);
    const strongNeg = /\b(hate|terrible|awful|worst|broken|defective|avoid|don\'t buy|scam)\b/i.test(window);

    if (hasPos || strongPos) result.competitorPositive = true;
    if (hasNeg || strongNeg) result.competitorNegative = true;
  }

  return result;
}

// ─── 接口 ──────────────────────────────────────────────────────
export interface SentimentResult {
  score: number; // -1 to 1
  isFlagged: boolean;
  flagReasons: string[];
  matchedKeywords: { category: string; keyword: string }[];
  intensity: number; // 1-3
}

// ─── 主函数：评论情感分析 ──────────────────────────────────────
export function analyzeCommentSentiment(
  comment: RedditComment,
  rules?: DetectionRules,
): SentimentResult {
  const text = comment.body.toLowerCase();
  const matchedKeywords: { category: string; keyword: string }[] = [];
  let negativityScore = 0;

  // 使用提供的规则或默认启用全部
  const activeRules = rules || {
    brand_attack: true,
    product_hate: true,
    negative_sentiment: true,
    call_to_action_negative: true,
    competitor_push: true,
  };

  // ── 1. 硬性负面关键词检测（最高优先级）────────────────────────
  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    if (!activeRules[category as keyof DetectionRules]) continue;
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase().trim();
      if (keywordLower.length <= 3) {
        const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
        if (regex.test(text)) {
          matchedKeywords.push({ category, keyword: keyword.trim() });
          negativityScore += getCategoryWeight(category);
        }
      } else {
        if (text.includes(keywordLower)) {
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

  // 强度修饰
  let intensityMod = 1;
  const matchedModifiers = INTENSITY_MODIFIERS.filter(mod => text.includes(mod));
  if (matchedModifiers.length >= 2) intensityMod = 1.5;
  else if (matchedModifiers.length >= 1) intensityMod = 1.2;

  // 点赞因子
  const scoreFactor = comment.score > 10 ? 1.3 : comment.score > 5 ? 1.1 : 1.0;

  const rawScore = Math.min(negativityScore * intensityMod * scoreFactor, 10);
  const normalizedNegative = -1 * (rawScore / 10); // -1 to 0

  // ── 2. 基础正面正则匹配（原有逻辑，用于增强正面得分）──────────
  let patternPositiveScore = 0;
  for (const { pattern, weight } of POSITIVE_PATTERNS) {
    if (pattern.test(text)) patternPositiveScore += weight;
  }
  patternPositiveScore = Math.min(patternPositiveScore, 1.0);

  // ── 3. 通用情感词检测（兜底，让更多评论拿到非零分）──────────
  const { positive: genPos, negative: genNeg } = detectGenericEmotion(text);

  // ── 4. 品牌附近情感检测（精准上下文）────────────────────────
  const brandContext = detectBrandContextSentiment(text);

  // ── 5. 品牌实体存在性检测 ───────────────────────────────────
  const hasHisense = textHasAnyKeyword(text, HISENSE_KEYWORDS);
  const hasCompetitor = textHasAnyKeyword(text, COMPETITOR_KEYWORDS);

  // ── 6. 综合计算最终情感得分 ─────────────────────────────────
  let finalScore: number;

  // 硬性负面命中 → 直接负面（最高优先级）
  if (normalizedNegative < 0) {
    finalScore = normalizedNegative;
  }
  // 仅提到海信本品
  else if (hasHisense && !hasCompetitor) {
    if (brandContext.hisensePositive && !brandContext.hisenseNegative) {
      // 海信 + 明确正面上下文 → 正面（确保超过 0.1）
      finalScore = Math.min(patternPositiveScore + genPos + 0.25, 1.0);
    } else if (brandContext.hisenseNegative && !brandContext.hisensePositive) {
      // 海信 + 明确负面上下文 → 负面
      finalScore = -Math.min(genNeg + 0.25, 1.0);
    } else if (genPos > genNeg) {
      // 整体偏正面 → 正面
      finalScore = Math.min(patternPositiveScore + genPos + 0.15, 1.0);
    } else if (genNeg > genPos) {
      finalScore = -Math.min(genNeg + 0.15, 1.0);
    } else if (patternPositiveScore > 0 && genNeg === 0) {
      // 无品牌情感上下文，但有基础正面模式且无负面信号 → 弱正面
      finalScore = Math.min(patternPositiveScore, 0.15);
    } else {
      finalScore = 0;
    }
  }
  // 仅提到竞品
  else if (!hasHisense && hasCompetitor) {
    if (brandContext.competitorPositive && !brandContext.competitorNegative) {
      // 竞品 + 明确正面上下文 → 负面（夸竞品 = 对海信不利）
      finalScore = -Math.min(patternPositiveScore + genPos + 0.25, 1.0);
    } else if (brandContext.competitorNegative && !brandContext.competitorPositive) {
      // 竞品 + 明确负面上下文 → 正面（骂竞品 = 对海信有利）
      finalScore = Math.min(genNeg + 0.25, 1.0);
    } else if (genPos > genNeg) {
      // 整体偏正面 → 负面（无海信，偏正面多半是夸竞品）
      finalScore = -Math.min(patternPositiveScore + genPos + 0.15, 1.0);
    } else if (genNeg > genPos) {
      finalScore = Math.min(genNeg + 0.15, 1.0);
    } else if (patternPositiveScore > 0 && genNeg === 0) {
      // 无竞品情感上下文，但有基础正面模式且无负面信号 → 弱正面（偏负面）
      finalScore = -Math.min(patternPositiveScore, 0.1);
    } else {
      finalScore = 0;
    }
  }
  // 同时提到海信和竞品（对比场景）
  else if (hasHisense && hasCompetitor) {
    if (brandContext.hisensePositive && !brandContext.competitorPositive) {
      finalScore = Math.min(patternPositiveScore + genPos + 0.15, 1.0);
    } else if (brandContext.competitorPositive && !brandContext.hisensePositive) {
      finalScore = -Math.min(patternPositiveScore + genPos + 0.15, 1.0);
    } else if (brandContext.hisenseNegative && !brandContext.competitorNegative) {
      finalScore = -Math.min(genNeg + 0.15, 1.0);
    } else if (brandContext.competitorNegative && !brandContext.hisenseNegative) {
      finalScore = Math.min(genNeg + 0.15, 1.0);
    } else if (genPos > genNeg) {
      finalScore = 0.1; // 对比场景偏正面 → 轻微正面（不确定夸谁）
    } else if (genNeg > genPos) {
      finalScore = -0.1; // 对比场景偏负面 → 轻微负面
    } else {
      finalScore = 0;
    }
  }
  // 无品牌提及 → 纯情感词判定
  else {
    if (genPos > 0 && genNeg === 0) {
      finalScore = Math.min(patternPositiveScore + genPos, 1.0); // 纯正面
    } else if (genNeg > 0 && genPos === 0) {
      finalScore = -Math.min(genNeg, 1.0); // 纯负面
    } else if (genPos > genNeg) {
      finalScore = Math.min(patternPositiveScore + genPos, 1.0) * 0.5; // 矛盾偏正面
    } else if (genNeg > genPos) {
      finalScore = -Math.min(genNeg, 1.0) * 0.5; // 矛盾偏负面
    } else {
      finalScore = 0; // 中性
    }
  }

  finalScore = Math.max(-1, Math.min(1, finalScore));

  const isFlagged = matchedKeywords.length > 0;
  const flagReasons = [...new Set(matchedKeywords.map(m => m.category))];

  return {
    score: parseFloat(finalScore.toFixed(2)),
    isFlagged,
    flagReasons,
    matchedKeywords,
    intensity: rawScore > 6 ? 3 : rawScore > 3 ? 2 : 1,
  };
}

// ─── 权重映射 ──────────────────────────────────────────────────
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
export function calcCommentInfluenceScore(score: number, sentimentScore: number): number {
  const likeWeight = Math.log10(Math.max(score, 1) + 1) * 5 + 1;
  return parseFloat((likeWeight * Math.abs(sentimentScore)).toFixed(2));
}

// ─── 帖子告警等级计算 ──────────────────────────────────────────
export function calculatePostAlertLevel(
  comments: RedditComment[],
  rules?: DetectionRules,
): {
  level: AlertLevel;
  reasons: string[];
  flaggedCount: number;
  totalInfluenceScore: number;
} {
  const results = comments.map(c => ({ comment: c, result: analyzeCommentSentiment(c, rules) }));
  const flaggedItems = results.filter(r => r.result.isFlagged);
  const flaggedCount = flaggedItems.length;

  if (flaggedCount === 0) {
    return { level: 'safe', reasons: [], flaggedCount: 0, totalInfluenceScore: 0 };
  }

  const allReasons = new Set(flaggedItems.flatMap(r => r.result.flagReasons));
  const reasons = [...allReasons];

  const totalInfluenceScore = flaggedItems.reduce((sum, { comment, result }) => {
    const influence = calcCommentInfluenceScore(comment.score, result.score);
    return sum + influence;
  }, 0);

  const hasCTA = allReasons.has('call_to_action_negative');

  let level: AlertLevel;
  if (totalInfluenceScore >= 5 || hasCTA) {
    level = 'critical';
  } else if (totalInfluenceScore > 0) {
    level = 'medium';
  } else {
    level = 'safe';
  }

  return { level, reasons, flaggedCount, totalInfluenceScore: parseFloat(totalInfluenceScore.toFixed(2)) };
}

// ─── 标签/颜色工具函数 ─────────────────────────────────────────
export function getAlertLevelLabel(level: AlertLevel): string {
  switch (level) {
    case 'critical': return '严重';
    case 'high': return '严重';
    case 'medium': return '中等';
    case 'low': return '安全';
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

// ─── OpenAI 分析（可选）────────────────────────────────────────
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
            content: `You are a brand reputation monitoring AI for Hisense. Analyze the Reddit comment. If it praises Hisense products, give a positive score. If it praises competitors (Samsung, LG, TCL, Sony, Vizio) over Hisense, give a negative score. If it attacks Hisense brand/products or calls for boycott, give a strongly negative score. Return JSON: {score: number (-1 to 1), reasons: string[], isFlagged: boolean}.`,
          },
          { role: 'user', content: comment },
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
