from pathlib import Path
path = Path('apps/web/src/layout/Header.tsx')
text = path.read_text()
text = text.replace(', useProgram', '')
text = text.replace('  const { program } = useProgram();\n', '')
text = text.replace('          {program === "Jordan" ? strings.jordan : strings.iset}\n', '          {strings.iset}\n')
path.write_text(text)
