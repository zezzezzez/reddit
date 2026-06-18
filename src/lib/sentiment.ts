// Sentiment Analysis Engine v2
// 基于品牌实体检测 + 通用情感词兜底 + 关键词分类负面检测

import { RedditComment, AlertLevel, DetectionRules } from './types';

// ─── 硬性负面关键词分类 ─────────────────────────────────────────
// 品牌攻击、产品仇恨、号召抵制、竞品推捧等 — 命中即负面，最高优先级
export const KEYWORD_CATEGORIES = {
  brand_attack: [
    // ── 品牌辱骂 ──
    'worst brand', 'garbage company', 'trash company', 'shit company', 'crap company',
    'fuck hisense', 'fucking hisense', 'damn hisense', 'shit hisense', 'shitty hisense',
    'hisense sucks', 'hisense suck', 'hisense is shit', 'hisense is crap', 'hisense is shitty',
    'hisense is a joke', 'hisense is pathetic', 'hisense is a disaster', 'hisense is a nightmare',
    'hisense is worthless', 'hisense is useless', 'hisense is hopeless', 'hisense is a ripoff',
    'hisense fucked up', 'hisense screwed up', 'hisense messed up', 'hisense botched',
    'fucked up hisense', 'screwed up hisense', 'messed up hisense',
    // ── 品牌抵制 ──
    'boycott', 'boycott hisense',
    'never buy hisense', 'never buying hisense', 'never bought hisense',
    'stay away from hisense', 'do not buy hisense', "don't buy hisense", 'dont buy hisense',
    'wouldn\'t buy hisense', 'won\'t buy hisense', 'will not buy hisense',
    'ripoff', 'rip off', 'hisense ripoff', 'hisense rip off',
    'hisense scam', 'hisense fraud', 'hisense liar',
    'hisense is lying', 'hisense lies',
    'hisense cheat', 'hisense cheating',
    'hisense steal', 'hisense stealing', 'hisense stolen',
    'hisense thief', 'hisense thieves',
    'hisense deceptive', 'hisense misleading',
    'hisense unethical', 'hisense corrupt', 'hisense dishonest',
    // ── 引战/水军指控 ──
    'hisense shill', 'hisense shills', 'hisense bot', 'hisense bots',
    'hisense fanboy', 'hisense fanboys', 'hisense astroturf',
    'paid by hisense', 'hisense paid shill', 'hisense marketing team',
    'shill for hisense', 'shilling for hisense',
  ],
  product_hate: [
    // ── 产品整体贬低 ──
    'worst tv', 'terrible tv', 'horrible tv', 'awful tv', 'pathetic tv', 'garbage tv', 'trash tv',
    'junk tv', 'useless tv', 'broken out of box', 'defective tv', 'piece of crap', 'piece of shit',
    'hisense pos', 'hisense piece of crap', 'hisense piece of shit', 'hisense piece of junk',
    'lemon tv', 'nightmare tv', 'complete disaster', 'total fail', 'total failure',
    'regret buying this tv', 'waste of money', 'returning this', 'sent it back',
    'cheap tv', 'cheaply made', 'poorly made', 'flimsy', 'toy tv', 'plastic junk',
    'falling apart', 'barely works', 'hardly works', 'barely functions',
    // ── 显示问题 ──
    'went dark', 'screen went black', 'backlight failed', 'backlight failure',
    'black screen', 'no picture', 'blank screen', 'dim screen',
    'burn in', 'burn-in', 'image retention', 'screen burn',
    'clouding', 'cloudy screen', 'dirty screen', 'dse', 'dirty screen effect',
    'blooming', 'halo effect', 'light bleed', 'bleeding',
    'flickering', 'flickers', 'lines on screen', 'color bleed', 'banding',
    'motion blur', 'judder', 'stutter', 'screen tearing',
    'oversaturated', 'washed out', 'muddy colors', 'color inaccuracy',
    'grey instead of black', 'crushed blacks', 'raised blacks',
    // ── 故障描述 ──
    'died after', 'dead after', 'broke after', 'failed after', 'stopped working after',
    'died on me', 'died within', 'died in', 'died suddenly',
    'quit working', 'quit on me', 'gave up', 'gave out',
    'won\'t turn on', 'won\'t power on', 'no power', 'dead pixel', 'dead pixels',
    'stuck pixel', 'stuck pixels',
    'overheating', 'too hot', 'gets hot', 'burning smell', 'smells like burning',
    'buzzing sound', 'coil whine', 'high pitched noise', 'fan noise',
    // ── 软件/系统问题 ──
    'laggy', 'slow ui', 'buggy', 'crashes', 'freezes', 'frozen',
    'unresponsive', 'input lag', 'latency issue', 'delay',
    'apps crash', 'apps freeze', 'remote doesn\'t work', 'remote stopped working',
    'wifi disconnects', 'bluetooth issues', 'can\'t connect',
    // ── 时间维度（寿命短） ──
    'less than a year', 'within a year', 'after a few months',
    'already broke', 'already dead', 'already failed', 'didn\'t last',
    'lasted a month', 'lasted two months', 'lasted a week',
    // ── 音质问题 ──
    'tinny sound', 'tinny audio', 'quiet speakers', 'no bass', 'weak speakers',
    'sound is crap', 'audio is terrible', 'sound cuts out', 'audio dropout',
  ],
  negative_sentiment: [
    // ── 直接指向海信的负面表达 ──
    'hate this tv', 'hate hisense', 'hate the hisense',
    'fed up with hisense', 'sick of hisense', 'tired of hisense',
    'never again hisense', 'never buying hisense',
    'hisense is bad', 'hisense is terrible', 'hisense is awful',
    'hisense is horrible', 'hisense is pathetic', 'hisense is disgusting',
    // ── 质疑/嘲讽（明确指向海信） ──
    'who buys hisense', 'who would buy hisense',
    // ── 强表达（明确购买后悔） ──
    'overpriced junk', 'not worth the money', 'deeply disappointed',
    'so disappointed', 'very disappointed', 'extremely disappointed',
  ],
  call_to_action_negative: [
    // ── 直接劝阻 ──
    "don't buy hisense", 'avoid hisense', 'stay away from hisense',
    'do not recommend hisense', 'not recommended hisense',
    'steer clear', 'steer clear of hisense',
    'don\'t waste your money', 'don\'t waste your time',
    'save yourself', 'save your money',
    'run away', 'run away from hisense',
    'don\'t bother', 'not worth it',
    // ── 号召行动 ──
    'boycott hisense', 'class action', 'sue hisense', 'lawsuit hisense',
    'report them', 'file a complaint', 'contact bbb',
    'spread the word', 'warning about hisense',
    'get a refund', 'demand refund', 'demand a refund',
    'return it', 'send it back', 'take it back',
    'exchange it', 'get your money back',
    // ── 劝退替代 ──
    'just don\'t', 'please don\'t', 'whatever you do',
    'learn from my mistake', 'don\'t make my mistake',
  ],
  competitor_push: [
    // ── 直接推荐竞品 ──
    'get samsung instead', 'buy lg instead', 'sony is better', 'get a samsung',
    'switch to lg', 'go with sony', 'tcl is better', 'go with tcl',
    'get a lg', 'buy a sony', 'get a tcl',
    'samsung all the way', 'lg all the way', 'sony all the way', 'tcl all the way',
    'samsung wins', 'lg wins', 'sony wins', 'tcl wins',
    // ── 贬低海信+推竞品 ──
    'hisense sucks', 'hisense is trash', 'hisense is garbage', 'hisense is worst',
    'anyone but hisense', 'avoid hisense', 'skip hisense',
    'hisense can\'t compete', 'hisense doesn\'t compare',
    'hisense is no match', 'not even close to',
    // ── 具体对比推荐 ──
    'samsung is miles ahead', 'lg is miles ahead', 'sony is miles ahead',
    'samsung crushes', 'lg crushes', 'sony crushes',
    'just buy samsung', 'just buy lg', 'just buy sony', 'just buy tcl',
    'go for samsung', 'go for lg', 'go for sony', 'go for tcl',
    'opt for samsung', 'opt for lg', 'opt for sony', 'opt for tcl',
    // ── 品牌粉丝站队 ──
    'team samsung', 'team lg', 'team sony', 'team tcl',
    'samsung ftw', 'lg ftw', 'sony ftw', 'tcl ftw',
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
  // ── 核心正面形容词 ──
  'great', 'amazing', 'good', 'excellent', 'fantastic', 'wonderful', 'awesome',
  'superb', 'marvelous', 'phenomenal', 'terrific', 'splendid', 'fabulous',
  'incredible', 'outstanding', 'exceptional', 'magnificent', 'spectacular',
  'top notch', 'top-notch', 'first rate', 'first-rate', 'high quality',
  'premium', 'superior', 'flawless', 'perfect', 'impeccable',
  'lovely', 'delightful', 'charming', 'pleasant', 'enjoyable',
  'nice', 'decent', 'reasonable', 'fair', 'acceptable', 'fine',
  'solid', 'steady', 'stable', 'consistent', 'dependable', 'reliable',
  // ── 喜爱/欣赏动词 ──
  'love', 'like', 'enjoy', 'adore', 'admire', 'appreciate', 'cherish',
  'fancy', 'prefer', 'favor', 'advocate', 'endorse', 'praise',
  // ── 推荐/支持 ──
  'recommend', 'suggest', 'promote', 'advocate', 'endorse', 'vouch for',
  'highly recommend', 'strongly recommend', 'definitely recommend',
  'must buy', 'must get', 'must have', 'should buy', 'should get',
  'would recommend', 'would suggest', 'would advise',
  'buy it', 'get it', 'go for it', 'do it',
  // ── 比较级正面 ──
  'best', 'better', 'superior', 'unbeatable', 'unmatched', 'unrivaled',
  'second to none', 'in a league of its own', 'head and shoulders above',
  'blows away', 'destroys', 'crushes', 'wipes the floor',
  // ── 满意度 ──
  'satisfied', 'pleased', 'content', 'fulfilled',
  'happy', 'glad', 'cheerful', 'joyful', 'delighted', 'thrilled',
  'overjoyed', 'ecstatic', 'elated', 'euphoric',
  'very happy', 'so happy', 'really happy', 'extremely happy',
  'very pleased', 'so pleased', 'really pleased',
  'very satisfied', 'so satisfied', 'really satisfied',
  'couldn\'t be happier', 'couldnt be happier', 'could not be happier',
  // ── 惊喜/超预期 ──
  'impressed', 'blown away', 'mind blown', 'speechless',
  'exceeded expectations', 'beyond expectations', 'above expectations',
  'better than expected', 'better than anticipated',
  'pleasantly surprised', 'nicely surprised', 'happily surprised',
  'surprised how good', 'surprised by how',
  // ── 产品好评 ──
  'bright', 'clear', 'clean', 'smooth', 'responsive', 'fast', 'quick',
  'snappy', 'zippy', 'fluid', 'seamless', 'effortless',
  'rich colors', 'deep blacks', 'bright screen', 'vibrant',
  'loud', 'powerful sound', 'booming', 'thumping bass',
  'slim', 'sleek', 'elegant', 'stylish', 'modern', 'minimalist',
  'lightweight', 'thin bezel', 'thin bezels',
  'intuitive', 'user friendly', 'easy to use', 'simple to use',
  'straightforward', 'hassle free', 'hassle-free',
  // ── 使用体验 ──
  'comfortable', 'convenient', 'effortless', 'smooth experience',
  'no issues', 'no problems', 'no regrets', 'no complaints',
  'zero issues', 'zero problems', 'zero complaints',
  'nothing bad', 'nothing wrong', 'no downside',
  'works great', 'works well', 'works perfectly', 'works flawlessly',
  'works like a charm', 'works like magic',
  'running great', 'running well', 'running smoothly',
  'holding up well', 'holding up great',
  // ── 购买体验 ──
  'worth it', 'worth every penny', 'worth the money', 'worth the price',
  'great value', 'amazing value', 'incredible value', 'unbeatable value',
  'bang for buck', 'bang for your buck',
  'great deal', 'amazing deal', 'fantastic deal', 'steal', 'bargain',
  'good price', 'fair price', 'reasonable price', 'affordable price',
  'cheap for what', 'inexpensive', 'budget friendly', 'budget-friendly',
  'happy with', 'satisfied with', 'pleased with',
  'glad i bought', 'glad i got', 'glad i went with', 'glad i picked',
  'glad i chose', 'glad i purchased',
  'no buyer remorse', 'no buyers remorse', 'no remorse',
  // ── 复购/推荐意愿 ──
  'would buy again', 'would purchase again', 'would get again',
  'buy again', 'purchase again', 'get again',
  'buy another', 'get another', 'buying another',
  'recommend it', 'recommend this', 'recommend to', 'recommend for',
  'good choice', 'great choice', 'solid choice', 'smart choice', 'wise choice',
  'good purchase', 'great purchase', 'happy purchase', 'wise purchase',
  'good decision', 'great decision', 'smart decision', 'wise decision',
  // ── 时间维度（耐用） ──
  'still works', 'still going', 'still running', 'still strong',
  'going strong', 'running strong', 'holding strong',
  'years later', 'after years', 'after all this time',
  'long lasting', 'long-lasting', 'durable', 'sturdy', 'robust',
  // ── 服务/人际友好表达 ──
  'helpful', 'really helpful', 'super helpful', 'incredibly helpful',
  'extremely helpful', 'very helpful', 'so helpful',
  'helps a lot', 'really helps', 'helps me a lot',
  'works great', 'works well', 'works perfectly', 'works fine', 'works flawlessly',
  'great option', 'great feature', 'good option', 'good feature',
  'love this option', 'love this feature', 'awesome feature',
  'kind', 'friendly', 'professional', 'attentive', 'knowledgeable',
  'patient', 'responsive', 'courteous', 'polite',
  'efficient', 'quick response', 'fast response', 'prompt response',
  'thank you', 'thanks', 'appreciate', 'appreciated', 'grateful',
  // ── 俚语/强调型正面表达（“fucking” 作为强调副词 + 正面词）──
  'beast', 'absolute beast', 'a beast', 'an absolute beast',
  'monster', 'a monster', 'killer',
  'congrats', 'congratulations', 'congratz',
  'banger', 'fire', 'goated', 'top tier', 'top-tier', 's tier', 's-tier',
  // ── 强烈购买意愿/偏好表达 ──
  'checks all my boxes', 'checks the boxes', 'ticks all the boxes',
  "i'm buying", 'im buying', 'going to buy', 'gonna buy', 'about to buy',
  "i'll buy it", 'will buy it', 'definitely buying', 'definitely getting',
  'sold on it', 'sold me on',
  // ── 比较/超越竞品（中性词，正面语义）──
  'outshines', 'outshine', 'outperforms', 'outperform', 'outclasses', 'outclass',
  'beats', 'destroys the competition', 'leaves behind',
  // ── 反例/转折正面表达 ──
  'opposite experience', 'positive experience', 'great experience',
  'good experience', 'wonderful experience', 'pleasant experience',
  'no issue', 'mine works', 'mine has been', 'mine is fine',
  'smooth process', 'hassle free experience', 'hassle-free experience',
  // ── 售后服务正面 ──
  'great support', 'good support', 'amazing support', 'excellent support',
  'great customer service', 'good customer service', 'amazing customer service',
  'great warranty', 'honored warranty', 'replaced under warranty',
  'refunded', 'full refund', 'quick refund',
];

// ─── 通用负面情感词（兜底用，每个词 0.1 分）───────────────────────
const NEGATIVE_EMOTION_WORDS = [
  // ── 核心负面形容词 ──
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'atrocious', 'abysmal',
  'pathetic', 'pitiful', 'dreadful', 'deplorable', 'appalling', 'ghastly',
  'lousy', 'crummy', 'rotten', 'sucky',
  'mediocre', 'subpar', 'below average', 'below par', 'second rate', 'second-rate',
  'cheap', 'cheesy', 'tacky', 'flimsy', 'shoddy', 'shabby', 'rattly',
  'unacceptable', 'unsatisfactory', 'inadequate', 'insufficient', 'deficient',
  // ── 厌恶/反感动词 ──
  'hate', 'dislike', 'despise', 'loathe', 'detest', 'abhor',
  'regret', 'resent', 'mourn', 'lament',
  // ── 失望/不满 ──
  'disappointed', 'disappointing', 'underwhelming', 'underwhelmed',
  'frustrated', 'frustrating', 'irritated', 'irritating',
  'annoyed', 'annoying', 'aggravated', 'aggravating',
  'bothered', 'bothering', 'disturbed', 'disturbing',
  'concerned', 'concerning', 'worried', 'worrying', 'alarming',
  'confused', 'confusing', 'puzzled', 'puzzling',
  'skeptical', 'dubious', 'questionable', 'suspicious',
  'fed up', 'had enough', 'can\'t stand', 'can\'t bear', 'can\'t tolerate',
  'sick and tired', 'tired of', 'done with', 'over it',
  // ── 愤怒/辱骂 ──
  'pissed', 'pissed off', 'so angry', 'so mad', 'furious', 'enraged',
  'irritated', 'annoyed', 'frustrated', 'aggravated',
  'fuck', 'fucking', 'fucked', 'damn', 'shit', 'shitty', 'sucks', 'suck', 'sucked',
  // 注：单独的 'crap' 多义（"remove the crap"、"holy crap"惊叹、"no crap"=“真的”），该字易误判；
  // 仅保留单义负面的 crappy/craptastic，'piece of crap' 由 product_hate 硬关键词接管
  'crappy', 'craptastic', 'bullshit', 'bull shit', 'bs',
  'ass', 'asshole', 'dick', 'douche', 'moron', 'idiot', 'stupid',
  'garbage', 'trash', 'junk', 'rubbish', 'sewage',
  // ── 产品质量 ──
  'poor', 'broken', 'defective', 'faulty', 'flawed', 'imperfect',
  'damaged', 'scratched', 'dented', 'chipped', 'cracked',
  'worn out', 'worn-out', 'wearing out', 'deteriorating',
  'falling apart', 'coming apart', 'barely works', 'hardly works',
  'unreliable', 'unstable', 'inconsistent', 'erratic', 'unpredictable',
  'glitchy', 'buggy', 'quirky', 'finicky', 'temperamental',
  'sluggish', 'slow', 'laggy', 'delayed', 'unresponsive',
  // ── 故障描述 ──
  'fail', 'failed', 'failing', 'failure', 'malfunction', 'breakdown',
  'died', 'dead', 'bricked', 'fried', 'toasted', 'cooked',
  'burned out', 'burned up', 'blew up', 'exploded',
  'quit', 'quit working', 'quit on me', 'gave up', 'gave out',
  'stopped', 'ceased', 'halted', 'cut out', 'shut off',
  'won\'t turn on', 'won\'t power on', 'no power', 'not powering',
  'not charging', 'won\'t charge',
  'doesn\'t work', 'didn\'t work', 'not working', 'stopped working',
  'not responding', 'not detected', 'not recognized',
  'overheating', 'too hot', 'gets hot', 'burning smell', 'smells like burning',
  'buzzing', 'humming', 'whining', 'clicking', 'popping',
  'leaking', 'oozing', 'smoking', 'sparking',
  // ── 显示/画质问题 ──
  'dark', 'dim', 'faint', 'dull', 'muddy', 'washed out', 'washed-out',
  'flickering', 'flickers', 'flashing', 'strobing', 'pulsing',
  'blurry', 'blurred', 'out of focus', 'soft', 'grainy', 'noisy',
  'pixelated', 'blocky', 'compressed', 'artifact', 'artifacts',
  'screen tearing', 'tearing', 'judder', 'stutter', 'stuttering',
  'motion blur', 'ghosting', 'trailing', 'smearing',
  'color bleed', 'bleeding', 'banding', 'posterization',
  'oversaturated', 'undersaturated', 'washed out', 'muddy colors',
  'grey blacks', 'grey instead of black', 'crushed blacks', 'raised blacks',
  'backlight bleed', 'light bleed', 'clouding', 'dirty screen',
  'burn in', 'burn-in', 'image retention', 'screen burn',
  'dead pixel', 'dead pixels', 'stuck pixel', 'stuck pixels',
  'lines on screen', 'horizontal lines', 'vertical lines',
  'no picture', 'blank screen', 'black screen',
  // ── 声音问题 ──
  'no sound', 'no audio', 'silent', 'muted',
  'tinny', 'hollow', 'muffled', 'distorted', 'crackling',
  'quiet', 'too quiet', 'low volume', 'can\'t hear',
  'audio lag', 'lip sync', 'out of sync', 'audio delay',
  'sound cuts out', 'audio dropout', 'intermittent audio',
  // ── 售后/服务 ──
  'useless support', 'rude support', 'ignored me', 'hung up',
  'useless warranty', 'warranty denied', 'warranty refused',
  'rude customer service', 'terrible customer service',
  'unhelpful', 'no help', 'waste of time',
  // ── 购买劝阻 ──
  'avoid', 'skip', 'stay away', 'don\'t buy', 'do not buy', 'not worth',
  'waste', 'waste of money', 'waste of time', 'money pit',
  'overpriced', 'too expensive', 'too pricey', 'not affordable',
  'rip off', 'ripoff', 'scam', 'fraud', 'con', 'hoax',
  'returning', 'sent back', 'returned it', 'taking back', 'exchanged',
  'never again', 'won\'t buy', 'will not buy', 'wouldn\'t buy', 'would not buy',
  // ── 时间维度（寿命短） ──
  'less than a year', 'within a year', 'after a few months',
  'already broke', 'already dead', 'already failed', 'didn\'t last',
  'lasted a month', 'lasted two months', 'lasted a week',
  'short lived', 'short-lived', 'not durable', 'not lasting',
  // ── 嘲讽/质疑 ──
  'joke', 'laughable', 'ridiculous', 'absurd', 'preposterous',
  'what a joke', 'such a joke', 'complete joke',
  'should have known', 'knew better', 'told you so',
  'how is this legal', 'how do they get away', 'who approved this',
  'expected better', 'deserves better', 'can do better',
];

// ─── 基础正面正则模式（额外加分用）───────────────────────────────
const POSITIVE_PATTERNS = [
  // ═══════════════════════════════════════════════════════════════
  // === 品牌直接提及与推荐 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /\bhisense\b/i, weight: 0.1 },
  // 俚语强调型正面（fucking BEAST / absolute beast）
  { pattern: /\bfuckin[g'’]? (?:beast|monster|amazing|awesome|great|good|incredible|fantastic|perfect|love|best|legend|killer|fire|sick|dope|insane|brilliant|smart)\b/i, weight: 0.5 },
  { pattern: /\b(?:absolute|total|complete) (?:beast|monster|legend|gem|banger|tank|workhorse)\b/i, weight: 0.5 },
  { pattern: /\bbeen (?:a |an )?(?:beast|monster|legend|champ|tank|workhorse|dream)\b/i, weight: 0.45 },
  { pattern: /\bhell yeah\b/i, weight: 0.4 },
  { pattern: /\bgoated\b/i, weight: 0.4 },
  // 反讽/反驳底下黑（don't get the hate / ignore the haters）
  { pattern: /(?:don['’]?t|do not|dont) (?:get|believe|buy|listen to|fall for) (?:the |all |into )?(?:hisense )?hate/i, weight: 0.5 },
  { pattern: /ignore (?:the |all )?(?:hisense )?hate(?:rs)?/i, weight: 0.4 },
  // 祝贺
  { pattern: /\bcongrats?\b/i, weight: 0.3 },
  { pattern: /\bcongratulations\b/i, weight: 0.35 },
  { pattern: /love (?:my |this |the )?hisense/i, weight: 0.5 },
  { pattern: /adore (?:my |this |the )?hisense/i, weight: 0.5 },
  { pattern: /hisense (?:is|has been|are|were) (?:great|amazing|excellent|awesome|fantastic|wonderful|incredible|outstanding|good|solid|reliable|worth it|superb|phenomenal|terrific)/i, weight: 0.5 },
  { pattern: /hisense (?:is|has been|are|were) (?:a )?(?:great|amazing|excellent|solid|reliable|fantastic|perfect) (?:brand|company|tv|product|choice|option|buy)/i, weight: 0.5 },
  { pattern: /really (?:like|enjoy|love|appreciate) (?:my |this |the )?(?:hisense|this tv|the tv|it)/i, weight: 0.4 },
  { pattern: /(?:bought|got|purchased|picked up|ordered) (?:a |the |my )?hisense/i, weight: 0.3 },
  { pattern: /hisense (?:tv|television|monitor|display|screen)/i, weight: 0.15 },
  { pattern: /my hisense/i, weight: 0.15 },
  { pattern: /our hisense/i, weight: 0.15 },
  { pattern: /get (?:a |the )?hisense/i, weight: 0.35 },
  { pattern: /go (?:with |for )?(?:a |the )?hisense/i, weight: 0.35 },
  { pattern: /hisense (?:all the way|ftw|for the win)/i, weight: 0.5 },
  { pattern: /team hisense/i, weight: 0.4 },
  { pattern: /hisense fan/i, weight: 0.3 },
  { pattern: /hisense (?:owner|user|customer)/i, weight: 0.15 },

  // ═══════════════════════════════════════════════════════════════
  // === 推荐购买 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /(?:highly |definitely |strongly |absolutely )?recommend (?:hisense|this tv|it|them|the|one)/i, weight: 0.45 },
  { pattern: /would (?:definitely |highly |strongly |absolutely )?recommend/i, weight: 0.4 },
  { pattern: /(?:i )?recommend (?:hisense|the hisense|this|getting|buying)/i, weight: 0.4 },
  { pattern: /(?:you |u )?(?:should|must|need to|have to|gotta) (?:get|buy|try|check out) (?:a |the |this )?hisense/i, weight: 0.45 },
  { pattern: /(?:go |look )?(?:check out|look at|try) hisense/i, weight: 0.35 },
  { pattern: /consider (?:hisense|a hisense|the hisense|getting)/i, weight: 0.3 },
  { pattern: /(?:worth |worth a) (?:checking out|look|consideration)/i, weight: 0.3 },
  { pattern: /hisense (?:is|would be) (?:a )?(?:good|great|solid|excellent|amazing|fantastic|smart|wise) (?:option|choice|pick|buy|decision)/i, weight: 0.45 },
  { pattern: /can\'t go wrong (?:with|on) (?:a |the )?hisense/i, weight: 0.45 },
  { pattern: /you won\'t regret (?:buying|getting)/i, weight: 0.4 },
  { pattern: /pull the trigger (?:on|with)/i, weight: 0.3 },

  // ═══════════════════════════════════════════════════════════════
  // === 价值/性价比 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /best (?:tv|purchase|buy|value|deal) (?:i|ive|i\'ve|we|weve|we\'ve) (?:ever|had|made|gotten|owned)/i, weight: 0.5 },
  { pattern: /best (?:bang|value) for (?:the |your )?(?:buck|money|price)/i, weight: 0.45 },
  { pattern: /great (?:buy|deal|choice|option|pick|value|investment)/i, weight: 0.4 },
  { pattern: /good (?:buy|deal|choice|option|pick|value|investment)/i, weight: 0.35 },
  { pattern: /solid (?:buy|choice|option|pick|tv|purchase|value)/i, weight: 0.35 },
  { pattern: /smart (?:buy|choice|option|pick|purchase)/i, weight: 0.35 },
  { pattern: /wise (?:buy|choice|option|pick|purchase|investment)/i, weight: 0.35 },
  { pattern: /worth (?:every |the )?(?:penny|cent|dollar|money|price|dime)/i, weight: 0.4 },
  { pattern: /worth (?:it|the price|the money)/i, weight: 0.35 },
  { pattern: /great (?:for the |at the |for )?(?:price|money|budget|cost)/i, weight: 0.4 },
  { pattern: /amazing (?:for the |at the |for )?(?:price|money|budget|cost)/i, weight: 0.4 },
  { pattern: /excellent (?:for the |at the |for )?(?:price|money|budget|cost)/i, weight: 0.4 },
  { pattern: /(?:very |super |really |quite |pretty )?affordable/i, weight: 0.25 },
  { pattern: /budget(?: friendly| pick| option| choice|-friendly)/i, weight: 0.2 },
  { pattern: /cheap for what/i, weight: 0.3 },
  { pattern: /steal (?:at|for)/i, weight: 0.4 },
  { pattern: /bargain (?:at|for)/i, weight: 0.35 },
  { pattern: /can\'t beat (?:the |this )?(?:price|value|deal)/i, weight: 0.4 },
  { pattern: /unbeatable (?:price|value|deal)/i, weight: 0.4 },
  { pattern: /no brainer (?:at|for)/i, weight: 0.35 },

  // ═══════════════════════════════════════════════════════════════
  // === 产品好评（画质） ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /great (?:value|price|quality|picture|display|screen|image|color|colors|sound|audio|tv|performance)/i, weight: 0.35 },
  { pattern: /good (?:value|price|quality|picture|display|screen|image|color|colors|sound|audio)/i, weight: 0.3 },
  { pattern: /excellent (?:picture|quality|tv|value|display|screen|image|color|colors|sound|audio|performance)/i, weight: 0.4 },
  { pattern: /amazing (?:picture|quality|tv|value|display|screen|image|color|colors|sound|audio|performance)/i, weight: 0.4 },
  { pattern: /fantastic (?:picture|quality|tv|display|screen|value|image|color|colors)/i, weight: 0.4 },
  { pattern: /superb (?:picture|quality|display|screen|image|color|colors|sound|audio)/i, weight: 0.4 },
  { pattern: /stunning (?:picture|display|screen|image|quality|colors|color)/i, weight: 0.4 },
  { pattern: /beautiful (?:picture|display|screen|image|colors|color)/i, weight: 0.35 },
  { pattern: /gorgeous (?:picture|display|screen|image|colors|color)/i, weight: 0.4 },
  { pattern: /breathtaking (?:picture|display|screen|image|quality)/i, weight: 0.45 },
  { pattern: /incredible (?:picture|display|screen|image|quality|colors)/i, weight: 0.4 },
  { pattern: /crisp (?:picture|display|screen|image|quality|colors)/i, weight: 0.3 },
  { pattern: /sharp (?:picture|display|screen|image|quality|detail)/i, weight: 0.3 },
  { pattern: /vivid (?:colors?|color|picture|display)/i, weight: 0.3 },
  { pattern: /rich (?:colors?|color|blacks|black)/i, weight: 0.3 },
  { pattern: /deep (?:blacks?|black|colors?|color)/i, weight: 0.3 },
  { pattern: /bright (?:screen|display|picture|image)/i, weight: 0.3 },
  { pattern: /bright and (?:vivid|colorful|clear|sharp)/i, weight: 0.35 },
  { pattern: /true (?:to life|colors|color|blacks)/i, weight: 0.3 },
  { pattern: /lifelike (?:picture|image|colors)/i, weight: 0.35 },
  { pattern: /cinematic (?:quality|experience|look)/i, weight: 0.35 },
  { pattern: /looks (?:great|amazing|beautiful|stunning|fantastic|crisp|sharp|good|nice|incredible|gorgeous)/i, weight: 0.3 },
  { pattern: /looks (?:even )?better (?:in person|in real life|than)/i, weight: 0.35 },
  { pattern: /picture quality (?:is|was) (?:great|good|amazing|excellent|fantastic|superb|stunning|incredible)/i, weight: 0.45 },
  { pattern: /image quality (?:is|was) (?:great|good|amazing|excellent|fantastic|superb|stunning|incredible)/i, weight: 0.45 },
  { pattern: /4k (?:looks|is) (?:great|good|amazing|stunning|incredible|sharp|crisp)/i, weight: 0.35 },
  { pattern: /hdr (?:looks|is|pop|pops)/i, weight: 0.35 },
  { pattern: /dolby vision (?:looks|is)/i, weight: 0.3 },
  { pattern: /dolby atmos/i, weight: 0.25 },

  // ═══════════════════════════════════════════════════════════════
  // === 产品好评（声音/音质） ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /(?:great|good|decent|solid) (?:sound|audio|speakers)/i, weight: 0.3 },
  { pattern: /(?:loud|powerful|clear|rich) (?:sound|audio)/i, weight: 0.3 },
  { pattern: /sound (?:is|was) (?:great|good|amazing|excellent|fantastic|clear)/i, weight: 0.35 },
  { pattern: /audio (?:is|was) (?:great|good|amazing|excellent|fantastic|clear)/i, weight: 0.35 },
  { pattern: /good bass/i, weight: 0.25 },
  { pattern: /booming (?:sound|audio|bass)/i, weight: 0.3 },

  // ═══════════════════════════════════════════════════════════════
  // === 产品好评（游戏/性能） ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /low input lag/i, weight: 0.35 },
  { pattern: /(?:great|good|low|minimal) (?:input lag|latency)/i, weight: 0.35 },
  { pattern: /(?:great|good|amazing|excellent) (?:for gaming|gaming tv|gaming monitor)/i, weight: 0.4 },
  { pattern: /(?:smooth|fluid|responsive) (?:gameplay|gaming|experience)/i, weight: 0.35 },
  { pattern: /120hz (?:is|was|looks) (?:great|good|amazing|smooth|fluid)/i, weight: 0.35 },
  { pattern: /144hz (?:is|was|looks) (?:great|good|amazing|smooth|fluid)/i, weight: 0.35 },
  { pattern: /vrr (?:works|is|looks)/i, weight: 0.3 },
  { pattern: /freesync/i, weight: 0.25 },
  { pattern: /gsync/i, weight: 0.25 },
  { pattern: /hdmi 2\.1/i, weight: 0.2 },

  // ═══════════════════════════════════════════════════════════════
  // === 产品好评（系统/软件/使用） ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /(?:fast|quick|snappy|responsive|smooth) (?:ui|interface|menu|os|system)/i, weight: 0.3 },
  { pattern: /vidaa/i, weight: 0.15 },
  { pattern: /android tv/i, weight: 0.15 },
  { pattern: /google tv/i, weight: 0.15 },
  { pattern: /roku/i, weight: 0.15 },
  { pattern: /easy (?:to |to )?(?:set up|setup|install|use|navigate)/i, weight: 0.25 },
  { pattern: /setup (?:was )?(?:easy|simple|quick|straightforward|a breeze)/i, weight: 0.25 },
  { pattern: /out of (?:the )?box/i, weight: 0.2 },
  { pattern: /plug and play/i, weight: 0.25 },
  { pattern: /remote (?:is|was|works|feels) (?:good|great|nice|decent|responsive)/i, weight: 0.2 },
  { pattern: /voice control/i, weight: 0.15 },
  { pattern: /built.in (?:chromecast|airplay|alexa)/i, weight: 0.2 },

  // ═══════════════════════════════════════════════════════════════
  // === 满意度/体验 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /very (?:happy|pleased|satisfied|impressed|content|delighted|thrilled)/i, weight: 0.4 },
  { pattern: /(?:super|really|so|extremely|quite|pretty) (?:happy|pleased|satisfied|impressed|content|delighted|thrilled)/i, weight: 0.4 },
  { pattern: /happy (?:with|about) (?:my |this |the )?(?:purchase|tv|hisense|product|buy)/i, weight: 0.4 },
  { pattern: /pleased (?:with|about) (?:my |this |the )?(?:purchase|tv|hisense|product|buy)/i, weight: 0.4 },
  { pattern: /satisfied (?:with|about) (?:my |this |the )?(?:purchase|tv|hisense|product|buy)/i, weight: 0.4 },
  { pattern: /glad i (?:bought|got|purchased|went with|picked|chose)/i, weight: 0.4 },
  { pattern: /love it/i, weight: 0.4 },
  { pattern: /love (?:the|this|my|our) (?:tv|product|purchase|hisense|one)/i, weight: 0.45 },
  { pattern: /exceeded (?:my |the |all )?expectations/i, weight: 0.45 },
  { pattern: /better than expected/i, weight: 0.4 },
  { pattern: /pleasantly surprised/i, weight: 0.4 },
  { pattern: /surprised (?:by|at|how)/i, weight: 0.3 },
  { pattern: /(?:so |very |really )?satisfied/i, weight: 0.35 },
  { pattern: /(?:so |very |really )?impressed/i, weight: 0.35 },
  { pattern: /couldn\'?t be (?:happier|more pleased|more satisfied|happier)/i, weight: 0.5 },
  { pattern: /(?:great|good|amazing|fantastic|excellent|wonderful|awesome|superb) (?:experience|product|purchase|buy|tv)/i, weight: 0.4 },
  { pattern: /no (?:regrets|issues|problems|complaints|concerns)/i, weight: 0.3 },
  { pattern: /zero (?:issues|problems|complaints|concerns)/i, weight: 0.3 },
  { pattern: /nothing (?:bad|wrong|negative|to complain)/i, weight: 0.3 },
  { pattern: /works (?:great|perfectly|flawlessly|well|fine|good)/i, weight: 0.35 },
  { pattern: /works (?:like a )?charm/i, weight: 0.35 },
  { pattern: /works (?:like a )?dream/i, weight: 0.35 },
  { pattern: /running (?:great|well|smoothly|perfectly|fine)/i, weight: 0.3 },
  { pattern: /holding up (?:great|well|nicely|fine)/i, weight: 0.3 },
  { pattern: /still (?:works|going|running) (?:great|well|fine|strong)/i, weight: 0.35 },
  { pattern: /after (?:a |)\d+ (?:year|years|month|months)/i, weight: 0.2 },
  { pattern: /years? later/i, weight: 0.2 },

  // ═══════════════════════════════════════════════════════════════
  // === 对比竞品推荐海信 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /hisense (?:over|instead of|rather than|vs|versus|compared to) (?:samsung|lg|sony|tcl|vizio)/i, weight: 0.4 },
  { pattern: /(?:switched?|changed?|moved?) (?:from|to) hisense/i, weight: 0.3 },
  { pattern: /hisense (?:beats?|wins?|is better than|outperforms?|worked better|lasted longer|crushes|destroys|wipes the floor) /i, weight: 0.45 },
  { pattern: /picked hisense (?:over|instead)/i, weight: 0.4 },
  { pattern: /chose hisense/i, weight: 0.35 },
  { pattern: /(?:go with|would choose|would pick|i\'d go with|id go with) hisense/i, weight: 0.5 },
  { pattern: /hisense (?:worked|works) (?:better|well|great|perfectly|fine)/i, weight: 0.45 },
  { pattern: /(?:better|more reliable|superior|prefer) (?:than|to) (?:my |their |)*(?:tcl|samsung|lg|sony|vizio)/i, weight: 0.35 },
  { pattern: /can\'t beat hisense/i, weight: 0.45 },
  { pattern: /nothing beats hisense/i, weight: 0.45 },
  { pattern: /hisense (?:all day|every day|any day)/i, weight: 0.4 },

  // ═══════════════════════════════════════════════════════════════
  // === 复购/推荐意愿 ===
  // ═══════════════════════════════════════════════════════════════
  { pattern: /(?:would |will |plan to |going to )?(?:buy|get|purchase) (?:another|a second|a third|again)/i, weight: 0.45 },
  { pattern: /buying (?:another|a second)/i, weight: 0.4 },
  { pattern: /getting (?:another|a second)/i, weight: 0.4 },
  { pattern: /(?:my |our )next (?:tv|television|one)/i, weight: 0.25 },
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
  // 反向语义/排除型表达（如 "without worrying about burn-in"、"free of dead pixels"）
  'without', 'free of', 'free from', 'avoids', 'avoiding', 'eliminates',
  'rid of', 'no risk of', 'no worry', 'no worries', 'unlike',
];

// 否定窗口：取负面词前 N 个字符判断是否被否定（覆盖 "without worrying about " 这类长前缀）
const NEGATION_LOOKBACK = 35;

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
// 负面词前 NEGATION_LOOKBACK 字符内若出现否定词则不计入（避免 "without burn-in" 误判）
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
    let m: RegExpExecArray | null;
    const findAll = new RegExp(regex.source, 'gi');
    while ((m = findAll.exec(lowerText)) !== null) {
      const matchStart = m.index + (m[1] ? m[1].length : 0);
      const before = lowerText.substring(Math.max(0, matchStart - NEGATION_LOOKBACK), matchStart);
      const hasNeg = NEGATION_WORDS.some(n => before.includes(n));
      if (!hasNeg) neg += 0.1;
    }
  }

  return {
    positive: Math.min(pos, 1.0),
    negative: Math.min(neg, 1.0),
  };
}

// ─── 辅助函数：品牌附近情感检测 ──────────────────────────────────
// 检测品牌词附近（±60字符）是否有明显的正面/负面表达
// 负面词需考虑否定语境（如 "don't get the hate"）
function hasUnnegatedSubstring(window: string, needle: string): boolean {
  let from = 0;
  while (true) {
    const idx = window.indexOf(needle, from);
    if (idx === -1) return false;
    const before = window.substring(Math.max(0, idx - NEGATION_LOOKBACK), idx);
    const negated = NEGATION_WORDS.some(n => before.includes(n));
    if (!negated) return true;
    from = idx + needle.length;
  }
}

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
    // 负面词需去除被否定的命中（如 "don't get the hate"）
    const hasNeg = NEGATIVE_EMOTION_WORDS.some(w => hasUnnegatedSubstring(window, w.toLowerCase()));

    // 额外正面信号（强表达）
    const strongPos = /\b(love|amazing|excellent|fantastic|best|perfect|recommend)\b/i.test(window);
    // 额外负面信号（强表达）— 同样需去除被否定
    let strongNeg = false;
    const strongNegPattern = /(?:^|[^a-z0-9])(hate|terrible|awful|worst|broken|defective|avoid|scam)(?:[^a-z0-9]|$)/gi;
    let sm: RegExpExecArray | null;
    while ((sm = strongNegPattern.exec(window)) !== null) {
      const wordStart = sm.index + (sm[0].length - sm[1].length - (sm.index + sm[0].length < window.length ? 1 : 0));
      const before = window.substring(Math.max(0, wordStart - NEGATION_LOOKBACK), wordStart);
      if (!NEGATION_WORDS.some(n => before.includes(n))) { strongNeg = true; break; }
    }

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

  // ── 0. 品牌实体存在性检测（前置，用于负面命中守卫）────────────
  const hasHisense = textHasAnyKeyword(text, HISENSE_KEYWORDS);
  const hasCompetitor = textHasAnyKeyword(text, COMPETITOR_KEYWORDS);
  // 仅出现竞品（如 "Fuck Samsung"）→ 不属于海信负面，跳过所有硬性负面命中
  const skipHardNegative = hasCompetitor && !hasHisense;

  // ── 1. 硬性负面关键词检测（最高优先级）────────────────────────
  if (!skipHardNegative) {
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
          // 短词（≤5）使用词边界，避免如 'crap' 误命中 'craps out'
          if (keywordLower.length <= 5 && !keywordLower.includes(' ')) {
            const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
            if (regex.test(text)) {
              const keywordIndex = text.search(regex);
              const beforeText = text.substring(Math.max(0, keywordIndex - NEGATION_LOOKBACK), keywordIndex);
              const hasNegation = NEGATION_WORDS.some(neg => beforeText.includes(neg));
              if (!hasNegation) {
                matchedKeywords.push({ category, keyword: keyword.trim() });
                negativityScore += getCategoryWeight(category);
              }
            }
          } else if (text.includes(keywordLower)) {
            const keywordIndex = text.indexOf(keywordLower);
            const beforeText = text.substring(Math.max(0, keywordIndex - NEGATION_LOOKBACK), keywordIndex);
            const hasNegation = NEGATION_WORDS.some(neg => beforeText.includes(neg));
            if (!hasNegation) {
              matchedKeywords.push({ category, keyword: keyword.trim() });
              negativityScore += getCategoryWeight(category);
            }
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

  // ── 5. 综合计算最终情感得分 ─────────────────────────────────
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
      // 竞品 + 明确负面上下文 → 中性（骂竞品不直接等于夸海信，避免误判）
      finalScore = 0;
    } else if (genPos > genNeg) {
      // 整体偏正面 → 负面（无海信，偏正面多半是夸竞品）
      finalScore = -Math.min(patternPositiveScore + genPos + 0.15, 1.0);
    } else if (genNeg > genPos) {
      // 整体偏负面 → 中性（骂竞品不直接等于夸海信）
      finalScore = 0;
    } else if (patternPositiveScore > 0 && genNeg === 0) {
      // 无竞品情感上下文，但有基础正面模式且无负面信号 → 弱负面（可能是隐晦夸竞品）
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
      // 竞品负面 + 海信无负面 → 中性（骂竞品不直接等于夸海信）
      finalScore = 0;
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

  // 恶意判定与 UI 标红一致：命中硬性关键词 或 最终得分 < 0 均视为恶意
  const isFlagged = matchedKeywords.length > 0 || finalScore < 0;
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

// 基于“恶意评论比例”全局分位的帖子分级
// 规则：所有帖子按 (恶意评论数 / 总评论数) 降序排列，
//   排名前 15%   → critical（高危）
//   排名 15%~30% → medium  （中等）
//   其余及恶意比例为 0     → safe    （正常）
export function assignAlertLevelByPercentile<T extends { id: string; alertLevel?: AlertLevel }>(
  posts: T[],
  ratios: Map<string, number>,
): void {
  const N = posts.length;
  if (N === 0) return;
  const sorted = posts
    .map((p, i) => ({ p, ratio: ratios.get(p.id) ?? 0, i }))
    .sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return a.i - b.i;
    });
  const hasAnyNeg = sorted[0].ratio > 0;
  const criticalCount = hasAnyNeg ? Math.max(1, Math.ceil(N * 0.15)) : 0;
  const top30 = Math.max(criticalCount, Math.ceil(N * 0.30));
  sorted.forEach((item, idx) => {
    if (item.ratio === 0) item.p.alertLevel = 'safe';
    else if (idx < criticalCount) item.p.alertLevel = 'critical';
    else if (idx < top30) item.p.alertLevel = 'medium';
    else item.p.alertLevel = 'safe';
  });
}

// 计算单个帖子的恶意比例（恶意评论数 / 总评论数）
// 恶意判定：命中硬性关键词 或 sentimentScore < 0
export function calcPostFlaggedRatio(comments: RedditComment[]): number {
  if (!comments || comments.length === 0) return 0;
  const flagged = comments.filter(c => c.isFlagged || (c.sentimentScore ?? 0) < 0).length;
  return flagged / comments.length;
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
