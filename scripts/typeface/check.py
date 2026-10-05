from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2] / 'public/fonts/imperivm'
required = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789−+×/!?₿$€₽←→'
for extension in ('ttf', 'woff2'):
    font = TTFont(root / f'imperivm-inscription.{extension}')
    cmap = font.getBestCmap()
    for char in required:
        assert ord(char) in cmap, f'{extension}: missing {char}'
        name = cmap[ord(char)]
        assert font['glyf'][name].numberOfContours > 0, f'{extension}: empty {char}'
        advance, _ = font['hmtx'][name]
        assert 0 < advance <= 1100, f'{extension}: invalid width {char}'
    assert font['OS/2'].fsType == 0, 'Font must permit embedding'
    assert len(font.getGlyphOrder()) == len(set(font.getGlyphOrder()))
print('TYPEFACE OK: Latin, Cyrillic including Ё/Й, small caps, numbers and UI signs in TTF and WOFF2.')
