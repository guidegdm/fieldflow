import requests, re
from collections import Counter

# Bloomberg is harder - try the graphics domain or an article
urls = [
    'https://www.bloomberg.com/graphics/',
    'https://www.bloomberg.com/features/2024-tables/',
    'https://www.bloomberg.com/news/articles/2024-01-01/sample',
    'https://www.bloomberg.com/',
    'https://www.bloomberg.com/markets',
]

for url in urls:
    try:
        r = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        }, timeout=15)
        print(f'{url} => {r.status_code} ({len(r.text)} bytes)')
        if r.status_code == 200:
            html = r.text
            fonts = re.findall(r'font-family\s*:\s*([^;}]+)', html)
            print(f'  Fonts: {list(set(fonts))[:10]}')
            colors = re.findall(r'#[0-9a-fA-F]{3,6}', html)
            top = Counter(colors).most_common(15)
            print(f'  Top colors: {top}')
            css_vars = re.findall(r'--[\w-]+', html)
            print(f'  CSS vars: {list(set(css_vars))[:20]}')
            sizes = re.findall(r'font-size\s*:\s*([^;}]+)', html)
            print(f'  Sizes: {sorted(set(sizes))[:20]}')
            # Save for further analysis
            with open('bloomberg_home.html', 'w', encoding='utf-8') as f:
                f.write(html)
            break
    except Exception as e:
        print(f'{url} => Error: {e}')
