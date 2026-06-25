from pydantic import BaseModel
from typing import Optional


class KnowledgeUnitInput(BaseModel):
    id: str
    topic: str
    concept: str
    sourceExcerpt: str
    bloomLevel: str = "REMEMBER"


class ProcessDocumentRequest(BaseModel):
    storagePath: str
    fileName: str
    documentId: str


class KnowledgeUnitOutput(BaseModel):
    topic: str
    concept: str
    sourceExcerpt: str
    bloomLevel: str


class ProcessDocumentResponse(BaseModel):
    knowledgeUnits: list[KnowledgeUnitOutput]


class SocraticStartRequest(BaseModel):
    documentId: str
    knowledgeUnits: list[KnowledgeUnitInput]


class SocraticStartResponse(BaseModel):
    question: str
    bloomLevel: str


class ConversationTurn(BaseModel):
    role: str
    content: str
    bloomLevel: str


class SocraticRespondRequest(BaseModel):
    sessionId: str
    studentResponse: str
    conversationHistory: list[ConversationTurn]
    currentBloomLevel: str


class SocraticRespondResponse(BaseModel):
    response: str
    bloomLevel: str
    isSessionComplete: bool


class QuizGenerateRequest(BaseModel):
    documentId: str
    knowledgeUnits: list[KnowledgeUnitInput]
    count: int = 10


class QuizQuestionOutput(BaseModel):
    knowledgeUnitId: str
    questionText: str
    options: list[str]
    correctIndex: int
    bloomLevel: str
    explanation: str
    sourceExcerpt: str


class FlashcardGenerateRequest(BaseModel):
    knowledgeUnits: list[KnowledgeUnitInput]


class FlashcardOutput(BaseModel):
    knowledgeUnitId: str
    front: str
    back: str
    sourceExcerpt: str
