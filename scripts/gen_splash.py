import numpy as np
from PIL import Image, ImageDraw, ImageFont

CANVAS_W = 1024
CANVAS_H = 1200

canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (255, 255, 255, 255))

# Load icon and crop to actual logo content (white bg, not transparent)
icon = Image.open("D:/Jiwan-Mijhar/app/assets/images/icon.png")
arr = np.array(icon)
mask = ~((arr[:,:,0] > 240) & (arr[:,:,1] > 240) & (arr[:,:,2] > 240))
rows = np.any(mask, axis=1)
cols = np.any(mask, axis=0)
rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]
PAD = 30
icon_cropped = icon.crop((
    max(0, cmin - PAD), max(0, rmin - PAD),
    min(icon.width, cmax + PAD), min(icon.height, rmax + PAD),
))

TARGET_W = 600
aspect = icon_cropped.width / icon_cropped.height
TARGET_H = int(TARGET_W / aspect)
icon_resized = icon_cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)

# Logo: centered horizontally and vertically
logo_x = (CANVAS_W - TARGET_W) // 2
logo_y = (CANVAS_H - TARGET_H) // 2
canvas.paste(icon_resized, (logo_x, logo_y))

# Text: bold, near-black, pinned to bottom
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 62)

text = "Question Call"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

text_x = (CANVAS_W - text_w) // 2
text_y = CANVAS_H - text_h - 90   # 90px from bottom edge

draw.text((text_x, text_y), text, fill=(28, 28, 28, 255), font=font)

final = Image.new("RGB", (CANVAS_W, CANVAS_H), (255, 255, 255))
final.paste(canvas)
final.save("D:/Jiwan-Mijhar/app/assets/images/splash-logo.png", "PNG")
print("Done | logo center y:", logo_y + TARGET_H // 2, "| text y:", text_y)
