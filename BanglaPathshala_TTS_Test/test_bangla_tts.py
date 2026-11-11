import torch
import soundfile as sf
from pathlib import Path
from safetensors.torch import load_file
from chatterbox.tts import ChatterboxTTS
from chatterbox.models.t3.t3 import T3

BASE_DIR = "pretrained_models"
DEVICE = "cpu"

print("Loading Bangla TTS...")

tts = ChatterboxTTS.from_local(BASE_DIR, device="cpu")

t3_cfg = tts.t3.hp
t3_cfg.text_tokens_dict_size = 4240

new_t3 = T3(hp=t3_cfg)

state_dict = load_file(
    f"{BASE_DIR}/t3_bangla_888k.safetensors",
    device="cpu"
)

state_dict = {
    k[len("t3."):]: v
    for k, v in state_dict.items()
    if k.startswith("t3.")
}

new_t3.load_state_dict(state_dict, strict=True)

tts.t3 = new_t3
tts.t3.to(DEVICE).eval()
tts.s3gen.to(DEVICE).eval()
tts.ve.to(DEVICE).eval()
tts.device = DEVICE

print("Model ready.")

text = """
আমাদের আজকের কবিতা প্রকৃতির সৌন্দর্য নিয়ে।
সবুজ মাঠ, নীল আকাশ আর পাখির মধুর ডাক
আমাদের হৃদয়কে আনন্দে ভরিয়ে তোলে।
"""

print("Generating audio...")

with torch.inference_mode():
    audio = tts.generate(
        text=text,
        temperature=0.3,
        exaggeration=0.5,
        cfg_weight=0.5,
        repetition_penalty=1.2
    )

output = audio.squeeze().detach().cpu().numpy()

Path("output").mkdir(exist_ok=True)

sf.write("output/bangla_test.wav", output, tts.sr)

print("SUCCESS")
print("Saved: output/bangla_test.wav")
print("Duration:", round(len(output) / tts.sr, 2), "seconds")
