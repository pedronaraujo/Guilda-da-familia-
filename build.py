import pathlib
src = pathlib.Path('src')
css = (src/'style.css').read_text()
js = '\n'.join((src/f).read_text() for f in ['data.js','engine.js','calibration.js','avatar.js','app.js'])
html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dungeons and Tasks</title>
<meta name="description" content="Dungeons and Tasks: tarefas viram missões, o grupo sobe de nível e enfrenta uma batalha toda meia-noite.">
<meta name="theme-color" content="#10161b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;700;800;900&family=Grenze+Gotisch:wght@600;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<main id="app"></main>
<script>
{js}
</script>
</body>
</html>
'''
pathlib.Path('public').mkdir(exist_ok=True)
pathlib.Path('public/index.html').write_text(html)
print(len(html))
