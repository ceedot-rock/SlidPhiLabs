#!/usr/bin/env python3
"""tavily_pull.py: standing Tavily ingest for the Slidphiclepedia.
Every result appends one record to pulls.jsonl (schema in README.md).
Key is read from ~/.slidphi/tavily.key at runtime, never stored or printed.
Usage: python tavily_pull.py [--max N] [--time month|year] "query" [...]
Prints titles+urls only; snippets go to the file.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
PEDIA = os.path.dirname(HERE)
PULLS = os.path.join(PEDIA, 'pulls.jsonl')
KEYFILE = os.path.join(os.path.expanduser('~'), '.slidphi', 'tavily.key')


def search(key, query, max_results, time_range):
    body = json.dumps({'query': query, 'search_depth': 'advanced',
                       'max_results': max_results, 'time_range': time_range,
                       'include_answer': False}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.tavily.com/search', data=body,
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def main():
    args = sys.argv[1:]
    max_results, time_range = 5, 'year'
    while args and args[0].startswith('--'):
        flag = args.pop(0)
        if flag == '--max':
            max_results = int(args.pop(0))
        elif flag == '--time':
            time_range = args.pop(0)
    if not args:
        print('usage: tavily_pull.py [--max N] [--time month|year] Q...')
        return 1
    with open(KEYFILE, encoding='utf-8') as fh:
        key = fh.read().strip()
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    total = 0
    with open(PULLS, 'a', encoding='utf-8') as fh:
        for q in args:
            try:
                res = search(key, q, max_results, time_range)
            except Exception as e:
                print('Q-FAIL %s (%s)' % (q, type(e).__name__))
                continue
            for r in res.get('results', []):
                sn = ' '.join((r.get('content') or '').split())[:280]
                fh.write(json.dumps({'d': today, 'q': q,
                                     'title': r.get('title', ''),
                                     'url': r.get('url', ''),
                                     'snippet': sn,
                                     'note': 'batch pull, triage pending'},
                                    ensure_ascii=False) + '\n')
                total += 1
                safe_t = ('- ' + r.get('title', '')).encode(
                    'ascii', 'replace').decode('ascii')
                safe_u = ('  ' + r.get('url', '')).encode(
                    'ascii', 'replace').decode('ascii')
                print(safe_t)
                print(safe_u)
    print('PULL-OK records=%d' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
