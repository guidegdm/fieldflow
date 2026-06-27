import requests, re
from collections import Counter

r = requests.get('https://www.nytimes.com/', headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})
html = r.text

# Find CSS file URLs
css_urls = re.findall(r'href="([^"]*\.css[^"]*)"', html)
all_css = set(css_urls)
print(f'=== Found {len(all_css)} CSS references ===')
for css in sorted(all_css)[:30]:
    print(f'  {css[:150]}')

# Find style blocks with global styles
styles = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
for i, s in enumerate(styles):
    if 'font-size' in s and 'body' in s.lower():
        print(f'\n=== STYLE BLOCK {i} (first 2000 chars) ===')
        print(s[:2000])
        break

# Extract font-weight declarations
weights = re.findall(r'font-weight\s*:\s*([^;}]+)', html)
print(f'\n=== FONT WEIGHTS (unique) ===')
for w in sorted(set(weights)):
    print(f'  {w.strip()}')

# Extract line-height
lhs = re.findall(r'line-height\s*:\s*([^;}]+)', html)
print(f'\n=== LINE HEIGHTS (unique) ===')
for lh in sorted(set(lhs))[:30]:
    print(f'  {lh.strip()}')

# Find table-related CSS classes
table_classes = re.findall(r'\.[\w-]*table[\w-]*\s*\{', html)
print(f'\n=== TABLE CSS CLASSES ===')
for tc in set(table_classes):
    print(f'  {tc}')

# Extract border patterns
borders = re.findall(r'border[^:]*:\s*([^;}]+)', html)
print(f'\n=== BORDER DECLARATIONS (sample) ===')
for b in sorted(set(borders))[:25]:
    print(f'  {b.strip()[:100]}')
