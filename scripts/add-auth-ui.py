from pathlib import Path

root = Path('public')
for path in sorted(root.glob('*.html')):
    if path.name == 'login.html':
        continue
    text = path.read_text(encoding='utf-8')
    if 'data-auth-slot' not in text:
        slot = '<div class="auth-ui-slot" data-auth-slot aria-live="polite"><span class="auth-loading">Verificando sessão…</span></div>'
        if '</nav>' in text:
            text = text.replace('</nav>', f'{slot}</nav>', 1)
        elif '</header>' in text:
            text = text.replace('</header>', f'{slot}</header>', 1)
        else:
            text = text.replace('<body>', f'<body>{slot}', 1)
    if 'auth-ui.js' not in text:
        text = text.replace('</body>', '<script src="auth-ui.js" defer></script></body>', 1)
    path.write_text(text, encoding='utf-8')
    print(path)
