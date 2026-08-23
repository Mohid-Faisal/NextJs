import os
import sys
import numpy as np
from PIL import Image
import imageio

def crop_and_pan(img, width, height, zoom, pan_x, pan_y):
    """Crops and pans the image dynamically."""
    iw, ih = img.size
    crop_w = iw / zoom
    crop_h = ih / zoom
    center_x = (iw / 2) + pan_x * (iw - crop_w) / 2
    center_y = (ih / 2) + pan_y * (ih - crop_h) / 2
    left = max(0, min(iw - crop_w, center_x - crop_w / 2))
    top = max(0, min(ih - crop_h, center_y - crop_h / 2))
    right = left + crop_w
    bottom = top + crop_h
    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((width, height), Image.Resampling.LANCZOS)

def generate_video(img_paths, output_path, fps=30, duration_sec=10, width=1280, height=720):
    total_frames = fps * duration_sec
    images = [Image.open(p).convert("RGB") for p in img_paths]
    
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    writer = imageio.get_writer(output_path, fps=fps, codec='libx264', quality=8, pixelformat='yuv420p')
    
    print(f"Generating {total_frames} frames ({duration_sec}s @ {fps}fps) -> {output_path}")
    fade_len = 25
    
    for f in range(total_frames):
        if f < 100 - fade_len:
            p_prog = f / (100.0 - fade_len)
            frame_img = crop_and_pan(images[0], width, height, 1.0 + 0.08 * p_prog, 0.05 * p_prog, 0.02 * p_prog)
        elif f < 100 + fade_len:
            alpha = (f - (100 - fade_len)) / (2 * fade_len)
            img0 = crop_and_pan(images[0], width, height, 1.08, 0.05, 0.02)
            img1 = crop_and_pan(images[1], width, height, 1.0, -0.04, 0.0)
            arr0 = np.array(img0, dtype=np.float32)
            arr1 = np.array(img1, dtype=np.float32)
            blended = (1 - alpha) * arr0 + alpha * arr1
            frame_img = Image.fromarray(blended.astype(np.uint8))
        elif f < 200 - fade_len:
            p_prog = (f - 100) / (100.0 - fade_len)
            frame_img = crop_and_pan(images[1], width, height, 1.0 + 0.07 * p_prog, -0.04 + 0.08 * p_prog, 0.03 * p_prog)
        elif f < 200 + fade_len:
            alpha = (f - (200 - fade_len)) / (2 * fade_len)
            img1 = crop_and_pan(images[1], width, height, 1.07, 0.04, 0.03)
            img2 = crop_and_pan(images[2], width, height, 1.0, 0.02, -0.03)
            arr1 = np.array(img1, dtype=np.float32)
            arr2 = np.array(img2, dtype=np.float32)
            blended = (1 - alpha) * arr1 + alpha * arr2
            frame_img = Image.fromarray(blended.astype(np.uint8))
        else:
            p_prog = (f - 200) / (100.0)
            frame_img = crop_and_pan(images[2], width, height, 1.0 + 0.09 * p_prog, 0.02 - 0.04 * p_prog, -0.03 + 0.05 * p_prog)
            
        writer.append_data(np.array(frame_img))
        
    writer.close()
    print("Video generation complete!")

if __name__ == "__main__":
    assets_dir = "c:/NextJs/project/public/assets"
    imgs = [
        os.path.join(assets_dir, "phase0_cargo.jpg"),
        os.path.join(assets_dir, "phase1_warehouse.jpg"),
        os.path.join(assets_dir, "phase2_fintech.jpg")
    ]
    out_video = os.path.join(assets_dir, "hero.mp4")
    generate_video(imgs, out_video, fps=30, duration_sec=10, width=1280, height=720)
