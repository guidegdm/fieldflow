import requests, re

# Fetch the full web fonts CSS
r = requests.get(
    'https://g1.nyt.com/fonts/css/web-fonts.c851560786173ad206e1f76c1901be7e096e8f8b.css',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
with open('nyt_web_fonts.css', 'w', encoding='utf-8') as f:
    f.write(r.text)

# Now fetch the global and main CSS
css_files = [
    ('https://www.nytimes.com/vi-assets/static-assets/assets/global-DJ8Hpzja.css', 'nyt_global.css'),
    ('https://www.nytimes.com/vi-assets/static-assets/assets/main-4V19D2K6.css', 'nyt_main.css'),
]

for url, filename in css_files:
    r = requests.get(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.nytimes.com/',
    })
    print(f'{filename}: {r.status_code} ({len(r.text)} bytes)')
    if r.status_code == 200:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(r.text)

# Count font families in the web fonts file  
fonts_text = open('nyt_web_fonts.css', encoding='utf-8').read()
families = re.findall(r"font-family:\s*'([^']+)'", fonts_text)
print(f'\n=== NYT FONT FAMILIES ({len(set(families))}) ===')
for fam in sorted(set(families)):
    weights = re.findall(rf"font-family:\s*'{fam}'.*?font-weight:\s*(\d+)", fonts_text, re.DOTALL)
    print(f'  {fam}: weights {sorted(set(weights))}')
