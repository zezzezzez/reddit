// Generate Chinese summary for a Reddit post based on title, comments and alert info

// ─── 受控词表：每个概念只有一个标准中文标签 ───────────────────────
// 结构：{ 标准中文标签: [所有同义英文关键词（小写）] }
// 规则：新增概念只在此处添加，同义表达合并到同一标签，禁止创建近似标签
export const CONTROLLED_VOCAB: Record<string, string[]> = {
  // === 机型系列 ===
  'U8N系列':       ['u8n'],
  'U7N系列':       ['u7n'],
  'U6N系列':       ['u6n'],
  'U8系列':        ['u8 ', ' u8 ', ' u8'],   // 加空格防误匹配 u8n
  'U7系列':        ['u7 ', ' u7 ', ' u7'],
  'U6系列':        ['u6 ', ' u6 ', ' u6'],
  'OLED电视':      ['oled'],
  'QLED电视':      ['qled'],
  'Mini LED电视':  ['miniled', 'mini-led', 'mini led'],
  '4K电视':        ['4k', '4k tv', '4k television'],

  // === 尺寸 ===
  '85英寸':  ['85 inch', '85inch', '85"', '85-inch'],
  '75英寸':  ['75 inch', '75inch', '75"', '75-inch'],
  '65英寸':  ['65 inch', '65inch', '65"', '65-inch'],
  '55英寸':  ['55 inch', '55inch', '55"', '55-inch'],

  // === 品牌 ===
  '海信':  ['hisense'],
  '三星':  ['samsung'],
  'LG':    ['lg tv', ' lg '],
  'TCL':   ['tcl tv', ' tcl '],
  '索尼':  ['sony'],

  // === 使用场景 ===
  '游戏场景':   ['gaming', 'game', 'gamer', 'gaming setup', 'gaming tv', 'play game', 'playing game', 'game mode', 'gaming mode', 'ps5', 'xbox', 'console gaming'],
  '家庭影院':   ['home theater', 'home theatre', 'movie room', 'theater setup', 'projector room'],
  '体育赛事':   ['sports', 'sport', 'world cup', 'soccer', 'football', 'basketball', 'nfl', 'nba', 'mlb'],
  '日常观影':   ['movie', 'movies', 'film', 'netflix', 'streaming', 'watch tv', 'watching tv'],

  // === 画面质量 ===
  '画质':        ['picture quality', 'image quality', 'picture', 'image clarity', 'visual quality'],
  'HDR效果':     ['hdr', 'hdr10', 'hdr10+', 'hdr plus'],
  '杜比视界':    ['dolby vision', 'dolby vis'],
  '色彩表现':    ['color accuracy', 'color reproduction', 'color gamut', 'colors', 'colour'],
  '对比度':      ['contrast', 'contrast ratio', 'black level', 'deep black'],
  '亮度':        ['brightness', 'nits', 'peak brightness', 'dim', 'bright'],
  '色带问题':    ['banding', 'color banding'],
  '光晕问题':    ['blooming', 'halo', 'halos'],
  '屏幕不均匀':  ['dse', 'dirty screen', 'uniformity'],

  // === 刷新率 ===
  '高刷新率':    ['120hz', '144hz', 'high refresh', 'refresh rate', 'smooth motion', 'vrr', 'freesync', 'g-sync'],
  '输入延迟':    ['input lag', 'latency', 'response time', 'lag'],
  '运动补偿':    ['motion', 'motion blur', 'motion interpolation', 'soap opera effect'],

  // === 音频 ===
  '音质':        ['sound quality', 'audio quality', 'sound', 'audio'],
  '回音壁':      ['soundbar', 'sound bar', 'speaker bar'],
  '杜比全景声':  ['dolby atmos', 'atmos'],

  // === 系统平台 ===
  'Google TV':   ['google tv', 'googletv'],
  'Roku系统':    ['roku'],
  'Fire TV':     ['fire tv', 'firetv', 'fire television'],

  // === 购买渠道 ===
  'Costco渠道':    ['costco'],
  'Best Buy渠道':  ['bestbuy', 'best buy'],
  'Walmart渠道':   ['walmart'],
  'Amazon渠道':    ['amazon'],

  // === 价格促销 ===
  '促销优惠':    ['black friday', 'deal', 'sale', 'discount', 'price drop', 'on sale', 'clearance', 'cyber monday'],
  '价格讨论':    ['price', 'cost', 'expensive', 'cheap', 'budget', 'affordable', 'worth'],

  // === 使用反馈 ===
  '评测':        ['review', 'unboxing', 'first impression', 'impressions', 'overview'],
  '产品对比':    ['comparison', 'compare', 'vs ', 'versus', 'difference between'],
  '购买推荐':    ['recommend', 'recommendation', 'should i buy', 'which to buy', 'advice'],
  '安装设置':    ['setup', 'install', 'installation', 'mounting', 'set up'],
  '系统校准':    ['calibration', 'calibrate', 'settings', 'picture settings'],
  '固件更新':    ['firmware', 'update', 'software update'],
  '保修服务':    ['warranty', 'extended warranty'],
  '退货退款':    ['return', 'refund', 'returned', 'sent back', 'exchange'],
  '客服体验':    ['customer service', 'customer support', 'support', 'tech support'],

  // === 硬件故障 ===
  '产品故障':    ['broken', 'defective', 'dead pixel', 'dead pixels', 'malfunction', 'not working', 'stopped working'],
  '硬件问题':    ['issue', 'problem', 'problems', 'issues', 'trouble'],
  '开箱损坏':    ['broken out of box', 'doa', 'damaged', 'damage'],
};

// ─── 关键词分类映射（用于筛选器） ───────────────────────
export const KEYWORD_CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  brand: {
    label: '品牌关键词',
    keywords: ['海信', '三星', 'LG', 'TCL', '索尼'],
  },
  scene: {
    label: '场景关键词',
    keywords: ['游戏场景', '家庭影院', '体育赛事', '日常观影'],
  },
  model: {
    label: '型号关键词',
    keywords: [
      'U8N系列', 'U7N系列', 'U6N系列', 'U8系列', 'U7系列', 'U6系列',
      'OLED电视', 'QLED电视', 'Mini LED电视', '4K电视',
      '85英寸', '75英寸', '65英寸', '55英寸',
    ],
  },
  quality: {
    label: '质量关键词',
    keywords: [
      '画质', 'HDR效果', '杜比视界', '色彩表现', '对比度', '亮度',
      '色带问题', '光晕问题', '屏幕不均匀',
      '高刷新率', '输入延迟', '运动补偿',
      '音质', '回音壁', '杜比全景声',
      '产品故障', '硬件问题', '开箱损坏',
    ],
  },
};


// 构建扁平化查找表（英文关键词 → 标准中文标签），供运行时使用
const TOPIC_LOOKUP: Array<{ keyword: string; label: string }> = [];
for (const [label, keywords] of Object.entries(CONTROLLED_VOCAB)) {
  for (const kw of keywords) {
    TOPIC_LOOKUP.push({ keyword: kw.toLowerCase(), label });
  }
}
// 按关键词长度降序排列，优先匹配更长的词组防止短词误匹配
TOPIC_LOOKUP.sort((a, b) => b.keyword.length - a.keyword.length);

const SUBREDDIT_MAP: Record<string, string> = {
  '4ktv': '4K电视', 'hometheater': '家庭影院', 'hisense': '海信专区',
  'bestbuy': 'BestBuy', 'costco': 'Costco', 'walmart': 'Walmart',
  'soundbars': '回音壁', 'audio': '音响', 'gaming': '游戏',
  'tcltvs': 'TCL电视', 'consoles': '主机游戏', 'playstation': 'PlayStation',
  'ces': 'CES展会', 'gamingsetups': '游戏装备',
};

function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const seen = new Set<string>();
  const topics: string[] = [];

  // 按关键词长度从长到短匹配，确保"home theater"优先于"home"
  for (const { keyword, label } of TOPIC_LOOKUP) {
    if (!seen.has(label) && lower.includes(keyword)) {
      topics.push(label);
      seen.add(label);
    }
    if (topics.length >= 5) break;
  }

  return topics;
}

function getSubredditLabel(subreddit: string): string {
  return SUBREDDIT_MAP[subreddit.toLowerCase()] || `r/${subreddit}`;
}

// Alert reason descriptions in Chinese
const ALERT_REASON_DESC: Record<string, string> = {
  brand_attack: '存在品牌攻击言论',
  product_hate: '存在产品差评',
  call_to_action_negative: '存在号召抵制言论',
  competitor_push: '存在推荐竞品言论',
  negative_sentiment: '存在负面情绪评论',
};

export function generatePostSummary(post: {
  title: string;
  subreddit: string;
  alertLevel: string;
  alertReasons: string[];
  commentCount: number;
  lastScanned: string | null;
  score?: number;
}): string {
  const parts: string[] = [];

  // Source
  parts.push(`来源: ${getSubredditLabel(post.subreddit)}`);

  // Topics from title
  const topics = extractTopics(post.title);
  if (topics.length > 0) {
    parts.push(`话题: ${topics.join('、')}`);
  }

  // Scan status
  if (!post.lastScanned) {
    parts.push('状态: 待扫描');
  } else {
    // Alert info
    if (post.alertReasons.length > 0) {
      const reasons = post.alertReasons.map(r => ALERT_REASON_DESC[r] || r).join('；');
      parts.push(`风险: ${reasons}`);
    } else {
      parts.push('评论风向: 正常');
    }

    // Comment count
    if (post.commentCount > 0) {
      parts.push(`${post.commentCount}条评论`);
    }
  }

  return parts.join(' | ');
}

// Count all comments including nested replies
function countAllComments(comments: { replies?: any[] }[]): number {
  let count = 0;
  for (const c of comments) {
    count++;
    if (c.replies && Array.isArray(c.replies)) {
      count += countAllComments(c.replies);
    }
  }
  return count;
}

// Flatten all comments including nested replies for sentiment counting
function flattenComments(comments: { body: string; score: number; isFlagged: boolean; replies?: any[] }[]): { body: string; score: number; isFlagged: boolean }[] {
  const result: { body: string; score: number; isFlagged: boolean }[] = [];
  for (const c of comments) {
    result.push({ body: c.body, score: c.score, isFlagged: c.isFlagged });
    if (c.replies && Array.isArray(c.replies)) {
      result.push(...flattenComments(c.replies));
    }
  }
  return result;
}

// Generate a more detailed summary from post title + top comments
export function generateDetailedSummary(
  title: string,
  subreddit: string,
  comments: { body: string; score: number; isFlagged: boolean; replies?: any[] }[]
): string {
  const parts: string[] = [];

  // Platform
  parts.push(`${getSubredditLabel(subreddit)}讨论`);

  // Topics
  const allText = title + ' ' + comments.slice(0, 5).map(c => c.body).join(' ');
  const topics = extractTopics(allText);
  if (topics.length > 0) {
    parts.push(topics.join('、'));
  }

  // Sentiment overview - count ALL comments including replies
  const allComments = flattenComments(comments);
  const flagged = allComments.filter(c => c.isFlagged).length;
  const total = allComments.length;
  if (total > 0) {
    if (flagged === 0) {
      parts.push('评论整体正面/中性');
    } else if (flagged / total > 0.3) {
      parts.push(`评论区${flagged}条负面(占${Math.round(flagged/total*100)}%)`);
    } else {
      parts.push(`少量负面评论(${flagged}/${total})`);
    }
  }

  return parts.join(' · ');
}
