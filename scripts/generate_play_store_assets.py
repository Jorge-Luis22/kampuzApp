from PIL import Image, ImageDraw, ImageFont
import os

def create_play_store_icon():
    size = (512, 512)
    img = Image.new("RGBA", size, (47, 42, 107, 255)) # #2F2A6B
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle or modern shield background
    # Subtle inner border/glow
    draw.rectangle([8, 8, 503, 503], outline=(74, 66, 153, 255), width=4)

    # Draw iconic "Z" in turquoise (#00A896 / #00C4B4)
    # Z coordinates: top bar, diagonal, bottom bar
    # 512x512 canvas -> Z centered around 140 to 372
    z_points = [
        (130, 130), # Top-left
        (382, 130), # Top-right
        (382, 190), # Top-right down
        (220, 322), # Diagonal inner top
        (382, 322), # Bottom bar top right
        (382, 382), # Bottom bar bottom right
        (130, 382), # Bottom bar bottom left
        (130, 322), # Bottom bar top left
        (292, 190), # Diagonal inner bottom
        (130, 190), # Top-left inner
    ]
    draw.polygon(z_points, fill=(0, 168, 150, 255)) # #00A896

    # Highlight accent dot/sparkle at (382, 130)
    draw.ellipse([345, 95, 415, 165], fill=(0, 204, 180, 255))
    
    os.makedirs("docs/play-store", exist_ok=True)
    img.save("docs/play-store/icon-512.png", "PNG")
    print("icon-512.png generated successfully.")

def create_feature_graphic():
    width, height = 1024, 500
    img = Image.new("RGBA", (width, height), (31, 27, 75, 255)) # #1F1B4B
    draw = ImageDraw.Draw(img)

    # Gradient-like background accents
    for x in range(width):
        ratio = x / width
        r = int(31 + (47 - 31) * ratio)
        g = int(27 + (42 - 27) * ratio)
        b = int(75 + (107 - 75) * ratio)
        draw.line([(x, 0), (x, height)], fill=(r, g, b, 255))

    # Abstract soft decorative circles in background
    draw.ellipse([700, -100, 1150, 350], fill=(47, 42, 107, 120))
    draw.ellipse([800, 150, 1200, 550], fill=(0, 168, 150, 40))

    # Draw Emblem Z on left (centered vertically: y around 125 to 375)
    # Scaled Z
    scale = 0.7
    offset_x = 100
    offset_y = 70
    z_points = [
        (offset_x + 130 * scale, offset_y + 130 * scale),
        (offset_x + 382 * scale, offset_y + 130 * scale),
        (offset_x + 382 * scale, offset_y + 190 * scale),
        (offset_x + 220 * scale, offset_y + 322 * scale),
        (offset_x + 382 * scale, offset_y + 322 * scale),
        (offset_x + 382 * scale, offset_y + 382 * scale),
        (offset_x + 130 * scale, offset_y + 382 * scale),
        (offset_x + 130 * scale, offset_y + 322 * scale),
        (offset_x + 292 * scale, offset_y + 190 * scale),
        (offset_x + 130 * scale, offset_y + 190 * scale),
    ]
    draw.polygon(z_points, fill=(0, 168, 150, 255))
    draw.ellipse([offset_x + 345 * scale, offset_y + 95 * scale, offset_x + 415 * scale, offset_y + 165 * scale], fill=(0, 204, 180, 255))

    # Text rendering: try default or load truetype
    try:
        font_large = ImageFont.truetype("arial.ttf", 64)
        font_sub = ImageFont.truetype("arial.ttf", 26)
        font_tag = ImageFont.truetype("arial.ttf", 20)
    except:
        font_large = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_tag = ImageFont.load_default()

    draw.text((440, 140), "Kampuz", fill=(255, 255, 255, 255), font=font_large)
    draw.text((440, 230), "Comunidad Universitaria UTP", fill=(0, 204, 180, 255), font=font_sub)
    draw.text((440, 280), "Dudas académicas, grupos por carrera, talleres y encuestas seguras", fill=(203, 213, 225, 255), font=font_tag)
    
    # Tag capsule
    draw.rounded_rectangle([440, 340, 680, 380], radius=10, fill=(0, 168, 150, 50), outline=(0, 168, 150, 200), width=2)
    draw.text((455, 348), "Exclusivo @utp.edu.pe", fill=(255, 255, 255, 255), font=font_tag)

    img.save("docs/play-store/feature-graphic-1024x500.png", "PNG")
    print("feature-graphic-1024x500.png generated successfully.")

if __name__ == "__main__":
    create_play_store_icon()
    create_feature_graphic()
