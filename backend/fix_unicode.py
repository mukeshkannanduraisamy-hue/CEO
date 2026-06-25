content = open('main.py', 'r', encoding='utf-8').read()
fixed = content.replace('\u2192', '->')
open('main.py', 'w', encoding='utf-8').write(fixed)
print('Fixed: replaced arrow character with ASCII ->')
