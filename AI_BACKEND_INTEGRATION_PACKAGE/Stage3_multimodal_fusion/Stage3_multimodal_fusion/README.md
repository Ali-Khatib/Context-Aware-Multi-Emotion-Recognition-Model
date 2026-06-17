# 🚀 How to Run
## 1. Install dependencies

pip install -r requirements.txt

## 2. Set your Gemini API key

set GEMINI_API_KEY=your_key_here

Model files are loaded from this folder automatically (`fusion_model.pkl`, `fusion_label_map.json`).

## 3. Run inference

python stage3_fusion_api.py

Then enter image path:

/path/to/image.jpg

--- 

# 📥 Input Format
Any image file:\
.jpg\
.png\
.jpeg

---

# 📤 Output Format\
{\
  "cnn_prediction": "...",\
  "vlm_prediction": "...",\
  "description": "...",\
  "fusion_prediction": "emotion_label"\
}

---

# 🎯 Important Notes
* Only fusion_prediction should be shown in UI\
* CNN + VLM are supporting signals for fusion\
* System uses Gemini API for vision-language reasoning\
* No dataset dependency required

---

# ⚠️ Requirements
* Internet connection (for Gemini API)
* Python 3.8+
* GPU optional

---
