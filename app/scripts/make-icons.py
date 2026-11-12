# 홈 화면 아이콘 생성: 분홍 바탕 + 색동 줄 이름표 + 하트 (글꼴 없이 도형만)
from PIL import Image, ImageDraw
import os

INK, PINK, CREAM = (59, 47, 58), (255, 143, 177), (255, 246, 238)
STRIPES = [(255, 111, 145), (255, 199, 95), (127, 216, 195), (142, 197, 255), (195, 166, 255)]

def heart(d, cx, cy, s, fill):
    d.ellipse([cx - s, cy - s * 0.6, cx, cy + s * 0.4], fill=fill)
    d.ellipse([cx, cy - s * 0.6, cx + s, cy + s * 0.4], fill=fill)
    d.polygon([(cx - s * 0.97, cy), (cx + s * 0.97, cy), (cx, cy + s * 1.1)], fill=fill)

def icon(size, maskable=False):
    S = 1024
    im = Image.new('RGB', (S, S), PINK)
    d = ImageDraw.Draw(im)
    pad = 210 if maskable else 150          # maskable는 가장자리가 잘려도 되도록 여백을 더 둔다
    x0, y0, x1, y1 = pad, pad + 60, S - pad, S - pad - 20
    d.rounded_rectangle([x0 + 16, y0 + 16, x1 + 16, y1 + 16], 90, fill=INK)          # 그림자
    d.rounded_rectangle([x0, y0, x1, y1], 90, fill=CREAM, outline=INK, width=26)
    # 색동 줄 (이름표 윗부분)
    w = (x1 - x0 - 52) / 5
    for i, c in enumerate(STRIPES):
        d.rectangle([x0 + 26 + i * w, y0 + 26, x0 + 26 + (i + 1) * w, y0 + 120], fill=c)
    d.line([x0 + 26, y0 + 122, x1 - 26, y0 + 122], fill=INK, width=14)
    # 이름 줄 (굵은 막대 두 개) + 하트
    cy = (y0 + y1) / 2 + 60
    d.rounded_rectangle([x0 + 100, cy - 70, x1 - 250, cy - 10], 30, fill=INK)
    d.rounded_rectangle([x0 + 100, cy + 50, x1 - 340, cy + 95], 22, fill=(138, 123, 134))
    heart(d, x1 - 160, cy - 52, 70, (240, 98, 143))
    return im.resize((size, size), Image.LANCZOS)

os.makedirs('icons', exist_ok=True)
icon(512).save('icons/icon-512.png')
icon(192).save('icons/icon-192.png')
icon(180).save('icons/apple-touch-icon.png')
icon(512, maskable=True).save('icons/icon-maskable-512.png')
print('icons ok')
