#!/usr/bin/env python3
"""
Create a simple icon for the LCU Client application.
"""

from PIL import Image, ImageDraw
import os

def create_app_icon():
    """Create a simple application icon"""
    # Create a 256x256 icon (suitable for Windows .ico)
    size = (256, 256)
    icon = Image.new('RGBA', size, (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(icon)

    # Draw a blue circle with white border
    center = (size[0] // 2, size[1] // 2)
    radius = 100

    # Blue circle
    draw.ellipse(
        [(center[0] - radius, center[1] - radius),
         (center[0] + radius, center[1] + radius)],
        fill=(0, 120, 215, 255),  # Blue color
        outline=(255, 255, 255, 255),  # White border
        width=8
    )

    # Add some text or symbol in the center
    # Draw a simple "L" for League
    draw.text((center[0] - 25, center[1] - 40), "L",
              fill=(255, 255, 255, 255), anchor="mm",
              font=None)  # Using default font

    # Save as ICO file
    icon.save('lcu_client.ico', format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
    print("Icon created: lcu_client.ico")

if __name__ == "__main__":
    create_app_icon()
