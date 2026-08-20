import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
fmt = '%H%x1f%h%x1f%ad%x1f%an%x1f%s%x1e'
raw = subprocess.check_output(['git','-C',str(root),'log','--all','--reverse','--date=iso-strict',f'--pretty=format:{fmt}'], text=True)
rows = []
for record in raw.strip('\x1e\n').split('\x1e'):
    if not record.strip():
        continue
    full, short, date, author, subject = record.strip().split('\x1f', 4)
    stat = subprocess.check_output(['git','-C',str(root),'show','--format=','--stat','--oneline',full], text=True)
    names = subprocess.check_output(['git','-C',str(root),'show','--format=','--name-status',full], text=True)
    files = []
    for line in names.splitlines():
        parts = line.split('\t')
        if len(parts) >= 2 and parts[0] and parts[0][0] in 'AMDRT':
            files.append(' '.join(parts))
    rows.append({'full':full,'short':short,'date':date,'author':author,'subject':subject,'files':files,'stat':stat.strip().splitlines()[-1:]})
lines = ['# Relatório bruto do histórico Git', '', f'Total de commits: {len(rows)}', '']
for i, row in enumerate(rows, 1):
    lines.append(f"## {i}. `{row['short']}` — {row['date']} — {row['subject']}")
    lines.append(f"Commit completo: `{row['full']}`. Autor: {row['author']}.")
    if row['files']:
        lines.append('Arquivos alterados: ' + '; '.join(f'`{x}`' for x in row['files']) + '.')
    lines.append('')
Path(root/'history_report_raw.md').write_text('\n'.join(lines)+'\n')
print(f'{len(rows)} commits registrados')
