from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import whisper
import os
import shutil
from dotenv import load_dotenv
import google.generativeai as genai
from gtts import gTTS, lang as gtts_lang
import uuid
from fastapi.responses import FileResponse

load_dotenv()

app = FastAPI()

# CORS settings to allow your React app to communicate with the FastAPI server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = whisper.load_model("base")
GEMINI_API_KEY = os.getenv("REACT_APP_GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

class GeminiRequest(BaseModel):
    prompt: str
    transcription: str
    form_data: dict

class TranslateRequest(BaseModel):
    text: str
    target_language: str

class TTSRequest(BaseModel):
    text: str
    language: str

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        temp_dir = "temp"
        os.makedirs(temp_dir, exist_ok=True)
        
        file_location = os.path.join(temp_dir, file.filename)
        with open(file_location, "wb") as f:
            shutil.copyfileobj(file.file, f)

        if not os.path.exists(file_location):
            raise HTTPException(status_code=500, detail="Failed to save the file.")
        
        transcription_result = model.transcribe(file_location)
        native_text = transcription_result["text"]
        detected_language = transcription_result.get("language", "en")
        
        translation_result = model.transcribe(file_location, task="translate")
        english_text = translation_result["text"]

        return {"native_text": native_text, "english_text": english_text, "detected_language": detected_language}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/send-to-gemini")
async def send_to_gemini(request: GeminiRequest):
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompts = {
            "situation_summary": f"Provide a short 20-word summary of the following:  {request.transcription}",
            "have job or not": f"Based on the following information, does the person have a job? Answer Yes or No: please analyze the subtle implication of the response if you're not sure answer N/A:  {request.transcription}",
            "have SSN or not": f"Based on the following information, does the person have an SSN? Answer Yes or No: please analyze the subtle implication of the response if you're not sure answer N/A:  {request.transcription}",
            "Applicant_age": f"Determine the age of the applicant from the following information: Answer with number: please analyze the subtle implication of the response if you're not sure answer N/A: {request.transcription}"
        }

        filled_form = {}
        additional_requests = []

        for field, prompt in prompts.items():
            content = f"{request.prompt}\n\n{prompt}"
            response = model.generate_content(content)
            filled_form[field] = "N/A"

            if response and response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if part and part.text:
                                filled_form[field] = part.text.strip()
                                break

            if filled_form[field] == "N/A":
                additional_requests.append(f"Please provide additional information for {field}.")

        return {"filled_form": filled_form, "additional_requests": additional_requests}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate")
async def translate(request: TranslateRequest):
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"Translate the following text to {request.target_language}: {request.text}"
        response = model.generate_content(prompt)
        translated_text = "N/A"
        if response and response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if part and part.text:
                            translated_text = part.text.strip()
                            break
        return {"translated_text": translated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")
async def tts(request: TTSRequest):
    try:
        supported_languages = gtts_lang.tts_langs()
        if request.language not in supported_languages:
            raise HTTPException(status_code=400, detail=f"Language {request.language} not supported by TTS")
        
        tts = gTTS(request.text, lang=request.language)
        audio_file = f"{uuid.uuid4()}.mp3"
        file_path = os.path.join("temp", audio_file)
        tts.save(file_path)
        return {"audio_url": f"http://localhost:8000/temp/{audio_file}"}
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")  # Enhanced logging for better debugging
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/temp/{audio_file}")
async def get_audio_file(audio_file: str):
    try:
        file_path = os.path.join("temp", audio_file)
        if os.path.exists(file_path):
            return FileResponse(file_path)
        else:
            raise HTTPException(status_code=404, detail="Audio file not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
