import { NextResponse } from 'next/server';
import { getComments, getConfig } from '@/lib/store';

// English stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
  'its', 'it', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'am', 'any', 'also', 'even',
  'still', 'already', 'really', 'much', 'like', 'get', 'got', 'go',
  'one', 'two', 'make', 'made', 'know', 'think', 'see', 'come', 'take',
  'want', 'look', 'use', 'find', 'give', 'tell', 'work', 'call', 'try',
  'ask', 'need', 'feel', 'become', 'leave', 'put', 'mean', 'keep',
  'let', 'begin', 'seem', 'help', 'show', 'hear', 'play', 'run', 'move',
  'live', 'believe', 'bring', 'happen', 'write', 'provide', 'sit', 'stand',
  'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change',
  'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak',
  'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer',
  'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die',
  'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill',
  'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report',
]);

// Brand/product/sentiment keyword classification
const BRAND_WORDS = new Set(['hisense', 'samsung', 'lg', 'sony', 'tcl', 'vizio', 'hisense', 'brand', 'company', 'warranty', 'customer', 'service', 'support']);
const PRODUCT_WORDS = new Set(['tv', 'oled', 'qled', 'led', 'lcd', '4k', '8k', 'uhd', 'hdr', 'dolby', 'atmos', 'hdm', 'panel', 'firmware', 'update', 'remote', 'smart', 'apps', 'netflix', 'refresh', 'hz', 'inch', 'soundbar', 'gaming', 'ps5', 'xbox', 'input', 'lag', 'motion', 'color', 'brightness', 'contrast', 'black', 'uniform', 'banding', 'dse', 'dead', 'pixel']);
const SENTIMENT_WORDS = new Set(['great', 'good', 'bad', 'terrible', 'amazing', 'horrible', 'worst', 'best', 'love', 'hate', 'excellent', 'poor', 'perfect', 'awful', 'fantastic', 'disappointed', 'satisfied', 'happy', 'angry', 'frustrated', 'return', 'refund', 'broken', 'defective', 'issue', 'problem', 'fix', 'work', 'working', 'recommend', 'avoid', 'buy', 'bought', 'purchas', 'price', 'value', 'quality', 'waste', 'money']);

function categorizeWord(word: string): 'brand' | 'product' | 'sentiment' | 'other' {
  if (BRAND_WORDS.has(word)) return 'brand';
  if (PRODUCT_WORDS.has(word)) return 'product';
  if (SENTIMENT_WORDS.has(word)) return 'sentiment';
  return 'other';
}

export async function GET() {
  const comments = getComments();
  const config = getConfig();
  const watchedWords: string[] = (config as any).watchedKeywords || [];

  // Count word frequencies
  const wordCount = new Map<string, number>();
  for (const c of comments) {
    const words = c.body.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (w.length < 3 || STOP_WORDS.has(w)) continue;
      wordCount.set(w, (wordCount.get(w) || 0) + 1);
    }
  }

  // Sort by count, take top 50
  const sorted = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  // Previous scan comparison for trend (simple: compare with stored keyword history)
  const prevCount = new Map<string, number>();
  try {
    const fs = await import('fs');
    const path = await import('path');
    const histFile = path.join(process.cwd(), 'data', 'keyword-history.json');
    if (fs.existsSync(histFile)) {
      const hist = JSON.parse(fs.readFileSync(histFile, 'utf-8'));
      for (const entry of hist) {
        prevCount.set(entry.word, entry.count);
      }
    }
  } catch {}

  const keywords = sorted.map(([word, count]) => {
    const prev = prevCount.get(word) || 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prev > 0 && count > prev * 1.2) trend = 'up';
    else if (prev > 0 && count < prev * 0.8) trend = 'down';

    return {
      word,
      count,
      trend,
      category: categorizeWord(word),
      watched: watchedWords.includes(word),
    };
  });

  // Save current counts as history for next comparison
  try {
    const fs = await import('fs');
    const path = await import('path');
    const histFile = path.join(process.cwd(), 'data', 'keyword-history.json');
    fs.writeFileSync(histFile, JSON.stringify(sorted.map(([word, count]) => ({ word, count }))));
  } catch {}

  return NextResponse.json({ keywords });
}

export async function POST(request: Request) {
  // Watch/unwatch a keyword
  const body = await request.json();
  const { word, watched } = body;
  if (!word) return NextResponse.json({ error: 'Missing word' }, { status: 400 });

  const config = getConfig();
  const watchedWords: string[] = (config as any).watchedKeywords || [];

  if (watched && !watchedWords.includes(word)) {
    watchedWords.push(word);
  } else if (!watched) {
    const idx = watchedWords.indexOf(word);
    if (idx >= 0) watchedWords.splice(idx, 1);
  }

  (config as any).watchedKeywords = watchedWords;
  const { saveConfig } = await import('@/lib/store');
  saveConfig(config);

  return NextResponse.json({ success: true, watchedKeywords: watchedWords });
}
