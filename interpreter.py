import os
import cv2
import json
import numpy as np
import tensorflow as tf
from ultralytics import YOLO
from PIL import Image

# ==========================================
# ⚙️ CONFIGURATION: APP UI SIMULATION
# ==========================================
TARGET_IMAGE = "sugarcane.jpg"  
SELECTED_CROP = "Sugarcane"           # Set to None to allow auto-detection, or lock to "Corn", "Tomato", etc.

YOLO_MODEL_PATH = "leaf_yolov8n_int8.tflite"
CLASSIFIER_MODEL_PATH = "krishirakshak_effnet_lite0_full_integer_quant.tflite"
CLASS_MAPPING_PATH = "class_mapping.json"  
# ==========================================


def load_class_mapping(json_path):
    if not os.path.exists(json_path):
        print(f"⚠️ Warning: {json_path} not found.")
        return None
    with open(json_path, 'r') as f:
        mapping = json.load(f)
    return [k for k, v in sorted(mapping.items(), key=lambda item: item[1])]

def run_pipeline(image_path):
    print(f"\n🚀 STARTING KRISHIRAKSHAK PIPELINE: {image_path}")
    print("-" * 55)
    
    if not os.path.exists(image_path):
        print(f"❌ Error: Image '{image_path}' not found.")
        return

    # ---------------------------------------------------------
    # STAGE 1: YOLOv8 Leaf Detection & Largest Leaf Cropping
    # ---------------------------------------------------------
    print("⏳ Stage 1: Running YOLOv8 Leaf Detector...")
    
    yolo_detector = YOLO(YOLO_MODEL_PATH, task="detect")
    results = yolo_detector(image_path, imgsz=640, verbose=False)
    
    raw_image = cv2.imread(image_path)
    H, W, _ = raw_image.shape
    
    boxes = results[0].boxes
    if len(boxes) == 0:
        print("⚠️ No leaf detected by YOLO! Passing full image.")
        cropped_leaf = raw_image
    else:
        xyxy = boxes.xyxy.cpu().numpy()
        areas = (xyxy[:, 2] - xyxy[:, 0]) * (xyxy[:, 3] - xyxy[:, 1])
        largest_idx = int(np.argmax(areas))
        best_box = xyxy[largest_idx]
        
        x1, y1, x2, y2 = map(int, best_box)
        cropped_leaf = raw_image[max(0, y1):min(H, y2), max(0, x1):min(W, x2)]
        print(f"✅ Selected largest leaf [Index {largest_idx} | Area: {int(areas[largest_idx]):,} px]")

    # ---------------------------------------------------------
    # STAGE 2: EfficientNet Initialization & Preprocessing
    # ---------------------------------------------------------
    print("⏳ Stage 2: Running EfficientNet-Lite0 Disease Classifier...")
    
    interpreter = tf.lite.Interpreter(model_path=CLASSIFIER_MODEL_PATH)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]

    # Preprocessing
    cropped_rgb = cv2.cvtColor(cropped_leaf, cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(cropped_rgb).resize((224, 224))
    img_array = np.array(img_pil, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_array = (img_array - mean) / std
    img_array = np.expand_dims(img_array, axis=0)

    # Quantize & Invoke
    scale, zero_point = input_details['quantization']
    img_array_int8 = np.clip(np.round(img_array / scale + zero_point), -128, 127).astype(np.int8)
    interpreter.set_tensor(input_details['index'], img_array_int8)
    interpreter.invoke()
    
    # ---------------------------------------------------------
    # STAGE 3: Logit Masking (Crop Lock) & Softmax
    # ---------------------------------------------------------
    output_data = interpreter.get_tensor(output_details['index'])
    out_scale, out_zero_point = output_details['quantization']
    logits = (output_data.astype(np.float32) - out_zero_point) * out_scale
    logits = logits.flatten()

    class_names = load_class_mapping(CLASS_MAPPING_PATH)

    if SELECTED_CROP:
        target_crop = SELECTED_CROP.strip().lower()
        print(f"🔒 Crop Locked: '{SELECTED_CROP}'. Masking all other species...")
        for idx, name in enumerate(class_names):
            if target_crop not in name.lower():
                logits[idx] = -1e9  # Math mask: Set irrelevant crops to negative infinity

    # Softmax on masked logits
    exp_scores = np.exp(logits - np.max(logits))
    probs = exp_scores / np.sum(exp_scores)

    # ---------------------------------------------------------
    # STAGE 4: Output
    # ---------------------------------------------------------
    top_indices = np.argsort(probs)[::-1][:3]
    
    print("\n🌿 KRISHIRAKSHAK DIAGNOSIS:")
    print("-" * 55)
    for rank, idx in enumerate(top_indices, 1):
        name = class_names[idx] if class_names else f"Class Index {idx}"
        confidence = probs[idx] * 100
        print(f"  {rank}. {name} - {confidence:.2f}%")
    print("-" * 55 + "\n")

    cv2.imwrite("last_crop.jpg", cropped_leaf)
    print("📸 Saved isolated leaf crop to 'last_crop.jpg'")


if __name__ == "__main__":
    run_pipeline(TARGET_IMAGE)