import os
import io
import httpx
import PyPDF2
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from config import AI_SERVICE_API_KEY
from schemas import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    SocraticStartRequest,
    SocraticStartResponse,
    SocraticRespondRequest,
    SocraticRespondResponse,
    QuizGenerateRequest,
    QuizQuestionOutput,
    FlashcardGenerateRequest,
    FlashcardOutput,
)
from llm_service import (
    extract_knowledge_units,
    generate_socratic_question,
    generate_socratic_response,
    generate_quiz_questions,
    generate_flashcards,
)

app = FastAPI(title="SOCRA AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_key(authorization: str = Header(None)):
    if not AI_SERVICE_API_KEY:
        return  # No auth if key not configured
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing API key")
    token = authorization.split(" ")[1]
    if token != AI_SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def read_file_content(file_url: str, file_name: str) -> str:
    """Download and read text content from a PDF or plain text file via URL."""
    response = httpx.get(file_url, timeout=60)
    response.raise_for_status()

    if file_name.lower().endswith(".pdf"):
        reader = PyPDF2.PdfReader(io.BytesIO(response.content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    return response.text


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process-document", response_model=ProcessDocumentResponse)
def process_document(req: ProcessDocumentRequest, _=Depends(verify_api_key)):
    text = read_file_content(req.fileUrl, req.fileName)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Document appears to be empty")

    units = extract_knowledge_units(text, req.fileName)
    return {"knowledgeUnits": units}


@app.post("/socratic/start", response_model=SocraticStartResponse)
def socratic_start(req: SocraticStartRequest, _=Depends(verify_api_key)):
    knowledge_units = [ku.model_dump() for ku in req.knowledgeUnits]
    result = generate_socratic_question(knowledge_units, "REMEMBER")
    return result


@app.post("/socratic/respond", response_model=SocraticRespondResponse)
def socratic_respond(req: SocraticRespondRequest, _=Depends(verify_api_key)):
    history = [turn.model_dump() for turn in req.conversationHistory]
    result = generate_socratic_response(
        student_response=req.studentResponse,
        conversation_history=history,
        current_bloom_level=req.currentBloomLevel,
    )
    return result


@app.post("/quiz/generate", response_model=list[QuizQuestionOutput])
def quiz_generate(req: QuizGenerateRequest, _=Depends(verify_api_key)):
    knowledge_units = [ku.model_dump() for ku in req.knowledgeUnits]
    questions = generate_quiz_questions(knowledge_units, req.count)
    return questions


@app.post("/flashcard/generate", response_model=list[FlashcardOutput])
def flashcard_generate(req: FlashcardGenerateRequest, _=Depends(verify_api_key)):
    knowledge_units = [ku.model_dump() for ku in req.knowledgeUnits]
    cards = generate_flashcards(knowledge_units)
    return cards


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
