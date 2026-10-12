/**
 * 구조화 로거. 운영(NODE_ENV=production)에서는 한 줄 JSON 으로 출력해
 * CloudWatch, Loki, Datadog 같은 로그 수집기에서 바로 검색할 수 있게 합니다.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');
const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function serialize(meta?: Meta): Meta | undefined {
  if (!meta) return undefined;
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack, ...(v as any).code ? { code: (v as any).code } : {} };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function write(level: LogLevel, message: string, meta?: Meta): void {
  if (order[level] < order[minLevel]) return;
  const data = serialize(meta);
  const time = new Date().toISOString();
  const line = isProduction
    ? JSON.stringify({ time, level, msg: message, ...data })
    : `[${time}] ${level.toUpperCase().padEnd(5)} ${message}${data && Object.keys(data).length ? ' ' + JSON.stringify(data) : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => write('debug', message, meta),
  info: (message: string, meta?: Meta) => write('info', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  error: (message: string, meta?: Meta) => write('error', message, meta),
};
