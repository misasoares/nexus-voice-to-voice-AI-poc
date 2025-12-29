from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import Response
from pydantic import BaseModel
import torch
from kokoro import KPipeline
import soundfile as sf
import io
import numpy as np

app = FastAPI()

# Initialize pipeline for Brazilian Portuguese
# 'p' is for Portuguese (pt-br)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Loading Kokoro on {device}...")
pipeline = KPipeline(lang_code='p', device=device)
print("Kokoro loaded!")

class SpeechRequest(BaseModel):
    input: str
    voice: str = "bm_lewis"
    speed: float = 1.0

@app.post("/v1/audio/speech")
async def generate_speech(request: SpeechRequest):
    try:
        text = request.input
        voice_param = request.voice
        speed = request.speed

        print(f"Generating speech for: '{text[:20]}...' with voice={voice_param}, speed={speed}")

        # Voice Handling
        voice_to_use = voice_param
        
        # Check for mixing
        if '+' in voice_param:
            voices = voice_param.split('+')
            print(f"Mixing voices: {voices}")
            
            try:
                # Load all requested voices
                styles = []
                for v in voices:
                    v = v.strip()
                    # pipeline.load_voice() typically returns a tensor
                    # but KPipeline caches it. Let's see if we can access it explicitly used properties
                    # or just use the internal cache mechanism if we had access to the model directly.
                    # Wait, KPipeline doesn't expose 'load_voice' publicly easily for partial use?
                    # Let's check typical 'kokoro' usage for blending.
                    # It's: style = pipeline.load_voice(voice)
                    # We need to make sure 'load_voice' is available on the pipeline instance or model.
                    # Actually, the 'pipeline' object from KPipeline has a .load_voice() method?
                    # Let's assume it does based on common lib structure or helper.
                    
                    # If not, we might need to rely on `kokoro.load_voice` if it's a top level function?
                    # Or `pipeline.model.load_voice`?
                    
                    # Let's try to access the voice directly.
                    # Based on standard kokoro usage:
                    # from kokoro import KPipeline
                    # pipeline = KPipeline(...)
                    # pack = pipeline.load_voice(v) 
                    
                    pack = pipeline.load_voice(v)
                    styles.append(pack)
                
                # Average the styles
                # style is usually a tensor.
                mixed_style = torch.mean(torch.stack(styles), dim=0)
                voice_to_use = mixed_style
                print("Voices mixed successfully.")
                
            except Exception as e:
                print(f"Error mixing voices, falling back to first voice: {e}")
                voice_to_use = voices[0] # Fallback
        
        generator = pipeline(text, voice=voice_to_use, speed=speed, split_pattern=r'\n+')
        
        all_audio = []
        sample_rate = 24000 # Kokoro default

        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None:
                all_audio.append(audio)

        if not all_audio:
             # Fallback or error if no audio generated
             raise HTTPException(status_code=500, detail="No audio generated")

        # Concatenate all audio chunks
        final_audio = np.concatenate(all_audio)

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, final_audio, sample_rate, format='WAV')
        buffer.seek(0)
        
        return Response(content=buffer.read(), media_type="audio/wav")

    except Exception as e:
        print(f"Error generating speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8880)
